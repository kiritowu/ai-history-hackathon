from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    openai_api_key: str = ""
    openai_model: str = "gpt-4.1-mini"
    openai_temperature: float = 0.1

    paddleocr_vl_server_url: str = "http://127.0.0.1:8111/"
    paddleocr_vl_backend: str = "mlx-vlm-server"
    paddleocr_vl_api_model_name: str = "PaddlePaddle/PaddleOCR-VL-1.5"
    ocr_backend: str = "paddle_vl_server"
    vlm_ocr_base_url: str = "https://usehovrapp--vllm-server-serve.modal.run"
    vlm_ocr_model: str = "PaddlePaddle/PaddleOCR-VL"
    vlm_ocr_api_key: str = "pass123"
    vlm_ocr_task_prompt: str = "OCR:"
    vlm_ocr_timeout_seconds: float = 600.0
    vlm_ocr_pdf_dpi: int = 200

    embedding_backend: str = "local_sentence_transformer"
    embedding_model_id: str = "BAAI/bge-m3"
    embedding_api_base_url: str = ""
    embedding_api_model: str = "BAAI/bge-m3"
    embedding_api_key: str = "EMPTY"

    weaviate_collection: str = "DocumentChunk"
    weaviate_url: str = ""
    weaviate_api_key: str = ""

    gcp_project: str = ""

    rag_top_k: int = 4
    chunk_size: int = 700
    chunk_overlap: int = 120
    pdf_page_batch_size: int = 10


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
