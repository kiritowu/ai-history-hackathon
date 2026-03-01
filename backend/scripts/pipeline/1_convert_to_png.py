from concurrent.futures import ProcessPoolExecutor, as_completed
from pdf2image import convert_from_path
import io
from google.cloud import storage
from io import BytesIO
from pathlib import Path
import base64
import pickle
from google.cloud import storage
from dotenv import load_dotenv
import re

import asyncio

load_dotenv(override=True)

client = storage.Client()

DATA_DIR = Path("data")
OUT_DIR = Path("preprocessed")

BUCKET_NAME = "ai-history-hackathon-bucket"


bucket = client.bucket(BUCKET_NAME)

processed_images_filename = "img_processed.txt"
with open(processed_images_filename, "r", encoding="utf-8") as f:
    processed_items = f.read().splitlines()


# Will also upload to google cloud storage... as /imgs/<First 3 words + Last 3 words>/<pageNo>.png
async def process_pdf_async(
    pdf_path: Path,
    out_dir: Path,
    bucket_name: str,
    dpi: int = 150,
    max_concurrency: int = 8,
) -> Path:

    filename = pdf_path.stem
    match = re.search(r"^(.*?)__\s*(CO\s*\d+:\d+:\d+)", filename)

    if match:
        name = match.group(1)
        co_number = match.group(2).replace(" ", "")  # remove the spacing, so we get COXYZ instead of CO xyz

    words = name.split()
    selected = words if len(words) <= 5 else (words[:3] + words[-2:])
    folder_name = co_number + "__" + "_".join(selected).lower()

    pages = convert_from_path(str(pdf_path), dpi=dpi)

    page_urls = [None] * len(pages)
    sem = asyncio.Semaphore(max_concurrency)

    def upload(object_name: str, data: bytes):
        # thread-safe: client created inside thread
        client = storage.Client()
        bucket = client.bucket(bucket_name)
        bucket.blob(object_name).upload_from_string(data, content_type="image/png")

    async def handle_page(i: int, img):
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        png_bytes = buf.getvalue()

        # keep list ordered
        page_urls[i] = "data:image/png;base64," + base64.b64encode(png_bytes).decode()

        object_name = f"imgs/{folder_name}/{i + 1}.png"

        async with sem:
            await asyncio.to_thread(upload, object_name, png_bytes)

        print(f"Uploaded: gs://{bucket_name}/{object_name}")

    await asyncio.gather(*(handle_page(i, img) for i, img in enumerate(pages)))

    out_path = out_dir / f"{pdf_path.name}.pkl"
    with open(out_path, "wb") as f:
        pickle.dump(page_urls, f)

    return out_path


def main():
    pdfs = list(DATA_DIR.glob("*.pdf"))

    for pdf in pdfs:
        if pdf.name in processed_items:
            print(f"Skipping! Already processed {pdf}...")
            continue
        print(pdf)

        out_path = asyncio.run(
            process_pdf_async(
                pdf_path=pdf,
                out_dir=OUT_DIR,
                bucket_name=BUCKET_NAME,
                dpi=150,
                max_concurrency=8,
            )
        )

        print("Saved:", out_path)

        # Track which docs have been OCRd
        with open(processed_images_filename, "a", encoding="utf-8") as outfile:
            outfile.write(pdf.name + "\n")


if __name__ == "__main__":
    main()
