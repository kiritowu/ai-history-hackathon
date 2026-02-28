from __future__ import annotations

from io import BytesIO

from PIL import Image

from adapters.chat_openai import OpenAIChatService
from adapters.embedder_hf import OpenAICompatibleEmbeddingEmbedder, SentenceTransformerEmbedder
from adapters.gcs_storage import GCSStorageClient
from adapters.ocr_paddle_vl_server import PaddleOCRVLServerProvider
from adapters.pdf_ingest import PDFIngestSource
from adapters.vector_weaviate import WeaviateVectorStore
from core.pipeline import RagPipeline
from settings import get_settings


def create_pipeline() -> RagPipeline:
    settings = get_settings()
    ocr = PaddleOCRVLServerProvider(
        vl_rec_server_url=settings.paddleocr_vl_server_url,
        vl_rec_backend=settings.paddleocr_vl_backend,
        vl_rec_api_model_name=settings.paddleocr_vl_api_model_name,
    )
    if settings.embedding_backend == "openai_compatible":
        embedder = OpenAICompatibleEmbeddingEmbedder(
            base_url=settings.embedding_api_base_url,
            model=settings.embedding_api_model,
            api_key=settings.embedding_api_key,
        )
    else:
        embedder = SentenceTransformerEmbedder(settings.embedding_model_id)
    vector_store = WeaviateVectorStore(
        collection_name=settings.weaviate_collection,
        cloud_url=settings.weaviate_url,
        cloud_api_key=settings.weaviate_api_key,
    )
    chat = OpenAIChatService(
        api_key=settings.openai_api_key,
        model=settings.openai_model,
        temperature=settings.openai_temperature,
    )
    return RagPipeline(
        ocr_provider=ocr,
        embedder=embedder,
        vector_store=vector_store,
        chat_service=chat,
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
    )


def pil_from_upload(file_bytes: bytes) -> Image.Image:
    return Image.open(BytesIO(file_bytes)).convert("RGB")


def create_pdf_ingest_source() -> PDFIngestSource:
    settings = get_settings()
    gcs_client = GCSStorageClient(project=settings.gcp_project or None)
    return PDFIngestSource(gcs_client=gcs_client)
