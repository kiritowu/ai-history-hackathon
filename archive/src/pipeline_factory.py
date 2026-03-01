from __future__ import annotations

from io import BytesIO

from PIL import Image

from adapters.chat_openai import OpenAIChatService
from adapters.embedder_hf import OpenAICompatibleEmbeddingEmbedder, SentenceTransformerEmbedder
from adapters.gcs_storage import GCSStorageClient
from adapters.ocr_vlm_chat import VLMChatOCRProvider
from adapters.ocr_paddle_vl_server import PaddleOCRVLServerProvider
from adapters.pdf_ingest import PDFIngestSource
from adapters.vector_weaviate import WeaviateVectorStore
from core.pipeline import RagPipeline
from settings import get_settings


def create_pipeline() -> RagPipeline:
    settings = get_settings()
    if settings.ocr_backend == "vlm_chat":
        ocr = VLMChatOCRProvider(
            base_url=settings.vlm_ocr_base_url,
            model=settings.vlm_ocr_model,
            api_key=settings.vlm_ocr_api_key,
            task_prompt=settings.vlm_ocr_task_prompt,
            timeout_seconds=settings.vlm_ocr_timeout_seconds,
            pdf_dpi=settings.vlm_ocr_pdf_dpi,
        )
    else:
        ocr = PaddleOCRVLServerProvider(
            vl_rec_server_url=settings.paddleocr_vl_server_url,
            vl_rec_backend=settings.paddleocr_vl_backend,
            vl_rec_api_model_name=settings.paddleocr_vl_api_model_name,
        )

    if settings.embedding_backend == "openai_compatible":
        embedding_api_key = settings.embedding_api_key if settings.embedding_api_key != "EMPTY" else ""
        embedder = OpenAICompatibleEmbeddingEmbedder(
            base_url=settings.embedding_api_base_url,
            model=settings.embedding_api_model,
            api_key=embedding_api_key or settings.openai_api_key,
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
        pdf_page_batch_size=settings.pdf_page_batch_size,
    )


def pil_from_upload(file_bytes: bytes) -> Image.Image:
    return Image.open(BytesIO(file_bytes)).convert("RGB")


def create_pdf_ingest_source() -> PDFIngestSource:
    settings = get_settings()
    gcs_client = GCSStorageClient(project=settings.gcp_project or None)
    return PDFIngestSource(gcs_client=gcs_client)
