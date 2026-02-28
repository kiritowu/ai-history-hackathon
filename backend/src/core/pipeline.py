from __future__ import annotations

from collections.abc import Sequence
from uuid import uuid4

from PIL import Image

from core.interfaces import ChatService, Embedder, OCRProvider, VectorStore
from core.models import (
    BulkIngestResult,
    ChatTurn,
    DocumentChunk,
    IngestFailure,
    IngestSuccess,
    RetrievalHit,
)


def chunk_text(text: str, chunk_size: int = 700, overlap: int = 120) -> list[str]:
    normalized = " ".join(text.split())
    if not normalized:
        return []

    words = normalized.split(" ")
    chunks: list[str] = []
    start = 0
    while start < len(words):
        current_words: list[str] = []
        current_len = 0
        cursor = start

        while cursor < len(words):
            word = words[cursor]
            next_len = current_len + len(word) + (1 if current_words else 0)
            if next_len > chunk_size:
                break
            current_words.append(word)
            current_len = next_len
            cursor += 1

        if not current_words:
            current_words.append(words[start][:chunk_size])
            cursor = start + 1

        chunks.append(" ".join(current_words))
        if cursor >= len(words):
            break

        # Keep a small overlapping tail to preserve context.
        tail_words: list[str] = []
        tail_len = 0
        back_cursor = cursor - 1
        while back_cursor >= start:
            candidate = words[back_cursor]
            next_tail_len = tail_len + len(candidate) + (1 if tail_words else 0)
            if next_tail_len > overlap:
                break
            tail_words.append(candidate)
            tail_len = next_tail_len
            back_cursor -= 1
        start = max(start + 1, cursor - len(tail_words))

    return chunks


def build_context(hits: list[RetrievalHit]) -> str:
    if not hits:
        return "No relevant context was retrieved."

    lines: list[str] = []
    for idx, hit in enumerate(hits, start=1):
        lines.append(
            (
                f"[Chunk {idx}] "
                f"(source={hit.chunk.source}, chunk_index={hit.chunk.chunk_index}, score={hit.score:.4f})\n"
                f"{hit.chunk.text}"
            )
        )
    return "\n\n".join(lines)


