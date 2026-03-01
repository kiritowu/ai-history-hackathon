import asyncio
import json
import logging
import os
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import weaviate
import weaviate.classes as wvc
from dotenv import load_dotenv
from openai import AsyncOpenAI
from weaviate.classes.config import DataType, Property
from weaviate.classes.init import Auth

load_dotenv(override=True)

OCR_DIR = Path("OCRd")
LOG_DIR = Path("logs")
OUTPUT_DIR = Path("summary_outputs")

PROCESSED_LOG = Path("doc_summary_processed.txt")
FAILED_LOG = Path("doc_summary_failed.jsonl")

SUMMARY_COLLECTION_NAME = "documentSummariesTest3"
SUMMARY_MODEL = "gpt-5.2"
EMBED_MODEL = "text-embedding-3-large"

# Tunables for throughput and safety.
DOC_CONCURRENCY = 4
MAX_RETRIES = 3
MAX_DOC_CHARS = 180_000
# For a one-file dry run, set this to an OCR filename in OCRd, e.g. "my_doc.txt".
# Set back to None to process all unprocessed files.
RUN_ONLY_FILE: str | None = None

PAGE_PATTERN = re.compile(r"^===== Page (\d+) =====\s*\n(.*?)(?=^===== Page \d+ =====|\Z)", flags=re.S | re.M)


def setup_logging() -> None:
    LOG_DIR.mkdir(exist_ok=True)
    log_path = LOG_DIR / "doc_summary_embed.log"

    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    logger.handlers.clear()

    file_handler = logging.FileHandler(log_path, encoding="utf-8")
    stream_handler = logging.StreamHandler()
    formatter = logging.Formatter("%(asctime)s | %(levelname)s | %(message)s")

    file_handler.setFormatter(formatter)
    stream_handler.setFormatter(formatter)

    logger.addHandler(file_handler)
    logger.addHandler(stream_handler)


def load_processed() -> set[str]:
    if not PROCESSED_LOG.exists():
        return set()
    return set(PROCESSED_LOG.read_text(encoding="utf-8").splitlines())


def append_processed(name: str) -> None:
    with PROCESSED_LOG.open("a", encoding="utf-8") as f:
        f.write(f"{name}\n")


def append_failed(name: str, error: str) -> None:
    payload = {
        "file": name,
        "error": error,
        "at": datetime.now(UTC).isoformat(),
    }
    with FAILED_LOG.open("a", encoding="utf-8") as f:
        f.write(json.dumps(payload, ensure_ascii=False) + "\n")


def parse_pages(text: str) -> list[tuple[int, str]]:
    return [(int(page_no), content.strip()) for page_no, content in PAGE_PATTERN.findall(text)]


def build_document_prompt(filename: str, pages: list[tuple[int, str]]) -> str:
    chunks: list[str] = []
    total_chars = 0

    for page_no, page_text in pages:
        page_block = f"## Page {page_no}\n{page_text.strip()}\n"
        if total_chars + len(page_block) > MAX_DOC_CHARS:
            remaining = max(0, MAX_DOC_CHARS - total_chars)
            if remaining > 0:
                chunks.append(page_block[:remaining] + "\n[TRUNCATED]")
            break
        chunks.append(page_block)
        total_chars += len(page_block)

    doc_text = "\n".join(chunks)
    return (
        "You are summarizing OCR text from a historical archive document.\n"
        "Return a concise summary in 5-8 bullet points that covers:\n"
        "- core topic/purpose\n"
        "- geography/time period if present\n"
        "- major decisions, proposals, or events\n"
        "- key actors (people, organizations, governments)\n"
        "- notable numbers/dates if present\n"
        "Do not invent information; if uncertain, state uncertainty clearly.\n\n"
        f"Document filename: {filename}\n"
        f"Extracted text by page:\n{doc_text}"
    )


async def with_retries(coro_factory: Any, label: str, file_name: str, max_retries: int = MAX_RETRIES) -> Any:
    for attempt in range(1, max_retries + 1):
        try:
            return await coro_factory()
        except Exception as e:  # noqa: BLE001
            if attempt == max_retries:
                raise
            wait_s = attempt * 2
            logging.warning(
                "[%s] %s attempt %s/%s failed: %s. retrying in %ss",
                file_name,
                label,
                attempt,
                max_retries,
                repr(e),
                wait_s,
            )
            await asyncio.sleep(wait_s)
    raise RuntimeError("unreachable")


async def summarize_document(openai_client: AsyncOpenAI, filename: str, pages: list[tuple[int, str]]) -> str:
    prompt = build_document_prompt(filename, pages)

    async def _call() -> str:
        resp = await openai_client.chat.completions.create(
            model=SUMMARY_MODEL,
            temperature=0.1,
            messages=[
                {
                    "role": "system",
                    "content": "You are a precise archive document summarizer.",
                },
                {"role": "user", "content": prompt},
            ],
        )
        content = resp.choices[0].message.content
        if not content:
            raise RuntimeError("Summary response was empty")
        return content.strip()

    return await with_retries(_call, "summary", filename)


