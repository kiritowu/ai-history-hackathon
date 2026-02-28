from __future__ import annotations

from typing import Any

import streamlit as st
from PIL import Image

from core.models import ChatTurn
from core.pipeline import RagPipeline
from pipeline_factory import create_pipeline, pil_from_upload
from settings import get_settings


@st.cache_resource(show_spinner=False)
def build_pipeline() -> RagPipeline:
    return create_pipeline()


def _doc_label_map(ingested_docs: list[dict[str, Any]]) -> dict[str, str]:
    labels: dict[str, str] = {}
    for entry in ingested_docs:
        doc_id = str(entry["doc_id"])
        source_name = str(entry["source_name"])
        labels[doc_id] = f"{source_name} ({doc_id[:8]})"
    return labels


def _valid_defaults(defaults: list[str], options: list[str]) -> list[str]:
    option_set = set(options)
    return [item for item in defaults if item in option_set]


def main() -> None:
    settings = get_settings()
    st.set_page_config(page_title="OCR RAG Chat", page_icon=":page_facing_up:", layout="wide")
    st.title("OCR to RAG Chat")
    st.caption("Upload an image, index OCR chunks, then chat with retrieved context.")

    if not settings.openai_api_key:
        st.warning("Set OPENAI_API_KEY in your environment or .env before chatting.")

    if "messages" not in st.session_state:
        st.session_state.messages = []
    if "ingested_docs" not in st.session_state:
        st.session_state.ingested_docs = []
    if "failed_uploads" not in st.session_state:
        st.session_state.failed_uploads = []
    if "ocr_text_by_doc" not in st.session_state:
        st.session_state.ocr_text_by_doc = {}
    if "active_doc_ids" not in st.session_state:
        st.session_state.active_doc_ids = []
    if "chunk_filter_doc_ids" not in st.session_state:
        st.session_state.chunk_filter_doc_ids = []

    pipeline = build_pipeline()

    with st.sidebar:
        st.subheader("Ingest Document")
        uploaded_files = st.file_uploader(
            "Upload image(s)",
            type=["png", "jpg", "jpeg", "webp"],
            accept_multiple_files=True,
        )
        ingest_button = st.button("Run OCR + Index", type="primary")
        retry_button = st.button(
            "Retry failed files",
            disabled=not st.session_state.failed_uploads,
        )

        if ingest_button:
            if not uploaded_files:
                st.error("Please upload at least one image first.")
            else:
                with st.spinner("Running OCR and indexing chunks..."):
                    queued_images: list[tuple[Image.Image, str]] = []
                    source_to_bytes: dict[str, list[bytes]] = {}
                    decode_failures: list[dict[str, Any]] = []
                    for uploaded in uploaded_files:
                        file_bytes = uploaded.getvalue()
                        source_to_bytes.setdefault(uploaded.name, []).append(file_bytes)
                        try:
                            image = pil_from_upload(file_bytes)
                        except Exception as exc:
                            decode_failures.append(
                                {
                                    "source_name": uploaded.name,
                                    "file_bytes": file_bytes,
                                    "error": f"Failed to decode image: {exc}",
                                }
                            )
                            continue
                        queued_images.append((image, uploaded.name))

                    result = pipeline.ingest_images(images=queued_images) if queued_images else None
                    if result:
                        for success in result.successes:
                            st.session_state.ingested_docs.append(
                                {
                                    "source_name": success.source_name,
                                    "doc_id": success.doc_id,
                                    "chunk_count": success.chunk_count,
                                }
                            )
                            st.session_state.ocr_text_by_doc[success.doc_id] = success.ocr_text
                            if success.source_name in source_to_bytes and source_to_bytes[success.source_name]:
                                source_to_bytes[success.source_name].pop(0)

                    pipeline_failures = []
                    if result:
                        for failure in result.failures:
                            failed_bytes = b""
                            if failure.source_name in source_to_bytes and source_to_bytes[failure.source_name]:
                                failed_bytes = source_to_bytes[failure.source_name].pop(0)
                            pipeline_failures.append(
                                {
                                    "source_name": failure.source_name,
                                    "file_bytes": failed_bytes,
                                    "error": failure.error,
                                }
                            )

                    st.session_state.failed_uploads = decode_failures + pipeline_failures
                    success_count = len(result.successes) if result else 0
                    failure_count = len(st.session_state.failed_uploads)
                    st.success(f"Bulk ingest completed: {success_count} success, {failure_count} failed.")
                    if failure_count:
                        st.warning("You can click 'Retry failed files' to retry only failed items.")

        if retry_button and st.session_state.failed_uploads:
            with st.spinner("Retrying failed files..."):
                queued_images: list[tuple[Image.Image, str]] = []
                source_to_bytes: dict[str, list[bytes]] = {}
                decode_failures: list[dict[str, Any]] = []
                for failed in st.session_state.failed_uploads:
                    source_name = str(failed["source_name"])
                    file_bytes = bytes(failed["file_bytes"])
                    source_to_bytes.setdefault(source_name, []).append(file_bytes)
                    try:
                        image = pil_from_upload(file_bytes)
                    except Exception as exc:
                        decode_failures.append(
                            {
                                "source_name": source_name,
                                "file_bytes": file_bytes,
                                "error": f"Failed to decode image: {exc}",
                            }
                        )
                        continue
                    queued_images.append((image, source_name))

                result = pipeline.retry_failed_images(images=queued_images) if queued_images else None
                if result:
                    for success in result.successes:
                        st.session_state.ingested_docs.append(
                            {
                                "source_name": success.source_name,
                                "doc_id": success.doc_id,
                                "chunk_count": success.chunk_count,
                            }
                        )
                        st.session_state.ocr_text_by_doc[success.doc_id] = success.ocr_text
                        if success.source_name in source_to_bytes and source_to_bytes[success.source_name]:
                            source_to_bytes[success.source_name].pop(0)

                retry_failures = []
                if result:
                    for failure in result.failures:
                        failed_bytes = b""
                        if failure.source_name in source_to_bytes and source_to_bytes[failure.source_name]:
                            failed_bytes = source_to_bytes[failure.source_name].pop(0)
                        retry_failures.append(
                            {
                                "source_name": failure.source_name,
                                "file_bytes": failed_bytes,
                                "error": failure.error,
                            }
                        )

                st.session_state.failed_uploads = decode_failures + retry_failures
                retry_successes = len(result.successes) if result else 0
                remaining_failures = len(st.session_state.failed_uploads)
                st.success(f"Retry completed: {retry_successes} success, {remaining_failures} still failed.")

        st.subheader("Retrieval Options")
        top_k = st.slider("Top-K Chunks", min_value=1, max_value=10, value=settings.rag_top_k)
        doc_label_map = _doc_label_map(st.session_state.ingested_docs)
        doc_options = list(doc_label_map.keys())
        chat_filter_defaults = _valid_defaults(st.session_state.active_doc_ids, doc_options)
        st.session_state.active_doc_ids = st.multiselect(
            "Filter chat to document(s) (optional)",
            options=doc_options,
            default=chat_filter_defaults,
            format_func=lambda doc_id: doc_label_map.get(doc_id, doc_id),
        )

        if st.session_state.ingested_docs:
            st.caption(f"Indexed documents: {len(st.session_state.ingested_docs)}")
        if st.session_state.failed_uploads:
            st.error(f"Failed uploads pending retry: {len(st.session_state.failed_uploads)}")
            for failed in st.session_state.failed_uploads:
                st.write(f"- {failed['source_name']}: {failed['error']}")

    chat_tab, indexed_chunks_tab = st.tabs(["Chat", "Indexed Chunks"])

    with chat_tab:
        with st.expander("OCR Text Preview", expanded=False):
            doc_label_map = _doc_label_map(st.session_state.ingested_docs)
            doc_options = list(doc_label_map.keys())
            if not doc_options:
                st.write("No OCR output yet.")
            else:
                preview_doc_id = st.selectbox(
                    "Preview document",
                    options=doc_options,
                    index=len(doc_options) - 1,
                    format_func=lambda doc_id: doc_label_map.get(doc_id, doc_id),
                )
                st.write(st.session_state.ocr_text_by_doc.get(preview_doc_id, "No OCR output yet."))

        for message in st.session_state.messages:
            with st.chat_message(message["role"]):
                st.markdown(message["content"])

        question = st.chat_input("Ask about your indexed documents...")
        if question:
            st.session_state.messages.append({"role": "user", "content": question})
            with st.chat_message("user"):
                st.markdown(question)

            history = [ChatTurn(role=m["role"], content=m["content"]) for m in st.session_state.messages[:-1]]
            with st.chat_message("assistant"):
                with st.spinner("Retrieving and generating answer..."):
                    selected_doc_ids = st.session_state.active_doc_ids or None
                    answer, hits = pipeline.ask(
                        question=question,
                        top_k=top_k,
                        doc_ids=selected_doc_ids,
                        history=history,
                    )
                    st.markdown(answer)
                    with st.expander("Retrieved chunks"):
                        if not hits:
                            st.write("No relevant chunks found.")
                        for idx, hit in enumerate(hits, start=1):
                            st.markdown(f"**{idx}. score={hit.score:.4f}, source={hit.chunk.source}**")
                            st.write(hit.chunk.text)

            st.session_state.messages.append({"role": "assistant", "content": answer})

    with indexed_chunks_tab:
        st.subheader("Indexed Chunks Browser")
        st.caption("Browse chunk payloads currently stored in the vector index.")
        doc_label_map = _doc_label_map(st.session_state.ingested_docs)
        doc_options = list(doc_label_map.keys())
        chunk_filter_defaults = _valid_defaults(st.session_state.chunk_filter_doc_ids, doc_options)
        st.session_state.chunk_filter_doc_ids = st.multiselect(
            "Filter by document(s) (optional)",
            options=doc_options,
            default=chunk_filter_defaults,
            format_func=lambda doc_id: doc_label_map.get(doc_id, doc_id),
        )
        list_limit = st.slider("Chunk list limit", min_value=10, max_value=1000, value=200, step=10)

        try:
            chunks = pipeline.list_indexed_chunks(
                doc_ids=st.session_state.chunk_filter_doc_ids or None,
                limit=list_limit,
            )
        except Exception as exc:  # pragma: no cover - UI-level safety
            st.exception(exc)
            return

        st.write(f"Loaded **{len(chunks)}** chunk(s).")
        if not chunks:
            st.info("No chunks indexed yet.")
        for idx, chunk in enumerate(chunks, start=1):
            with st.expander(
                f"{idx}. source={chunk.source}, doc_id={chunk.doc_id}, chunk_index={chunk.chunk_index}",
                expanded=False,
            ):
                st.write(chunk.text)


if __name__ == "__main__":
    main()