class RagPipeline:
    def __init__(
        self,
        ocr_provider: OCRProvider,
        embedder: Embedder,
        vector_store: VectorStore,
        chat_service: ChatService,
        chunk_size: int = 700,
        chunk_overlap: int = 120,
        pdf_page_batch_size: int = 10,
    ) -> None:
        self._ocr_provider = ocr_provider
        self._embedder = embedder
        self._vector_store = vector_store
        self._chat_service = chat_service
        self._chunk_size = chunk_size
        self._chunk_overlap = chunk_overlap
        self._pdf_page_batch_size = pdf_page_batch_size

    @staticmethod
    def _normalize_chunks(chunks: Sequence[str]) -> list[str]:
        return [" ".join(chunk.split()) for chunk in chunks if chunk and chunk.strip()]

    def _index_chunks(self, chunks: Sequence[str], source_name: str, ocr_text: str) -> IngestSuccess:
        normalized_chunks = self._normalize_chunks(chunks)
        if not normalized_chunks:
            raise ValueError("No OCR text extracted from the provided document.")

        doc_id = str(uuid4())
        chunk_models = [
            DocumentChunk(
                chunk_id=str(uuid4()),
                doc_id=doc_id,
                source=source_name,
                chunk_index=idx,
                text=chunk,
            )
            for idx, chunk in enumerate(normalized_chunks)
        ]
        vectors = self._embedder.embed_texts([chunk.text for chunk in chunk_models])
        self._vector_store.upsert_chunks(chunk_models, vectors)
        return IngestSuccess(
            source_name=source_name,
            doc_id=doc_id,
            chunk_count=len(chunk_models),
            ocr_text=ocr_text,
        )

    def _upsert_chunk_batch(
        self,
        *,
        doc_id: str,
        source_name: str,
        chunks: Sequence[str],
        start_index: int,
    ) -> int:
        normalized_chunks = self._normalize_chunks(chunks)
        if not normalized_chunks:
            return 0

        chunk_models = [
            DocumentChunk(
                chunk_id=str(uuid4()),
                doc_id=doc_id,
                source=source_name,
                chunk_index=start_index + idx,
                text=chunk,
            )
            for idx, chunk in enumerate(normalized_chunks)
        ]
        vectors = self._embedder.embed_texts([chunk.text for chunk in chunk_models])
        self._vector_store.upsert_chunks(chunk_models, vectors)
        return len(chunk_models)

    def _ingest_text_internal(self, text: str, source_name: str) -> IngestSuccess:
        chunks = chunk_text(text, chunk_size=self._chunk_size, overlap=self._chunk_overlap)
        if not chunks:
            raise ValueError("No OCR text extracted from the provided document.")
        return self._index_chunks(chunks=chunks, source_name=source_name, ocr_text=text)

    def _ingest_image_internal(self, image: Image.Image, source_name: str) -> IngestSuccess:
        text = self._ocr_provider.extract_text(image)
        return self._ingest_text_internal(text=text, source_name=source_name)

    def _ingest_pdf_internal(self, pdf_bytes: bytes, source_name: str) -> IngestSuccess:
        doc_id = str(uuid4())
        indexed_count = 0
        ocr_pages: list[str] = []
        page_batches = self._ocr_provider.extract_text_page_batches_from_pdf_bytes(
            pdf_bytes=pdf_bytes,
            batch_size=self._pdf_page_batch_size,
        )
        for page_batch in page_batches:
            normalized_batch = self._normalize_chunks(page_batch)
            if not normalized_batch:
                continue
            inserted = self._upsert_chunk_batch(
                doc_id=doc_id,
                source_name=source_name,
                chunks=normalized_batch,
                start_index=indexed_count,
            )
            if inserted:
                indexed_count += inserted
                ocr_pages.extend(normalized_batch)

        if indexed_count == 0:
            raise ValueError("No OCR text extracted from the provided document.")
        full_text = "\n\n".join(ocr_pages)
        return IngestSuccess(
            source_name=source_name,
            doc_id=doc_id,
            chunk_count=indexed_count,
            ocr_text=full_text,
        )

    def ingest_image(self, image: Image.Image, source_name: str) -> tuple[str, int, str]:
        result = self._ingest_image_internal(image=image, source_name=source_name)
        return result.doc_id, result.chunk_count, result.ocr_text

    def ingest_images(self, images: Sequence[tuple[Image.Image, str]]) -> BulkIngestResult:
        successes: list[IngestSuccess] = []
        failures: list[IngestFailure] = []
        for image, source_name in images:
            try:
                success = self._ingest_image_internal(image=image, source_name=source_name)
            except Exception as exc:
                failures.append(IngestFailure(source_name=source_name, error=str(exc)))
                continue
            successes.append(success)
        return BulkIngestResult(successes=successes, failures=failures)

    def ingest_pdf(self, pdf_bytes: bytes, source_name: str) -> tuple[str, int, str]:
        result = self._ingest_pdf_internal(pdf_bytes=pdf_bytes, source_name=source_name)
        return result.doc_id, result.chunk_count, result.ocr_text

    def ingest_pdfs(self, pdfs: Sequence[tuple[bytes, str]]) -> BulkIngestResult:
        successes: list[IngestSuccess] = []
        failures: list[IngestFailure] = []
        for pdf_bytes, source_name in pdfs:
            try:
                success = self._ingest_pdf_internal(pdf_bytes=pdf_bytes, source_name=source_name)
            except Exception as exc:
                failures.append(IngestFailure(source_name=source_name, error=str(exc)))
                continue
            successes.append(success)
        return BulkIngestResult(successes=successes, failures=failures)

    def retry_failed_images(self, images: Sequence[tuple[Image.Image, str]]) -> BulkIngestResult:
        return self.ingest_images(images=images)

    def ask(
        self,
        question: str,
        top_k: int = 4,
        doc_id: str | None = None,
        doc_ids: Sequence[str] | None = None,
        history: list[ChatTurn] | None = None,
    ) -> tuple[str, list[RetrievalHit]]:
        query_vector = self._embedder.embed_texts([question])[0]
        hits = self._vector_store.search(
            query_vector=query_vector,
            top_k=top_k,
            doc_id=doc_id,
            doc_ids=doc_ids,
        )
        context = build_context(hits)
        answer = self._chat_service.answer(
            question=question,
            context=context,
            history=history or [],
        )
        return answer, hits

    def list_indexed_chunks(
        self,
        doc_id: str | None = None,
        doc_ids: Sequence[str] | None = None,
        limit: int = 200,
    ) -> list[DocumentChunk]:
        return self._vector_store.list_chunks(doc_id=doc_id, doc_ids=doc_ids, limit=limit)
