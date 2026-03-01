# Straits Cipher

Straits Cipher is a grounded AI-history research experience that transforms archival documents into citation-backed answers, source-level context, and interactive knowledge maps.

[![Built for Singapore History + AI Hackathon](https://img.shields.io/badge/Singapore%20History%20%2B%20AI%20Hackathon-Grounded%20RAG-0EA5E9?style=for-the-badge)](https://ai-history-hackathon-529573690692.asia-southeast1.run.app)

## Showcase

Demo Video on YouTube

[![Watch the demo on YouTube](https://img.youtube.com/vi/I2_FPGli96Y/maxresdefault.jpg)](https://youtu.be/I2_FPGli96Y)

Check out the live deployment at:  

https://ai-history-hackathon-529573690692.asia-southeast1.run.app

## The Problem

Historical research is slow when primary sources are fragmented across scanned PDFs, OCR quality is inconsistent, and answers are hard to verify.

Most chat tools optimize for fluency, not evidence. For history workflows, that is not enough.

## Our Solution

Straits Cipher combines an OCR-to-RAG ingestion pipeline with a modern chat UI so users can:

- Indexed 6900+ pages of CO 273: Straits Settlements Original Correspondence from 1940+
- Ask complex history questions and receive citation-backed answers.
- Inspect supporting source snippets and relevance context directly in the interface with page images.
- Continue exploration with suggested follow-up questions.
- See document-to-document relationships through a modernized Kratoska Index interactive cluster map.

## Key Features

### 1) Grounded AI Q&A

Hybrid retrieval (semantic + keyword) over Weaviate collections to improve evidence recall and precision.

### 2) Rich Source Context

Responses are tied to source chunks with metadata, snippets, and citation references to support verification.

### 3) Interactive Exploration

Built-in follow-up suggestions and a visualization page help users move from one question to connected document trails.

### 4) End-to-End Ingestion Pipeline

PDF preprocessing, OCR, embedding, and optional document-summary indexing pipeline for scalable knowledge base growth.

## Tech Stack

### Frontend (`frontend/`)

- **Next.js 15** + **React 18**
- **TypeScript**
- **Tailwind CSS** + Radix UI components
- **AI SDK / OpenAI integrations**
- **D3** for document cluster visualization
- **Weaviate client**

### Backend (`backend/`)

- **Python 3.12** + **uv**
- **FastAPI**-compatible dependency set
- **pdf2image** + OCR pipeline scripts
- **Models used**: `zai-org/GLM-OCR` (OCR), `gpt-4.1-mini` (OCR cleanup), `text-embedding-3-large` (backend embeddings), `gpt-5.2` (document summarization), `text-embedding-3-small` (frontend retrieval), `gpt-5.2` (chat + follow-ups)
- **Weaviate** vector storage
- **GCP Storage** for page image artifacts

## Architecture

```text
┌───────────────────────────────────────────────────────┐
│                  Frontend (Next.js)                  │
│  • Chat interface with citations                     │
│  • Follow-up prompts and source context panel        │
│  • Document relationship visualization (/visualize)  │
└───────────────────────┬───────────────────────────────┘
                        │
                        │ API routes + retrieval layer
                        │
┌───────────────────────▼───────────────────────────────┐
│                 Retrieval + LLM Layer                │
│  • Hybrid search against Weaviate                    │
│  • Grounded response composition                     │
│  • Follow-up suggestion generation                   │
└───────────────────────┬───────────────────────────────┘
                        │
                        │ Indexed chunks + summaries
                        │
┌───────────────────────▼───────────────────────────────┐
│               Backend Ingestion Pipeline              │
│  0_rename -> 1_convert_to_png -> 2_OCR -> 3_embed    │
│                     -> 5_doc_summary_embed            │
└───────────────────────────────────────────────────────┘
```

## Getting Started

### Option A: Use the deployed app (Recommended)

Open:

`https://ai-history-hackathon-529573690692.asia-southeast1.run.app`

Quick checks:

1. Ask a question and verify citation-backed responses.
2. Open `/visualize` and confirm the document cluster graph renders.

### Option B: Run locally

For local setup and run instructions, use:

- `frontend/README.md` for frontend setup and environment variables.
- `backend/README.md` for ingestion prerequisites, bootstrap, and pipeline commands.

## Environment Variables

### Frontend (`frontend/.env.local`)

Required:

- `WEAVIATE_API_KEY`
- `OPENAI_API_KEY`

Commonly used:

- `WEAVIATE_URL`
- `WEAVIATE_COLLECTION`
- `WEAVIATE_CLUSTERS_COLLECTION`
- `WEAVIATE_HYBRID_ALPHA`
- `OPENAI_CHAT_MODEL`
- `OPENAI_EMBEDDING_MODEL`
- `OPENAI_FOLLOWUP_MODEL`
- `NEXT_PUBLIC_API_URL`

### Backend (`backend/.env`)

Common requirements:

- `OPENAI_API_KEY`
- `WEAVIATE_URL`
- `WEAVIATE_API_KEY`
- GCP credentials for `google-cloud-storage`

## Important Note

In `backend/scripts/pipeline/2_OCR.py`, the OCR run/write section is currently commented out. As written, it will not emit `OCRd/*.txt` outputs until that block is uncommented.

## Why Straits Cipher

> Better historical AI starts with verifiable evidence, not just polished text.

Straits Cipher is designed for researchers, students, and curious readers who want fast exploration without losing traceability to source documents.
