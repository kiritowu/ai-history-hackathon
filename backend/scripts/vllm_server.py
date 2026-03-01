import modal


vllm_image = (
    modal.Image.from_registry("nvidia/cuda:12.8.0-devel-ubuntu22.04", add_python="3.12")
    .entrypoint([])
    .apt_install("git", "wget")
    .pip_install("vllm", extra_options="--extra-index-url https://wheels.vllm.ai/nightly")
    .uv_pip_install(
        "huggingface-hub",
        "flashinfer-python",
        "requests",
        "git+https://github.com/huggingface/transformers.git",
    )
    .env({"HF_XET_HIGH_PERFORMANCE": "1"})  # faster model transfers
)

hf_cache_vol = modal.Volume.from_name("huggingface-cache", create_if_missing=True)
vllm_cache_vol = modal.Volume.from_name("vllm-cache", create_if_missing=True)
app = modal.App("vllm-server")

API_TOKEN = "pass123"
FAST_BOOT = False  # True if we want to disable graph compilation, so we can have faster boots. False to have faster inference, but more VRAM consumed

VLLM_PORT = 8000


CONFIGS = {
    "paddleOCR-VL": {  # Needs 4GB vRAM
        "MODEL_NAME": "PaddlePaddle/PaddleOCR-VL",
        "GPU": "T4",
        "N_GPU": 1,
        "args": [],
    },
    "GLM-OCR": {  # Needs 4GB vRAM
        "MODEL_NAME": "zai-org/GLM-OCR",
        "GPU": "L40S",
        "N_GPU": 1,
        "args": [],
    },
}

CHOSEN = CONFIGS["GLM-OCR"]


@app.function(
    image=vllm_image,
    gpu=f"{CHOSEN['GPU']}:{CHOSEN['N_GPU']}",
    scaledown_window=1800,  # If no requests in 5 mins, shut down the server
    timeout=300,  # If the container's execution time exceeds 5 mins,  exit..
    # startup_timeout=600,  # If container doesn't start up in 10 mins, don't run it...
    volumes={
        "/root/.cache/huggingface": hf_cache_vol,
        "/root/.cache/vllm": vllm_cache_vol,
    },
    enable_memory_snapshot=True,  # Allow CPU memory snapshot
    secrets=[modal.Secret.from_name("huggingface-secret")],
)
@modal.concurrent(max_inputs=8)  # how many requests can one replica handle?
@modal.web_server(port=VLLM_PORT, startup_timeout=600)
def serve():
    import subprocess

    cmd = [
        "vllm",
        "serve",
        "--uvicorn-log-level=info",
        CHOSEN["MODEL_NAME"],
        "--trust-remote-code",
        "--dtype",
        "half",  # This is always "fp16". It doesn't mean "take the current dtype and halve it"
        "--host",
        "0.0.0.0",
        "--port",
        str(VLLM_PORT),
        "--api-key",
        API_TOKEN,
        "--tensor-parallel-size",
        str(CHOSEN["N_GPU"]),
        "--gpu-memory-utilization",  # Fraction of GPU memory that vLLM will use. Increase to allow more KV cache, weights
        "0.9",
        # "--max-model-len",
        # "8192",  # 4096
        "--max-num-seqs",  # Amount of concurrent requests supported. Lower amount = reduce KV cache usage
        "12",
        # "--cpu-offload-gb",
        # "8",
        "--mm-processor-cache-gb",
        "0",
        "--max-num-batched-tokens",
        "8192",
    ]

    # enforce-eager disables both Torch compilation and CUDA graph capture
    # default is no-enforce-eager. see the --compilation-config flag for tighter control
    cmd += ["--enforce-eager" if FAST_BOOT else "--no-enforce-eager"]

    cmd += CHOSEN["args"]

    print(cmd)

    subprocess.Popen(" ".join(cmd), shell=True)


# When we do `modal run vllm_server.py`, we run the function below. However, once the code below finishes running, modal will exit - and our vLLM server shuts down...
# If we run "modal serve vllm_server.py", it won't run the function below. We need to externally call our endpoint in order to trigger a container creation. However, the vLLM server will continuously run until we press ctrl + C in the terminal
@app.local_entrypoint()
async def test():
    print("Running local file!")
    import requests

    ENDPOINT = serve.get_web_url()

    url = f"{ENDPOINT}/v1/chat/completions"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {API_TOKEN}"}

    data = {
        "model": CHOSEN["MODEL_NAME"],
        "messages": [{"role": "user", "content": "Hello!"}],
    }

    response = requests.post(url, headers=headers, json=data)
    print(response.json())
