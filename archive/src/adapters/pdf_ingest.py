from __future__ import annotations

from dataclasses import dataclass

from adapters.gcs_storage import GCSStorageClient


@dataclass(slots=True)
class PDFPayload:
    source_name: str
    pdf_bytes: bytes


class PDFIngestSource:
    def __init__(self, gcs_client: GCSStorageClient) -> None:
        self._gcs_client = gcs_client

    @staticmethod
    def default_source_name(gcs_uri: str) -> str:
        return gcs_uri.rsplit("/", 1)[-1] or "document.pdf"

    def read_pdf_from_gcs(self, gcs_uri: str) -> PDFPayload:
        pdf_bytes = self._gcs_client.download_bytes(gcs_uri)
        resolved_name = self.default_source_name(gcs_uri)
        return PDFPayload(source_name=resolved_name, pdf_bytes=pdf_bytes)

    def read_pdfs_from_gcs(self, gcs_uris: list[str]) -> list[PDFPayload]:
        return [self.read_pdf_from_gcs(gcs_uri=current_uri) for current_uri in gcs_uris]

    def list_gcs_uris(
        self,
        bucket_uri: str,
        prefix: str = "",
        suffixes: tuple[str, ...] | None = None,
    ) -> list[str]:
        return self._gcs_client.list_blob_uris(bucket_uri=bucket_uri, prefix=prefix, suffixes=suffixes)
