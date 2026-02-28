from __future__ import annotations

from collections.abc import Callable

from fastapi import APIRouter, Depends, HTTPException

from api.routes.mappers import to_hit_dto
from api.schemas import AskRequestDTO, AskResponseDTO
from core.models import ChatTurn
from core.pipeline import RagPipeline


def create_router(pipeline_provider: Callable[[], RagPipeline]) -> APIRouter:
    router = APIRouter(prefix="/v1")

    @router.post("/ask", response_model=AskResponseDTO)
    async def ask(
        payload: AskRequestDTO,
        pipeline: RagPipeline = Depends(pipeline_provider),
    ) -> AskResponseDTO:
        history = [ChatTurn(role=item.role, content=item.content) for item in payload.history]
        try:
            answer, hits = pipeline.ask(
                question=payload.question,
                top_k=payload.top_k,
                doc_id=payload.doc_id,
                doc_ids=payload.doc_ids,
                history=history,
            )
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Question answering failed: {exc}") from exc
        return AskResponseDTO(answer=answer, hits=[to_hit_dto(hit) for hit in hits])

    return router
