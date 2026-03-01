from __future__ import annotations

import base64
import io
import json
import re

from openai import OpenAI
from pdf2image import convert_from_bytes
from PIL import Image

from core.interfaces import OCRProvider


class VLMChatOCRProvider(OCRProvider):
    def __init__(
        self,
        base_url: str,
        model: str,
        api_key: str = "EMPTY",
        task_prompt: str = "OCR:",
        timeout_seconds: float = 600.0,
        pdf_dpi: int = 200,
    ) -> None:
        if not base_url:
            raise ValueError("VLM OCR base_url is required.")
        if not model:
            raise ValueError("VLM OCR model is required.")
        self._client = OpenAI(api_key=api_key, base_url=base_url, timeout=timeout_seconds)
        self._model = model
        self._task_prompt = task_prompt
        self._pdf_dpi = pdf_dpi

    @staticmethod
    def _pil_to_data_url(img: Image.Image, fmt: str = "PNG") -> str:
        buf = io.BytesIO()
        img.convert("RGB").save(buf, format=fmt)
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
        mime = "image/png" if fmt.upper() == "PNG" else "image/jpeg"
        return f"data:{mime};base64,{b64}"

    def _ocr_single_image(self, image: Image.Image) -> str:
        image_url = self._pil_to_data_url(image, "PNG")
        response = self._client.chat.completions.create(
            model=self._model,
            temperature=0.0,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": image_url}},
                        {"type": "text", "text": self._task_prompt},
                    ],
                }
            ],
        )
        message = response.choices[0].message.content or ""
        return message.strip()

    @staticmethod
    def _parse_batch_json(content: str, expected_count: int) -> list[str] | None:
        parsed = None
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            match = re.search(r"\[[\s\S]*\]", content)
            if match:
                try:
                    parsed = json.loads(match.group(0))
                except json.JSONDecodeError:
                    parsed = None
        if not isinstance(parsed, list):
            return None
        values = [str(item).strip() for item in parsed]
        if len(values) != expected_count:
            return None
        return values

    def _ocr_image_batch(self, images: list[Image.Image]) -> list[str]:
        if not images:
            return []
        if len(images) == 1:
            return [self._ocr_single_image(images[0])]

        content: list[dict[str, object]] = []
        for image in images:
            content.append({"type": "image_url", "image_url": {"url": self._pil_to_data_url(image, "PNG")}})
        content.append(
            {
                "type": "text",
                "text": (
                    f"{self._task_prompt}\n"
                    "Return OCR for each image in order as a strict JSON array of strings. "
                    f"The array length must be exactly {len(images)}. "
                    "No markdown, no extra keys, no extra text."
                ),
            }
        )

        response = self._client.chat.completions.create(
            model=self._model,
            temperature=0.0,
            messages=[{"role": "user", "content": content}],
        )
        raw_content = (response.choices[0].message.content or "").strip()
        parsed = self._parse_batch_json(raw_content, expected_count=len(images))
        if parsed is not None:
            return parsed

        # Fallback to single-image OCR when model output is not strict JSON.
        return [self._ocr_single_image(image) for image in images]

    def extract_text(self, image: Image.Image) -> str:
        return self._ocr_single_image(image)

    def extract_text_from_pdf_bytes(self, pdf_bytes: bytes) -> str:
        page_texts = self.extract_text_pages_from_pdf_bytes(pdf_bytes)
        return "\n\n".join(page_texts).strip()

    def extract_text_pages_from_pdf_bytes(self, pdf_bytes: bytes) -> list[str]:
        page_batches = self.extract_text_page_batches_from_pdf_bytes(pdf_bytes=pdf_bytes, batch_size=1000)
        return [page_text for batch in page_batches for page_text in batch]

    def extract_text_page_batches_from_pdf_bytes(self, pdf_bytes: bytes, batch_size: int) -> list[list[str]]:
        if batch_size < 1:
            raise ValueError("batch_size must be >= 1.")
        pages = convert_from_bytes(pdf_bytes, dpi=self._pdf_dpi)
        page_batches: list[list[str]] = []
        for start_idx in range(0, len(pages), batch_size):
            current_pages = pages[start_idx : start_idx + batch_size]
            current_texts = self._ocr_image_batch(current_pages)
            normalized = [text.strip() for text in current_texts if text.strip()]
            if normalized:
                page_batches.append(normalized)
        return page_batches