async def embed_summary(openai_client: AsyncOpenAI, filename: str, summary: str) -> list[float]:
    async def _call() -> list[float]:
        resp = await openai_client.embeddings.create(model=EMBED_MODEL, input=summary)
        return resp.data[0].embedding

    return await with_retries(_call, "embedding", filename)


def ensure_collection(client: Any, collection_name: str) -> Any:
    if client.collections.exists(collection_name):
        return client.collections.use(collection_name)

    logging.info("Creating Weaviate collection: %s", collection_name)
    client.collections.create(
        collection_name,
        vector_config=wvc.config.Configure.Vectors.self_provided(),
        properties=[
            Property(name="source", data_type=DataType.TEXT),
            Property(name="filename", data_type=DataType.TEXT),
            Property(name="summary", data_type=DataType.TEXT),
            Property(name="pageCount", data_type=DataType.INT),
            Property(name="processedAt", data_type=DataType.DATE),
        ],
    )
    return client.collections.use(collection_name)


async def insert_summary(
    vector_store: Any,
    source: str,
    filename: str,
    summary: str,
    page_count: int,
    embedding: list[float],
) -> str:
    def _insert() -> str:
        return vector_store.data.insert(
            properties={
                "source": source,
                "filename": filename,
                "summary": summary,
                "pageCount": page_count,
                "processedAt": datetime.now(UTC).isoformat(),
            },
            vector=embedding,
        )

    return await asyncio.to_thread(_insert)


async def process_one_file(
    f: Path,
    openai_client: AsyncOpenAI,
    vector_store: Any,
    sem: asyncio.Semaphore,
) -> None:
    async with sem:
        source = f.stem
        logging.info("[%s] starting", source)

        try:
            text = f.read_text(encoding="utf-8")
            pages = parse_pages(text)
            if not pages:
                raise ValueError("No OCR page blocks found")

            summary = await summarize_document(openai_client, f.name, pages)
            embedding = await embed_summary(openai_client, f.name, summary)
            obj_id = await insert_summary(
                vector_store=vector_store,
                source=source,
                filename=f.name,
                summary=summary,
                page_count=len(pages),
                embedding=embedding,
            )
            obj_id_str = str(obj_id)

            OUTPUT_DIR.mkdir(exist_ok=True)
            output_payload = {
                "source": source,
                "filename": f.name,
                "pageCount": len(pages),
                "summary": summary,
                "weaviateObjectId": obj_id_str,
                "savedAt": datetime.now(UTC).isoformat(),
            }
            (OUTPUT_DIR / f"{source}.summary.json").write_text(
                json.dumps(output_payload, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

            append_processed(source)
            logging.info("[%s] success (pages=%s, obj=%s)", source, len(pages), obj_id_str)
        except Exception as e:  # noqa: BLE001
            append_failed(source, repr(e))
            logging.exception("[%s] failed: %s", source, repr(e))


async def main() -> None:
    setup_logging()

    if not OCR_DIR.exists():
        raise FileNotFoundError(f"OCR directory not found: {OCR_DIR.resolve()}")

    weaviate_url = os.environ["WEAVIATE_URL"]
    weaviate_api_key = os.environ["WEAVIATE_API_KEY"]
    _ = os.environ["OPENAI_API_KEY"]  # fail fast if missing

    processed = load_processed()

    if RUN_ONLY_FILE:
        one_file = OCR_DIR / RUN_ONLY_FILE
        if not one_file.exists():
            raise FileNotFoundError(f"RUN_ONLY_FILE not found: {one_file.resolve()}")
        files = [one_file]
        logging.info("Single-file mode enabled: %s", one_file.name)
    else:
        files = sorted([p for p in OCR_DIR.glob("*.txt") if p.stem not in processed])

    if not files:
        logging.info("No new OCR files to process.")
        return

    logging.info("Found %s files to process (skipping %s already processed).", len(files), len(processed))

    client = weaviate.connect_to_weaviate_cloud(
        cluster_url=weaviate_url,
        auth_credentials=Auth.api_key(weaviate_api_key),
    )
    logging.info("Weaviate ready: %s", client.is_ready())
    vector_store = ensure_collection(client, SUMMARY_COLLECTION_NAME)

    openai_client = AsyncOpenAI()
    try:
        sem = asyncio.Semaphore(DOC_CONCURRENCY)

        tasks = [
            asyncio.create_task(process_one_file(f, openai_client=openai_client, vector_store=vector_store, sem=sem))
            for f in files
        ]
        await asyncio.gather(*tasks)
        logging.info("Batch run complete.")
    finally:
        await openai_client.close()
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
