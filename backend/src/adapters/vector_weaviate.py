from __future__ import annotations

from typing import Sequence

import weaviate
from weaviate.classes.config import Configure, DataType, Property
from weaviate.classes.init import Auth
from weaviate.classes.query import Filter

from core.interfaces import VectorStore
from core.models import DocumentChunk, RetrievalHit


class WeaviateVectorStore(VectorStore):
    def __init__(
        self,
        collection_name: str,
        cloud_url: str,
        cloud_api_key: str,
    ) -> None:
        self._collection_name = collection_name
        self._cloud_url = cloud_url
        self._cloud_api_key = cloud_api_key
        self._client: weaviate.WeaviateClient | None = None

    def _connect(self) -> weaviate.WeaviateClient:
        if self._client is None:
            if not self._cloud_url:
                raise ValueError("WEAVIATE_URL is required for Weaviate Cloud.")
            if not self._cloud_api_key:
                raise ValueError("WEAVIATE_API_KEY is required for Weaviate Cloud.")

            self._client = weaviate.connect_to_weaviate_cloud(
                cluster_url=self._cloud_url,
                auth_credentials=Auth.api_key(self._cloud_api_key),
            )
            self._ensure_collection()
        return self._client

    def _ensure_collection(self) -> None:
        client = self._client
        assert client is not None
        exists = client.collections.exists(self._collection_name)
        if exists:
            return
        client.collections.create(
            name=self._collection_name,
            vectorizer_config=Configure.Vectorizer.none(),
            properties=[
                Property(name="doc_id", data_type=DataType.TEXT),
                Property(name="source", data_type=DataType.TEXT),
                Property(name="chunk_index", data_type=DataType.INT),
                Property(name="text", data_type=DataType.TEXT),
            ],
        )

    def upsert_chunks(self, chunks: Sequence[DocumentChunk], vectors: Sequence[Sequence[float]]) -> None:
        client = self._connect()
        collection = client.collections.get(self._collection_name)

        with collection.batch.dynamic() as batch:
            for chunk, vector in zip(chunks, vectors, strict=True):
                batch.add_object(
                    properties={
                        "doc_id": chunk.doc_id,
                        "source": chunk.source,
                        "chunk_index": chunk.chunk_index,
                        "text": chunk.text,
                    },
                    uuid=chunk.chunk_id,
                    vector=vector,
                )

    @staticmethod
    def _build_doc_filter(doc_id: str | None, doc_ids: Sequence[str] | None) -> Filter | None:
        if doc_ids:
            filters = [Filter.by_property("doc_id").equal(current_doc_id) for current_doc_id in doc_ids]
            if len(filters) == 1:
                return filters[0]
            return Filter.any_of(filters)
        if doc_id:
            return Filter.by_property("doc_id").equal(doc_id)
        return None

    def search(
        self,
        query_vector: Sequence[float],
        top_k: int,
        doc_id: str | None = None,
        doc_ids: Sequence[str] | None = None,
    ) -> list[RetrievalHit]:
        client = self._connect()
        collection = client.collections.get(self._collection_name)
        where_filter = self._build_doc_filter(doc_id=doc_id, doc_ids=doc_ids)

        result = collection.query.near_vector(
            near_vector=list(query_vector),
            limit=top_k,
            filters=where_filter,
            return_metadata=["distance"],
        )

        hits: list[RetrievalHit] = []
        for obj in result.objects:
            properties = obj.properties
            metadata = obj.metadata
            distance = getattr(metadata, "distance", None)
            score = 1.0 if distance is None else max(0.0, 1.0 - float(distance))
            hits.append(
                RetrievalHit(
                    chunk=DocumentChunk(
                        chunk_id=str(obj.uuid),
                        doc_id=str(properties["doc_id"]),
                        source=str(properties["source"]),
                        chunk_index=int(properties["chunk_index"]),
                        text=str(properties["text"]),
                    ),
                    score=score,
                )
            )
        return hits

    def list_chunks(
        self,
        doc_id: str | None = None,
        doc_ids: Sequence[str] | None = None,
        limit: int = 200,
    ) -> list[DocumentChunk]:
        client = self._connect()
        collection = client.collections.get(self._collection_name)
        where_filter = self._build_doc_filter(doc_id=doc_id, doc_ids=doc_ids)

        result = collection.query.fetch_objects(
            limit=limit,
            filters=where_filter,
        )
        chunks: list[DocumentChunk] = []
        for obj in result.objects:
            properties = obj.properties
            chunks.append(
                DocumentChunk(
                    chunk_id=str(obj.uuid),
                    doc_id=str(properties["doc_id"]),
                    source=str(properties["source"]),
                    chunk_index=int(properties["chunk_index"]),
                    text=str(properties["text"]),
                )
            )

        chunks.sort(key=lambda chunk: (chunk.doc_id, chunk.chunk_index))
        return chunks

    def close(self) -> None:
        if self._client is not None:
            self._client.close()
            self._client = None
