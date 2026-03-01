from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class DocumentChunk:
    chunk_id: str
    doc_id: str
    source: str
    chunk_index: int
    text: str


@dataclass(slots=True)
class RetrievalHit:
    chunk: DocumentChunk
    score: float


@dataclass(slots=True)
class ChatTurn:
    role: str
    content: str


@dataclass(slots=True)
class IngestSuccess:
    source_name: str
    doc_id: str
    chunk_count: int
    ocr_text: str


@dataclass(slots=True)
class IngestFailure:
    source_name: str
    error: str


@dataclass(slots=True)
class BulkIngestResult:
    successes: list[IngestSuccess]
    failures: list[IngestFailure]
