# OCR to RAG Chat App

Lean OCR -> vector retrieval -> chat pipeline built with:

- PaddleOCR-VL server mode (`paddleocr` + `PaddleOCRVL`)
- Weaviate (cloud or local) as vector store
- OpenAI chat model for answer generation
- Streamlit UI
- `uv` for dependency management

## Architecture

The app follows interface-driven design so providers can be swapped with minimal code changes:

- `OCRProvider` -> document/image to raw text
- `Embedder` -> text to vectors
- `VectorStore` -> persist/query chunk vectors
- `ChatService` -> generate answer from retrieved context
- `RagPipeline` -> orchestration layer

## Prerequisites

- Python 3.12+
- `uv` installed
- Docker running (only for local Weaviate)
- OpenAI API key
- MLX-VLM inference server for PaddleOCR-VL (Apple Silicon flow)
- `gcloud` CLI (for Cloud Run deployment flow)

## Setup

1. Install dependencies:

   ```bash
   uv sync
   ```

2. Start MLX-VLM inference server (required before OCR ingestion):

   ```bash
   uv run mlx_vlm.server --port 8111
   ```

   Keep this process running while using the app.

3. Create environment file:

   ```bash
   cp .env.example .env
   ```

4. Set your key in `.env`:

   ```bash
   OPENAI_API_KEY=...
   ```

5. Start Weaviate (skip if using Weaviate Cloud):

   ```bash
   docker compose up -d
   ```

6. Ensure OCR-VL client settings point to MLX server:

   ```bash
   PADDLEOCR_VL_BACKEND=mlx-vlm-server
   PADDLEOCR_VL_SERVER_URL=http://127.0.0.1:8111/
   PADDLEOCR_VL_API_MODEL_NAME=PaddlePaddle/PaddleOCR-VL-1.5
   ```

## Run

Run the app with Streamlit:

```bash
uv run streamlit run src/app.py
```

Open the local Streamlit URL, then:

1. Upload one or many images in the sidebar.
2. Click **Run OCR + Index**.
3. If some files fail, click **Retry failed files** to retry only failures.
4. Ask questions in chat input (defaults to searching across all indexed docs).
5. Optionally filter chat/chunk browsing by selected document(s).
6. Expand **Retrieved chunks** to inspect RAG context.

## Run Backend API (FastAPI)

Start the backend server:

```bash
uv run uvicorn api.main:app --app-dir src --reload
```

The API docs are available at `http://127.0.0.1:8000/docs`.

### API Smoke Examples

Health:

```bash
curl http://127.0.0.1:8000/health
```

Single ingest (PDF from GCS):

```bash
curl -X POST "http://127.0.0.1:8000/v1/ingest" \
  -H "Content-Type: application/json" \
  -d '{
    "gcs_uri": "gs://my-bucket/path/to/document.pdf",
    "source_name": "document.pdf"
  }'
```

Ask:

```bash
curl -X POST "http://127.0.0.1:8000/v1/ask" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What are the key points?",
    "top_k": 4
  }'
```

## OCR Configuration

- Uses `PaddleOCRVL` with:
  - `PADDLEOCR_VL_BACKEND=mlx-vlm-server`
  - `PADDLEOCR_VL_SERVER_URL=http://127.0.0.1:8111/`
  - `PADDLEOCR_VL_API_MODEL_NAME=PaddlePaddle/PaddleOCR-VL-1.5`
- For Apple Silicon setup details and tuning guidance, see PaddleOCR docs:
  - https://www.paddleocr.ai/latest/en/version3.x/pipeline_usage/PaddleOCR-VL-Apple-Silicon.html

## GCS Ingest Configuration

- Ingest payload expects a `gcs_uri` with `gs://bucket/path/file.pdf`.
- Configure Google credentials for `google-cloud-storage` (for example with `GOOGLE_APPLICATION_CREDENTIALS`).
- Optional:
  - `GCP_PROJECT=<your-project-id>`

## Weaviate Configuration

- Weaviate Cloud (preferred):
  - `WEAVIATE_CLOUD_URL=https://<cluster-id>.weaviate.network`
  - `WEAVIATE_CLOUD_API_KEY=<your-api-key>`
  - `WEAVIATE_COLLECTION=DocumentChunk`
- Local fallback:
  - `WEAVIATE_HOST=localhost`
  - `WEAVIATE_HTTP_PORT=8080`
  - `WEAVIATE_GRPC_PORT=50051`

## Embedding Configuration

- Local default:
  - `EMBEDDING_BACKEND=local_sentence_transformer`
  - `EMBEDDING_MODEL_ID=BAAI/bge-m3`
- Cloud vLLM embedding service:
  - `EMBEDDING_BACKEND=openai_compatible`
  - `EMBEDDING_API_BASE_URL=https://<embed-service-url>/v1`
  - `EMBEDDING_API_MODEL=BAAI/bge-m3`
  - `EMBEDDING_API_KEY=EMPTY` (or your gateway key)

## Cloud Run Deployment (vLLM)

This repo includes scripts/config to deploy two services on Cloud Run:

- OCR service: `PaddlePaddle/PaddleOCR-VL-1.5`
- Embedding service: `BAAI/bge-m3`

### Deploy Steps

1. Copy deploy env template:

```bash
cp deploy/cloudrun/env.sh.example deploy/cloudrun/env.sh
```

2. Edit `deploy/cloudrun/env.sh` with project/region and sizing.

3. Deploy both services:

```bash
bash deploy/cloudrun/scripts/deploy-all.sh
```

The script prints OCR and embedding service URLs.

### Cloud Validation

```bash
curl "${OCR_SERVICE_URL}/v1/models"
curl "${EMBED_SERVICE_URL}/v1/models"
curl "${EMBED_SERVICE_URL}/v1/embeddings" \
  -H "Content-Type: application/json" \
  -d '{"model":"BAAI/bge-m3","input":"hello world"}'
```

### App Env for Cloud Inference

Set these in your app `.env` after deployment:

```bash
PADDLEOCR_VL_SERVER_URL=${OCR_SERVICE_URL}/v1
PADDLEOCR_VL_BACKEND=vllm-server
PADDLEOCR_VL_API_MODEL_NAME=PaddlePaddle/PaddleOCR-VL-1.5

EMBEDDING_BACKEND=openai_compatible
EMBEDDING_API_BASE_URL=${EMBED_SERVICE_URL}/v1
EMBEDDING_API_MODEL=BAAI/bge-m3
EMBEDDING_API_KEY=EMPTY
```

## Tests

Run smoke tests:

```bash
uv run pytest
```

## Swapping Components

- OCR engine: change `PADDLEOCR_VL_*` / `src/adapters/ocr_paddle_vl_server.py`
- Embeddings: change `EMBEDDING_*` or replace `src/adapters/embedder_hf.py`.
- Vector DB: implement `VectorStore` in a new adapter (e.g. Qdrant/Chroma).
- Chat model: replace `src/adapters/chat_openai.py` with another `ChatService`.
