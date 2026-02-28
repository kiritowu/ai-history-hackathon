from openai import OpenAI, AsyncOpenAI
import base64
from pdf2image import convert_from_path
import io
import pathlib
import pickle


def pil_to_data_url(img, fmt="PNG"):
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    mime = "image/png" if fmt.upper() == "PNG" else "image/jpeg"
    return f"data:{mime};base64,{b64}"


DATA_DIR = pathlib.Path("data")
PREPROCESSED_DIR = pathlib.Path("preprocessed")

# pages = convert_from_path(
#     DATA_DIR / "Petitions. Mr. S. Sinnadurai, formerly class III clerk, Posts and Telegraphs Department.pdf", dpi=150
# )
# page_urls = [pil_to_data_url(p, "PNG") for p in pages]


with open(PREPROCESSED_DIR / "Petitions. Che Saffiah binti Laxamana Mohamed Amin.pdf.pkl", "rb") as file:
    page_urls = pickle.load(file)


ENDPOINT = "https://usehovrapp--vllm-server-serve.modal.run"
api_key = "pass123"
MODEL_NAME = "zai-org/GLM-OCR"
# MODEL_NAME = "PaddlePaddle/PaddleOCR-VL"

url = f"{ENDPOINT}/v1"

client = OpenAI(api_key=api_key, base_url=url, timeout=3600)

# Task-specific base prompts
TASKS = {
    "ocr": "OCR:",
    "table": "Table Recognition:",
    "formula": "Formula Recognition:",
    "chart": "Chart Recognition:",
}

messages = [
    {
        "role": "user",
        "content": [
            {
                "type": "image_url",
                # "image_url": {
                #     "url": "https://ofasys-multimodal-wlcb-3-toshanghai.oss-accelerate.aliyuncs.com/wpf272043/keepme/image/receipt.png"
                # },
                "image_url": {"url": page_urls[2]},
            },
            {"type": "text", "text": "Text Recognition:"},
        ],
    }
]

response = client.chat.completions.create(
    model=MODEL_NAME,
    messages=messages,
    temperature=0.0,
)
print(f"Generated text: {response.choices[0].message.content}")
