import os

import weaviate.classes as wvc
from weaviate.classes.config import Configure, Property, DataType
import weaviate
from weaviate.classes.init import Auth

from dotenv import load_dotenv

load_dotenv(override=True)

# Best practice: store your credentials in environment variables
weaviate_url = os.environ["WEAVIATE_URL"]
weaviate_api_key = os.environ["WEAVIATE_API_KEY"]

# Connect to Weaviate Cloud
client = weaviate.connect_to_weaviate_cloud(
    cluster_url=weaviate_url,
    auth_credentials=Auth.api_key(weaviate_api_key),
)

# Create the collection. Weaviate's autoschema feature will infer properties when importing.
questions = client.collections.create(
    "historyCollections3",
    vector_config=wvc.config.Configure.Vectors.self_provided(),
    properties=[
        Property(name="source", data_type=DataType.TEXT),
        Property(name="text", data_type=DataType.TEXT),
        Property(name="pageNumber", data_type=DataType.INT),
        Property(name="imageUrl", data_type=DataType.TEXT),
        Property(
            name="ner",
            data_type=DataType.OBJECT_ARRAY,
            nested_properties=[
                Property(name="start", data_type=DataType.INT),
                Property(name="end", data_type=DataType.INT),
                Property(name="label", data_type=DataType.TEXT),
                Property(name="original_label", data_type=DataType.TEXT),
                Property(name="text", data_type=DataType.TEXT),
            ],
        ),
    ],
)

client.close()
