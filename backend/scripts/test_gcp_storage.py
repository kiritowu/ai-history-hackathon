from google.cloud import storage
from io import BytesIO

from dotenv import load_dotenv

load_dotenv(override=True)

client = storage.Client()
bucket = client.bucket("ai-history-hackathon-bucket")  # known bucket name
blob = bucket.blob("imgs/1.png")

buf = BytesIO(b"hello")  # example
blob.upload_from_file(buf, content_type="image/png")

print("uploaded")
