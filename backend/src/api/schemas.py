from __future__ import annotations

from pydantic import BaseModel, Field, model_validator


class ChatTurnDTO(BaseModel):
    role: str = Field(min_length=1)
    content: str = Field(min_length=1)


class DocumentChunkDTO(BaseModel):
    chunk_id: str
    doc_id: str
    source: str
    chunk_index: int
    text: str


class RetrievalHitDTO(BaseModel):
    chunk: DocumentChunkDTO
    score: float


class IngestSuccessDTO(BaseModel):
    source_name: str
    doc_id: str
    chunk_count: int
    ocr_text: str


class IngestFromGCSRequestDTO(BaseModel):
    gcs_uri: str = Field(min_length=6)
    source_name: str | None = None


class IngestFailureDTO(BaseModel):
    source_name: str
    error: str


class BulkIngestResponseDTO(BaseModel):
    successes: list[IngestSuccessDTO]
    failures: list[IngestFailureDTO]


class BulkIngestFromGCSRequestDTO(BaseModel):
    gcs_uris: list[str] | None = None
    bucket_uri: str | None = None
    prefix: str = ""
    batch_size: int = Field(default=10, ge=1, le=200)
    file_suffixes: list[str] = Field(default_factory=lambda: [".pdf"])

    @model_validator(mode="after")
    def validate_sources(self) -> "BulkIngestFromGCSRequestDTO":
        has_uris = bool(self.gcs_uris)
        has_bucket = bool(self.bucket_uri)
        if not has_uris and not has_bucket:
            raise ValueError("Provide either gcs_uris or bucket_uri.")
        return self


class AskRequestDTO(BaseModel):
    question: str = Field(min_length=1)
    top_k: int = Field(default=4, ge=1, le=50)
    doc_id: str | None = None
    doc_ids: list[str] | None = None
    history: list[ChatTurnDTO] = Field(default_factory=list)


class AskResponseDTO(BaseModel):
    answer: str
    hits: list[RetrievalHitDTO]


class ChunksResponseDTO(BaseModel):
    chunks: list[DocumentChunkDTO]


class HealthResponseDTO(BaseModel):
    status: str
    openai_configured: bool
    embedding_backend: str
    weaviate_collection: str
