# OCR to RAG Chat App

Lean OCR -> vector retrieval -> chat pipeline built with:

- PaddleOCR-VL server mode (`paddleocr` + `PaddleOCRVL`)
- Weaviate Cloud as vector store
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
    "gcs_uri": "gs://my-bucket/path/to/document.pdf"
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
- `source_name` is derived automatically from the URI filename.
- PDF ingestion is page-based: one indexed chunk per OCR page.
- Configure Google credentials for `google-cloud-storage` (for example with `GOOGLE_APPLICATION_CREDENTIALS`).
- Optional:
  - `GCP_PROJECT=<your-project-id>`

## Local SSO PDF Scraper

The standalone scraper has been moved out of backend and now lives in `scraper/`.
See `scraper/README.md` for setup and run instructions.

## Weaviate Configuration

- Weaviate Cloud:
  - `WEAVIATE_URL=https://<cluster-id>.weaviate.network`
  - `WEAVIATE_API_KEY=<your-api-key>`
  - `WEAVIATE_COLLECTION=DocumentChunk`
- Embeddings are generated externally by the backend embedder and upserted with vectors.

## Cloud Run Deployment (vLLM)

This repo includes scripts/config to deploy OCR service on Cloud Run:

- OCR service: `PaddlePaddle/PaddleOCR-VL-1.5`

### Deploy Steps

1. Copy deploy env template:

```bash
cp deploy/cloudrun/env.sh.example deploy/cloudrun/env.sh
```

2. Edit `deploy/cloudrun/env.sh` with project/region and sizing.

3. Deploy OCR service with your Cloud Run deploy script:

```bash
# Example:
# bash deploy/cloudrun/scripts/<your-ocr-deploy-script>.sh
```

The script prints the OCR service URL.

### Cloud Validation

```bash
curl "${OCR_SERVICE_URL}/v1/models"
```

### App Env for Cloud Inference

Set these in your app `.env` after deployment:

```bash
PADDLEOCR_VL_SERVER_URL=${OCR_SERVICE_URL}/v1
PADDLEOCR_VL_BACKEND=vllm-server
PADDLEOCR_VL_API_MODEL_NAME=PaddlePaddle/PaddleOCR-VL-1.5
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
