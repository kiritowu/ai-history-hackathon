from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any, Iterable

from PIL import Image
from paddleocr import PaddleOCRVL

from core.interfaces import OCRProvider


class PaddleOCRVLServerProvider(OCRProvider):
    def __init__(
        self,
        vl_rec_server_url: str,
        vl_rec_backend: str = "vllm-server",
        vl_rec_api_model_name: str | None = None,
    ) -> None:
        self._vl_rec_server_url = vl_rec_server_url
        self._vl_rec_backend = vl_rec_backend
        self._vl_rec_api_model_name = vl_rec_api_model_name
        self._pipeline: PaddleOCRVL | None = None

    def _ensure_loaded(self) -> None:
        if self._pipeline is not None:
            return

        kwargs: dict[str, Any] = {
            "vl_rec_backend": self._vl_rec_backend,
            "vl_rec_server_url": self._vl_rec_server_url,
        }
        if self._vl_rec_api_model_name:
            kwargs["vl_rec_api_model_name"] = self._vl_rec_api_model_name
        self._pipeline = PaddleOCRVL(**kwargs)

    @staticmethod
    def _collect_strings(value: Any) -> list[str]:
        lines: list[str] = []
        if value is None:
            return lines
        if isinstance(value, str):
            stripped = value.strip()
            if stripped:
                lines.append(stripped)
            return lines
        if isinstance(value, dict):
            rec_texts = value.get("rec_texts")
            if isinstance(rec_texts, list):
                for text in rec_texts:
                    if isinstance(text, str) and text.strip():
                        lines.append(text.strip())
            text = value.get("text")
            if isinstance(text, str) and text.strip():
                lines.append(text.strip())
            for nested in value.values():
                lines.extend(PaddleOCRVLServerProvider._collect_strings(nested))
            return lines
        if isinstance(value, (list, tuple)):
            for nested in value:
                lines.extend(PaddleOCRVLServerProvider._collect_strings(nested))
        return lines

    @staticmethod
    def _read_markdown_outputs(results: Iterable[Any], temp_dir: Path) -> str:
        collected_markdown: list[str] = []
        for idx, res in enumerate(results):
            if not hasattr(res, "save_to_markdown"):
                continue
            before = set(temp_dir.glob("**/*.md"))
            res.save_to_markdown(save_path=str(temp_dir / f"res_{idx}"))
            after = set(temp_dir.glob("**/*.md"))
            new_files = sorted(after - before)
            for md_file in new_files:
                text = md_file.read_text(encoding="utf-8").strip()
                if text:
                    collected_markdown.append(text)
        return "\n\n".join(collected_markdown).strip()

    @staticmethod
    def _extract_text_from_result(res: Any, temp_dir: Path, result_idx: int) -> str:
        if hasattr(res, "save_to_markdown"):
            before = set(temp_dir.glob("**/*.md"))
            res.save_to_markdown(save_path=str(temp_dir / f"res_{result_idx}"))
            after = set(temp_dir.glob("**/*.md"))
            new_files = sorted(after - before)
            markdown_parts = [md_file.read_text(encoding="utf-8").strip() for md_file in new_files]
            markdown_text = "\n\n".join(part for part in markdown_parts if part).strip()
            if markdown_text:
                return markdown_text

        fallback_lines: list[str] = []
        if hasattr(res, "res"):
            fallback_lines.extend(PaddleOCRVLServerProvider._collect_strings(getattr(res, "res")))
        fallback_lines.extend(PaddleOCRVLServerProvider._collect_strings(res))
        return "\n".join(fallback_lines).strip()

    def extract_text(self, image: Image.Image) -> str:
        self._ensure_loaded()
        assert self._pipeline is not None

        with TemporaryDirectory() as temp_dir_str:
            temp_dir = Path(temp_dir_str)
            image_path = temp_dir / "input.png"
            image.convert("RGB").save(image_path, format="PNG")

            results = list(self._pipeline.predict(str(image_path)))
            markdown_text = self._read_markdown_outputs(results, temp_dir)
            if markdown_text:
                return markdown_text

            fallback_lines: list[str] = []
            for res in results:
                if hasattr(res, "res"):
                    fallback_lines.extend(self._collect_strings(getattr(res, "res")))
                fallback_lines.extend(self._collect_strings(res))
            return "\n".join(fallback_lines).strip()

    def extract_text_from_pdf_bytes(self, pdf_bytes: bytes) -> str:
        page_texts = self.extract_text_pages_from_pdf_bytes(pdf_bytes)
        return "\n\n".join(page_texts).strip()

    def extract_text_pages_from_pdf_bytes(self, pdf_bytes: bytes) -> list[str]:
        self._ensure_loaded()
        assert self._pipeline is not None

        with TemporaryDirectory() as temp_dir_str:
            temp_dir = Path(temp_dir_str)
            pdf_path = temp_dir / "input.pdf"
            pdf_path.write_bytes(pdf_bytes)

            results = list(self._pipeline.predict(str(pdf_path)))
            page_texts: list[str] = []
            for idx, res in enumerate(results):
                page_text = self._extract_text_from_result(res=res, temp_dir=temp_dir, result_idx=idx)
                if page_text:
                    page_texts.append(page_text)
            return page_texts
