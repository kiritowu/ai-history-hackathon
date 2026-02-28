from __future__ import annotations

from api.schemas import DocumentChunkDTO, RetrievalHitDTO
from core.models import DocumentChunk, RetrievalHit


def to_chunk_dto(chunk: DocumentChunk) -> DocumentChunkDTO:
    return DocumentChunkDTO(
        chunk_id=chunk.chunk_id,
        doc_id=chunk.doc_id,
        source=chunk.source,
        chunk_index=chunk.chunk_index,
        text=chunk.text,
    )


def to_hit_dto(hit: RetrievalHit) -> RetrievalHitDTO:
    return RetrievalHitDTO(chunk=to_chunk_dto(hit.chunk), score=hit.score)
