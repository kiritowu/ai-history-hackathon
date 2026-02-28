from openai import OpenAI
import base64
from pdf2image import convert_from_path
import io


def pil_to_data_url(img, fmt="PNG"):
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    mime = "image/png" if fmt.upper() == "PNG" else "image/jpeg"
    return f"data:{mime};base64,{b64}"


pages = convert_from_path("test.pdf", dpi=200)
page_urls = [pil_to_data_url(p, "PNG") for p in pages]


ENDPOINT = "https://usehovrapp--vllm-server-serve.modal.run"
api_key = "pass123"
MODEL_NAME = "PaddlePaddle/PaddleOCR-VL"

url = f"{ENDPOINT}/v1"

client = OpenAI(api_key=api_key, base_url=url, timeout=3600)


# from paddleocr import PaddleOCRVL

# doclayout_model_path = "/path/to/your/PP-DocLayoutV2/"

# pipeline = PaddleOCRVL(
#     vl_rec_backend="vllm-server",
#     vl_rec_server_url=url,
#     layout_detection_model_name="PP-DocLayoutV2",
# )

# output = pipeline.predict("https://paddle-model-ecology.bj.bcebos.com/paddlex/imgs/demo_image/paddleocr_vl_demo.png")

# for i, res in enumerate(output):
#     res.save_to_json(save_path=f"output_{i}.json")
#     res.save_to_markdown(save_path=f"output_{i}.md")

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
                # "url": "https://ofasys-multimodal-wlcb-3-toshanghai.oss-accelerate.aliyuncs.com/wpf272043/keepme/image/receipt.png"
                # },
                "image_url": {"url": page_urls[0]},
            },
            {"type": "text", "text": TASKS["ocr"]},
        ],
    }
]

response = client.chat.completions.create(
    model="PaddlePaddle/PaddleOCR-VL",
    messages=messages,
    temperature=0.0,
)
print(f"Generated text: {response.choices[0].message.content}")
