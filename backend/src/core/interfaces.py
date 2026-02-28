from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Sequence

from PIL import Image

from core.models import ChatTurn, DocumentChunk, RetrievalHit


class OCRProvider(ABC):
    @abstractmethod
    def extract_text(self, image: Image.Image) -> str:
        """Extract raw text from an image."""

    @abstractmethod
    def extract_text_from_pdf_bytes(self, pdf_bytes: bytes) -> str:
        """Extract raw text from a PDF payload."""


class Embedder(ABC):
    @abstractmethod
    def embed_texts(self, texts: Sequence[str]) -> list[list[float]]:
        """Convert texts to dense vectors."""


class VectorStore(ABC):
    @abstractmethod
    def upsert_chunks(self, chunks: Sequence[DocumentChunk], vectors: Sequence[Sequence[float]]) -> None:
        """Insert or update chunk vectors in the index."""

    @abstractmethod
    def search(
        self,
        query_vector: Sequence[float],
        top_k: int,
        doc_id: str | None = None,
        doc_ids: Sequence[str] | None = None,
    ) -> list[RetrievalHit]:
        """Retrieve relevant chunks for a query vector."""

    @abstractmethod
    def list_chunks(
        self,
        doc_id: str | None = None,
        doc_ids: Sequence[str] | None = None,
        limit: int = 200,
    ) -> list[DocumentChunk]:
        """List indexed chunks for browsing/debugging."""


class ChatService(ABC):
    @abstractmethod
    def answer(self, question: str, context: str, history: Sequence[ChatTurn]) -> str:
        """Generate an answer from question and retrieval context."""
