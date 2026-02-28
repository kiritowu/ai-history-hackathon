from __future__ import annotations

from dataclasses import dataclass

from google.cloud import storage


@dataclass(slots=True)
class GCSObjectRef:
    bucket: str
    blob: str


class GCSStorageClient:
    def __init__(self, project: str | None = None) -> None:
        self._project = project
        self._client: storage.Client | None = None

    def _ensure_client(self) -> storage.Client:
        if self._client is None:
            self._client = storage.Client(project=self._project)
        return self._client

    @staticmethod
    def parse_gcs_uri(gcs_uri: str) -> GCSObjectRef:
        if not gcs_uri.startswith("gs://"):
            raise ValueError("GCS URI must start with 'gs://'.")

        path = gcs_uri[len("gs://") :]
        if not path or "/" not in path:
            raise ValueError("GCS URI must include both bucket and object path.")

        bucket, blob = path.split("/", 1)
        if not bucket or not blob:
            raise ValueError("GCS URI must include both bucket and object path.")
        return GCSObjectRef(bucket=bucket, blob=blob)

    @staticmethod
    def parse_gcs_bucket_uri(bucket_uri: str) -> tuple[str, str]:
        if not bucket_uri.startswith("gs://"):
            raise ValueError("GCS bucket URI must start with 'gs://'.")

        path = bucket_uri[len("gs://") :]
        if not path:
            raise ValueError("GCS bucket URI must include a bucket name.")

        if "/" in path:
            bucket, prefix = path.split("/", 1)
        else:
            bucket, prefix = path, ""
        if not bucket:
            raise ValueError("GCS bucket URI must include a bucket name.")
        return bucket, prefix

    def download_bytes(self, gcs_uri: str) -> bytes:
        ref = self.parse_gcs_uri(gcs_uri)
        client = self._ensure_client()
        bucket = client.bucket(ref.bucket)
        blob = bucket.blob(ref.blob)
        return blob.download_as_bytes()

    def list_blob_uris(
        self,
        bucket_uri: str,
        prefix: str = "",
        suffixes: tuple[str, ...] | None = None,
    ) -> list[str]:
        bucket_name, uri_prefix = self.parse_gcs_bucket_uri(bucket_uri)
        combined_prefix = "/".join(part.strip("/") for part in [uri_prefix, prefix] if part.strip("/"))

        client = self._ensure_client()
        blob_iter = client.list_blobs(bucket_name, prefix=combined_prefix or None)

        uris: list[str] = []
        for blob in blob_iter:
            blob_name = blob.name
            if not blob_name or blob_name.endswith("/"):
                continue
            if suffixes and not blob_name.lower().endswith(tuple(current_suffix.lower() for current_suffix in suffixes)):
                continue
            uris.append(f"gs://{bucket_name}/{blob_name}")

        uris.sort()
        return uris
