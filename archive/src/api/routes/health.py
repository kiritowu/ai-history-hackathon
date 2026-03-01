from __future__ import annotations

from fastapi import APIRouter

from api.schemas import HealthResponseDTO
from settings import get_settings

router = APIRouter()


@router.get("/health", response_model=HealthResponseDTO)
async def health() -> HealthResponseDTO:
    settings = get_settings()
    return HealthResponseDTO(
        status="ok",
        openai_configured=bool(settings.openai_api_key),
        embedding_backend=settings.embedding_backend,
        weaviate_collection=settings.weaviate_collection,
    )
