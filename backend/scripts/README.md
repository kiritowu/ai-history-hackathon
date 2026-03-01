# Backend Scripts

This directory organizes backend scripts by purpose:

- `pipeline/`: main ingestion pipeline scripts (`0_rename.py` to `5_doc_summary_embed.py`)
- `infra/`: infrastructure and deployment scripts (`setup_weaviate.py`, `vllm_server.py`)
- `dev/`: ad-hoc local test scripts (`test_ocr.py`, `test_gcp_storage.py`)

## How to run

Run all scripts from the `backend/` directory so relative paths resolve correctly (`data/`, `preprocessed/`, `OCRd/`, `*_processed.txt`, etc.).

## Current ingestion behavior

- Input PDFs are discovered from `backend/data/*.pdf`.
- `0_rename.py` normalizes names to `Title__CO123:456:789.pdf` (when source names match its regex).
- `1_convert_to_png.py` reads from `data/`, writes `preprocessed/*.pdf.pkl`, uploads page PNGs to GCS, and tracks processed files in `img_processed.txt`.
- `2_OCR.py` reads `preprocessed/*.pkl` and writes OCR output to `OCRd/*.txt`.
- `3_embed.py` reads `OCRd/*.txt` and uploads vectors to Weaviate while tracking progress in `embed_processed.txt`.

Before first run, make sure these files exist (empty is OK): `img_processed.txt`, `ocr_processed.txt`, `embed_processed.txt`, `doc_summary_processed.txt`.

Current code note: `2_OCR.py` has the OCR run/write section commented out at the moment, so it will not emit `OCRd/*.txt` unless that section is uncommented.

Example:

```bash
cd ./backend
python scripts/pipeline/0_rename.py
python scripts/pipeline/1_convert_to_png.py
python scripts/pipeline/2_OCR.py
python scripts/pipeline/3_embed.py
python scripts/infra/setup_weaviate.py
modal run scripts/infra/vllm_server.py
python scripts/dev/test_ocr.py
python scripts/dev/test_gcp_storage.py
```
