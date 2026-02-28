from openai import OpenAI, AsyncOpenAI
import pathlib
import pickle
import asyncio


PREPROCESSED_DIR = pathlib.Path("preprocessed")
EXTRACTED_DIR = pathlib.Path("OCRd")

# Keep track of which files have been processed, so we don't repeat
processed_text_filename = "processed.txt"

with open(processed_text_filename, "r", encoding="utf-8") as f:
    processed_items = f.read().splitlines()

# with open(PREPROCESSED_DIR / "Petitions. Che Saffiah binti Laxamana Mohamed Amin.pdf.pkl", "rb") as file:
#     page_urls = pickle.load(file)


ENDPOINT = "https://usehovrapp--vllm-server-serve.modal.run"
api_key = "pass123"
MODEL_NAME = "zai-org/GLM-OCR"

url = f"{ENDPOINT}/v1"

client = AsyncOpenAI(api_key=api_key, base_url=url, timeout=3600)


def build_messages(page_url: str):
    return [
        {
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": page_url}},
                {"type": "text", "text": "Text Recognition:"},
            ],
        }
    ]


async def ocr_one(idx: int, page_url: str, sem: asyncio.Semaphore):
    async with sem:
        resp = await client.chat.completions.create(
            model=MODEL_NAME,
            messages=build_messages(page_url),
            temperature=0.0,
        )
        print(resp.json())
        text = resp.choices[0].message.content
        return idx, text


async def ocr_all_to_file(
    page_urls,
    output_path: str,
    max_concurrency: int = 8,
):
    sem = asyncio.Semaphore(max_concurrency)

    tasks = [ocr_one(i, url, sem) for i, url in enumerate(page_urls)]

    # Run everything in parallel
    results = await asyncio.gather(*tasks)

    # Ensure page order
    results.sort(key=lambda x: x[0])

    # Write sequentially
    with open(EXTRACTED_DIR / output_path, "w", encoding="utf-8") as f:
        for idx, text in results:
            f.write(f"===== Page {idx + 1} =====\n")
            f.write(text)
            f.write("\n\n")


for f in PREPROCESSED_DIR.glob("*.pkl"):
    name = f.name.replace(".pdf.pkl", "")
    if name in processed_items:
        print(f"Already processed {name}. Skipping...")
        continue

    with open(f, "rb") as file:
        page_urls = pickle.load(file)
        print(f"Extracting text for {name}")
        asyncio.run(
            ocr_all_to_file(
                page_urls,
                output_path=f"{name}.txt",
                max_concurrency=8,
            )
        )

    # Track which docs have been OCRd
    with open(processed_text_filename, "a", encoding="utf-8") as outfile:
        outfile.write(name + "\n")
