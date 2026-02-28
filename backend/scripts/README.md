Concurrency is handled by 2 params
- `max-num-seqs` param in `vllm serve`: Number of API requests one vllm server can process simultaneously
- `max-inputs` in `@modal.concurrent(max_inputs=4)`: Number of inputs each modal container can handle... if total requests exceeds this, modal will spin up more containers

These 2 values should be the same!


We define the `max_concurrency` param in our `ocr_all_to_file()` function, which sets the asyncio semaphore (i.e. max concurrent async requests at any given time...). This is the main driver of concurrency!




Bucket naming preprocessing
- Take the first 3 words + last 2 words of the filename. Then, replace "/" with "_". Lowercase everything. This is used as the folder name