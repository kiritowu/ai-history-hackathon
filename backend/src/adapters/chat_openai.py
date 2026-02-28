from __future__ import annotations

from typing import Sequence

from openai import OpenAI

from core.interfaces import ChatService
from core.models import ChatTurn


SYSTEM_PROMPT = """You are a document QA assistant.
Answer using only the provided retrieval context.
If the context is insufficient, clearly say you do not have enough evidence in the retrieved chunks.
Keep answers concise and accurate."""


class OpenAIChatService(ChatService):
    def __init__(
        self,
        api_key: str,
        model: str = "gpt-4.1-mini",
        temperature: float = 0.1,
    ) -> None:
        self._client = OpenAI(api_key=api_key)
        self._model = model
        self._temperature = temperature

    def answer(self, question: str, context: str, history: Sequence[ChatTurn]) -> str:
        messages: list[dict[str, str]] = [{"role": "system", "content": SYSTEM_PROMPT}]
        for turn in history:
            if turn.role in {"user", "assistant"}:
                messages.append({"role": turn.role, "content": turn.content})
        messages.append(
            {
                "role": "user",
                "content": f"Context:\n{context}\n\nQuestion:\n{question}",
            }
        )

        response = self._client.chat.completions.create(
            model=self._model,
            messages=messages,
            temperature=self._temperature,
        )
        return (response.choices[0].message.content or "").strip()
