from __future__ import annotations

from collections.abc import Callable

from fastapi import FastAPI

from api.deps import get_pdf_ingest_source, get_pipeline
from api.routes.ask import create_router as create_ask_router
from api.routes.chunks import create_router as create_chunks_router
from api.routes.health import router as health_router
from api.routes.ingest import create_router as create_ingest_router
from core.pipeline import RagPipeline


def create_app(pipeline_provider: Callable[[], RagPipeline] = get_pipeline) -> FastAPI:
    app = FastAPI(title="RAG Backend API", version="0.1.0")
    app.include_router(health_router)
    app.include_router(create_ingest_router(pipeline_provider, get_pdf_ingest_source))
    app.include_router(create_ask_router(pipeline_provider))
    app.include_router(create_chunks_router(pipeline_provider))
    return app


app = create_app()
