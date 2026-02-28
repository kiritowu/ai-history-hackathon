from __future__ import annotations

from collections.abc import Callable

from fastapi import APIRouter, Depends, HTTPException, Query

from api.routes.mappers import to_chunk_dto
from api.schemas import ChunksResponseDTO
from core.pipeline import RagPipeline


def _resolve_doc_ids(doc_id: str | None, doc_ids: str | None) -> tuple[str | None, list[str] | None]:
    parsed_doc_ids = [item.strip() for item in (doc_ids or "").split(",") if item.strip()] or None
    if doc_id and parsed_doc_ids:
        raise HTTPException(status_code=422, detail="Provide either doc_id or doc_ids, not both.")
    return doc_id, parsed_doc_ids


def create_router(pipeline_provider: Callable[[], RagPipeline]) -> APIRouter:
    router = APIRouter(prefix="/v1")

    @router.get("/chunks", response_model=ChunksResponseDTO)
    async def list_chunks(
        doc_id: str | None = Query(default=None),
        doc_ids: str | None = Query(default=None, description="Comma-separated doc IDs."),
        limit: int = Query(default=200, ge=1, le=2000),
        pipeline: RagPipeline = Depends(pipeline_provider),
    ) -> ChunksResponseDTO:
        resolved_doc_id, resolved_doc_ids = _resolve_doc_ids(doc_id=doc_id, doc_ids=doc_ids)
        chunks = pipeline.list_indexed_chunks(doc_id=resolved_doc_id, doc_ids=resolved_doc_ids, limit=limit)
        return ChunksResponseDTO(chunks=[to_chunk_dto(chunk) for chunk in chunks])

    return router
