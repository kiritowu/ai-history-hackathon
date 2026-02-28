from __future__ import annotations

from functools import lru_cache

from adapters.pdf_ingest import PDFIngestSource
from core.pipeline import RagPipeline
from pipeline_factory import create_pdf_ingest_source, create_pipeline


@lru_cache(maxsize=1)
def get_pipeline() -> RagPipeline:
    return create_pipeline()


@lru_cache(maxsize=1)
def get_pdf_ingest_source() -> PDFIngestSource:
    return create_pdf_ingest_source()
