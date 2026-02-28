from __future__ import annotations

import math
from typing import Sequence

from openai import OpenAI
from sentence_transformers import SentenceTransformer

from core.interfaces import Embedder


class SentenceTransformerEmbedder(Embedder):
    def __init__(self, model_id: str) -> None:
        self._model = SentenceTransformer(model_id)

    def embed_texts(self, texts: Sequence[str]) -> list[list[float]]:
        vectors = self._model.encode(
            list(texts),
            normalize_embeddings=True,
        )
        return vectors.tolist()


def _l2_normalize(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0:
        return vector
    return [value / norm for value in vector]


class OpenAICompatibleEmbeddingEmbedder(Embedder):
    def __init__(
        self,
        base_url: str,
        model: str,
        api_key: str = "EMPTY",
    ) -> None:
        self._client = OpenAI(api_key=api_key, base_url=base_url, timeout=60.0)
        self._model = model

    def embed_texts(self, texts: Sequence[str]) -> list[list[float]]:
        response = self._client.embeddings.create(
            model=self._model,
            input=list(texts),
        )
        vectors = [list(item.embedding) for item in response.data]
        return [_l2_normalize(vector) for vector in vectors]
