import asyncio
import os
from dotenv import load_dotenv
import weaviate
from weaviate.classes.init import Auth
from pydantic_ai import Embedder
from pydantic_ai.exceptions import ModelHTTPError
import spacy

from pathlib import Path
from typing import Any, List, Optional, Iterable
import re

load_dotenv(override=True)

processed_text_filename = "embed_processed.txt"

with open(processed_text_filename, "r", encoding="utf-8") as f:
    processed_items = f.read().splitlines()

nlp = spacy.load("en_core_web_sm")

# Contains all pages in the tuple (source, page_no, text)
ALL_PAGES = []
OCR_DIR = Path("OCRd")

LABEL_TO_GROUP = {
    # agents
    "PERSON": "agent",
    "NORP": "agent",
    "ORG": "agent",
    # where / when
    "GPE": "where_when",
    "LOC": "where_when",
    "FAC": "where_when",
    "DATE": "where_when",
    "TIME": "where_when",
}


# https://ai.pydantic.dev/api/embeddings/#pydantic_ai.embeddings.openai.OpenAIEmbeddingModel
embedder = Embedder("openai:text-embedding-3-large")


PageItem = tuple[str, int, str]

# Embed 32 documents at once
EMBED_BATCH_SIZE = 32
EMBED_CONCURRENCY = 3  # fewer concurrent batches
INSERT_CONCURRENCY = 16

embed_sem = asyncio.Semaphore(EMBED_CONCURRENCY)
insert_sem = asyncio.Semaphore(INSERT_CONCURRENCY)


def chunked(xs: List[PageItem], n: int) -> Iterable[List[PageItem]]:
    for i in range(0, len(xs), n):
        yield xs[i : i + n]


async def embed_batch(embedder: Any, texts: List[str], sem: asyncio.Semaphore) -> List[List[float]]:
    async with sem:
        vectors = await embedder.embed_documents(texts)
        if not vectors:
            raise RuntimeError("Embedding error!")
        return vectors


async def insert_one(
    vector_store: Any,
    source: str,
    page_number: int,
    text: str,
    vector: List[float],
    ner_text: list[dict],
    sem: asyncio.Semaphore,
) -> str:
    async with sem:

        def _do_insert() -> str:
            # words = source.split()
            # selected = words if len(words) <= 5 else (words[:3] + words[-2:])
            # folder_name = "_".join(selected).lower()

            # What is "source"?
            match = re.search(r"^(.*?)__\s*(CO\s*\d+:\d+:\d+)", source)

            if match:
                name = match.group(1)
                co_number = match.group(2).replace(" ", "")  # remove the spacing, so we get COXYZ instead of CO xyz

            words = name.split()
            selected = words if len(words) <= 5 else (words[:3] + words[-2:])
            folder_name = co_number + "__" + "_".join(selected).lower()

            public_url = (
                f"https://storage.googleapis.com/ai-history-hackathon-bucket/imgs/{folder_name}/{page_number}.png"
            )

            return vector_store.data.insert(
                properties={
                    "source": source,
                    "pageNumber": page_number,
                    "text": text,
                    "imageUrl": public_url,
                    "ner": ner_text,
                },
                vector=vector,
            )

        return await asyncio.to_thread(_do_insert)


async def embed_and_upload_batched(
    embedder: Any,
    vector_store: Any,
    ALL_PAGES: List[PageItem],
    *,
    embed_batch_size: int = EMBED_BATCH_SIZE,
    embed_concurrency: int = EMBED_CONCURRENCY,
    insert_concurrency: int = INSERT_CONCURRENCY,
) -> List[Optional[str]]:
    embed_sem = asyncio.Semaphore(embed_concurrency)
    insert_sem = asyncio.Semaphore(insert_concurrency)

    total = len(ALL_PAGES)
    print(f"Starting: {total} pages", flush=True)

    results: List[Optional[str]] = []
    done = 0

    for bi, batch in enumerate(chunked(ALL_PAGES, embed_batch_size), start=1):
        retry_count = 0

        texts = [text for (_source, _page_no, text) in batch]

        print(f"[batch {bi}] embedding {len(texts)} docs...", flush=True)

        while retry_count < 3:
            try:
                vectors = await embed_batch(embedder, texts, embed_sem)
                break
            except ModelHTTPError as e:
                print(repr(e))
                retry_count += 1
        else:
            continue

        print(f"[batch {bi}] embedding done.", flush=True)

        all_entities: list[list[dict]] = []

        for doc in nlp.pipe(texts):
            doc_entities = [
                {
                    "start": ent.start_char,
                    "end": ent.end_char,
                    "label": LABEL_TO_GROUP.get(ent.label_, "other"),
                    "original_label": ent.label_,
                    "text": ent.text,
                }
                for ent in doc.ents
            ]

            all_entities.append(doc_entities)

        print(f"[batch {bi}] NER done. inserting...", flush=True)

        tasks = [
            asyncio.create_task(insert_one(vector_store, source, page_no, text, vec, ner_text, insert_sem))
            for (source, page_no, text), vec, ner_text in zip(batch, vectors, all_entities)
        ]

        uuids = await asyncio.gather(*tasks, return_exceptions=True)

        for u in uuids:
            done += 1
            if isinstance(u, Exception):
                print(f"[{done}/{total}] insert failed: {u}", flush=True)
                results.append(None)
            else:
                results.append(u)

        print(f"[batch {bi}] done. progress: {done}/{total}", flush=True)

    print("All done.", flush=True)
    return results


# Best practice: store your credentials in environment variables
weaviate_url = os.environ["WEAVIATE_URL"]
weaviate_api_key = os.environ["WEAVIATE_API_KEY"]

# Connect to Weaviate Cloud
client = weaviate.connect_to_weaviate_cloud(
    cluster_url=weaviate_url,
    auth_credentials=Auth.api_key(weaviate_api_key),
)

print(client.is_ready())  # Should print: `True`
vector_store = client.collections.use("historyCollections")


for f in OCR_DIR.glob("*.txt"):
    name = f.name.replace(".txt", "")
    if name in processed_items:
        print(f"Already processed {name}. Skipping...")
        continue

    with open(f, "r", encoding="utf-8") as f:
        text = f.read()
    source_name = f.name.replace(".txt", "").replace("OCRd/", "")

    # Split on page headers. Create a tuple of (sourceName, pageNo, text)
    result = [
        (source_name, int(page_no), content.strip())
        for page_no, content in re.findall(
            r"^===== Page (\d+) =====\s*\n(.*?)(?=^===== Page \d+ =====|\Z)", text, flags=re.S | re.M
        )
    ]

    asyncio.run(embed_and_upload_batched(embedder, vector_store, result))
    with open(processed_text_filename, "a", encoding="utf-8") as outfile:
        outfile.write(name + "\n")

client.close()  # Free up resources
