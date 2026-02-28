from __future__ import annotations

from collections.abc import Callable

from fastapi import APIRouter, Depends, HTTPException

from adapters.pdf_ingest import PDFIngestSource
from api.schemas import (
    BulkIngestFromGCSRequestDTO,
    BulkIngestResponseDTO,
    IngestFailureDTO,
    IngestFromGCSRequestDTO,
    IngestSuccessDTO,
)
from core.pipeline import RagPipeline


def create_router(
    pipeline_provider: Callable[[], RagPipeline],
    pdf_ingest_source_provider: Callable[[], PDFIngestSource],
) -> APIRouter:
    router = APIRouter(prefix="/v1")

    @router.post("/ingest", response_model=IngestSuccessDTO)
    async def ingest_pdf_from_gcs(
        request: IngestFromGCSRequestDTO,
        pipeline: RagPipeline = Depends(pipeline_provider),
        pdf_ingest_source: PDFIngestSource = Depends(pdf_ingest_source_provider),
    ) -> IngestSuccessDTO:
        try:
            payload = pdf_ingest_source.read_pdf_from_gcs(
                gcs_uri=request.gcs_uri,
                source_name=request.source_name,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to read from GCS: {exc}") from exc

        try:
            doc_id, chunk_count, ocr_text = pipeline.ingest_pdf(payload.pdf_bytes, payload.source_name)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Ingestion failed: {exc}") from exc
        return IngestSuccessDTO(
            source_name=payload.source_name,
            doc_id=doc_id,
            chunk_count=chunk_count,
            ocr_text=ocr_text,
        )

    @router.post("/ingest/bulk", response_model=BulkIngestResponseDTO)
    async def ingest_bulk_from_gcs(
        request: BulkIngestFromGCSRequestDTO,
        pipeline: RagPipeline = Depends(pipeline_provider),
        pdf_ingest_source: PDFIngestSource = Depends(pdf_ingest_source_provider),
    ) -> BulkIngestResponseDTO:
        gcs_uris: list[str] = list(request.gcs_uris or [])
        if request.bucket_uri:
            try:
                listed_uris = pdf_ingest_source.list_gcs_uris(
                    bucket_uri=request.bucket_uri,
                    prefix=request.prefix,
                    suffixes=tuple(request.file_suffixes) if request.file_suffixes else None,
                )
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
            except Exception as exc:
                raise HTTPException(status_code=500, detail=f"Failed to list bucket files: {exc}") from exc
            gcs_uris.extend(listed_uris)

        if not gcs_uris:
            raise HTTPException(status_code=404, detail="No files found to ingest.")

        unique_gcs_uris = list(dict.fromkeys(gcs_uris))

        successes: list[IngestSuccessDTO] = []
        failures: list[IngestFailureDTO] = []

        for start in range(0, len(unique_gcs_uris), request.batch_size):
            batch_uris = unique_gcs_uris[start : start + request.batch_size]
            pdf_payloads: list[tuple[bytes, str]] = []

            for gcs_uri in batch_uris:
                try:
                    payload = pdf_ingest_source.read_pdf_from_gcs(gcs_uri=gcs_uri)
                except Exception as exc:
                    failures.append(
                        IngestFailureDTO(source_name=gcs_uri, error=f"Failed to read from GCS: {exc}")
                    )
                    continue
                pdf_payloads.append((payload.pdf_bytes, payload.source_name))

            if not pdf_payloads:
                continue

            result = pipeline.ingest_pdfs(pdf_payloads)
            successes.extend(
                IngestSuccessDTO(
                    source_name=item.source_name,
                    doc_id=item.doc_id,
                    chunk_count=item.chunk_count,
                    ocr_text=item.ocr_text,
                )
                for item in result.successes
            )
            failures.extend(IngestFailureDTO(source_name=item.source_name, error=item.error) for item in result.failures)

        return BulkIngestResponseDTO(successes=successes, failures=failures)

    return router
