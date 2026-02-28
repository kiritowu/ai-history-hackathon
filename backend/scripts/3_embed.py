import asyncio
import os
from dotenv import load_dotenv
import weaviate
from weaviate.classes.init import Auth
from pydantic_ai import Embedder

from pathlib import Path
from typing import Any, List, Optional, Iterable
import re

load_dotenv(override=True)

# Contains all pages in the tuple (source, page_no, text)
ALL_PAGES = []
OCR_DIR = Path("OCRd")

for f in OCR_DIR.glob("*.txt"):
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

    ALL_PAGES.extend(result)


# https://ai.pydantic.dev/api/embeddings/#pydantic_ai.embeddings.openai.OpenAIEmbeddingModel
embedder = Embedder("openai:text-embedding-3-large")


PageItem = tuple[str, int, str]

# Embed 64 documents at once
EMBED_BATCH_SIZE = 64
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
    sem: asyncio.Semaphore,
) -> str:
    async with sem:

        def _do_insert() -> str:
            words = source.split()
            selected = words if len(words) <= 5 else (words[:3] + words[-2:])
            folder_name = "_".join(selected).lower()
            public_url = (
                f"https://storage.googleapis.com/ai-history-hackathon-bucket/imgs/{folder_name}/{page_number}.png"
            )

            return vector_store.data.insert(
                properties={"source": source, "pageNumber": page_number, "text": text, "imageUrl": public_url},
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
        texts = [text for (_source, _page_no, text) in batch]

        print(f"[batch {bi}] embedding {len(texts)} docs...", flush=True)
        vectors = await embed_batch(embedder, texts, embed_sem)
        print(f"[batch {bi}] embedding done. inserting...", flush=True)

        tasks = [
            asyncio.create_task(insert_one(vector_store, source, page_no, text, vec, insert_sem))
            for (source, page_no, text), vec in zip(batch, vectors)
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
vector_store = client.collections.use("TEST3")

asyncio.run(embed_and_upload_batched(embedder, vector_store, ALL_PAGES))

client.close()  # Free up resources
