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

# Contains all pages
ALL_PAGES = []
OCR_DIR = Path("OCRd")

for f in OCR_DIR.glob("*.txt"):
    with open(f, "r", encoding="utf-8") as f:
        text = f.read()

    # Split on page headers
    pages = re.split(r"===== Page \d+ =====", text)
    # Remove empty chunks and strip whitespace
    ALL_PAGES.extend([page.strip() for page in pages if page.strip()])


# https://ai.pydantic.dev/api/embeddings/#pydantic_ai.embeddings.openai.OpenAIEmbeddingModel
embedder = Embedder("openai:text-embedding-3-small")


# Embed 64 documents at once
EMBED_BATCH_SIZE = 64
EMBED_CONCURRENCY = 3  # fewer concurrent batches
INSERT_CONCURRENCY = 16

embed_sem = asyncio.Semaphore(EMBED_CONCURRENCY)
insert_sem = asyncio.Semaphore(INSERT_CONCURRENCY)


def chunked(xs: List[str], n: int) -> Iterable[List[str]]:
    for i in range(0, len(xs), n):
        yield xs[i : i + n]


async def embed_batch(embedder: Any, batch: List[str]) -> List[List[float]]:
    async with embed_sem:
        return await embedder.embed_documents(batch)


async def insert_one(vector_store: Any, text: str, vector: List[float]) -> str:
    async with insert_sem:

        def _do_insert() -> str:
            return vector_store.data.insert(
                properties={"text": text},
                vector=vector,
            )

        return await asyncio.to_thread(_do_insert)


async def embed_and_upload_batched(embedder: Any, vector_store: Any, ALL_PAGES: List[str]) -> List[Optional[str]]:
    results: List[Optional[str]] = []

    for batch in chunked(ALL_PAGES, EMBED_BATCH_SIZE):
        print(f"Embedding {EMBED_BATCH_SIZE} docs")
        vectors = await embed_batch(embedder, batch)  # list of vectors aligned to batch order

        insert_tasks = [asyncio.create_task(insert_one(vector_store, text, vec)) for text, vec in zip(batch, vectors)]
        batch_uuids = await asyncio.gather(*insert_tasks, return_exceptions=True)

        for u in batch_uuids:
            if isinstance(u, Exception):
                print(f"Insert failed: {u}")
                results.append(None)
            else:
                results.append(u)

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
vector_store = client.collections.use("TEST1")

asyncio.run(embed_and_upload_batched(embedder, vector_store, ALL_PAGES))

client.close()  # Free up resources
