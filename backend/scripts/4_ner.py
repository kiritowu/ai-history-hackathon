from pathlib import Path
from typing import Any, List, Optional, Iterable
from dotenv import load_dotenv
import re
import spacy
import json
import os

nlp = spacy.load("en_core_web_sm")

load_dotenv(override=True)

OCR_DIR = Path("OCRd")
NER_DIR = Path("ner")

files = [p for p in OCR_DIR.iterdir() if p.is_file()]

# spacy label to group mappings (reduce to 3 groups - "agent", "where_when", "other")
LABEL_TO_GROUP = {
    # agents
    "PERSON": "agent",
    "NORP": "agent",
    "ORG": "agent",
    # where / when
    "GPE": "where_when",
    "LOC": "where_when",
    "FAC": "where_when",
    "DATE": "where_when",
    "TIME": "where_when",
}

texts = [
    "Apple is looking at buying a U.K. startup for $1 billion.",
    "Elon Musk founded SpaceX in California.",
    "Google is based in Mountain View.",
]


all_entities = []  # <- this will be your list of lists

for doc in nlp.pipe(texts):
    doc_entities = [
        {
            "start": ent.start_char,
            "end": ent.end_char,
            "label": LABEL_TO_GROUP.get(ent.label_, "other"),
            "original_label": ent.label_,
            "text": ent.text,
        }
        for ent in doc.ents
    ]

    all_entities.append(doc_entities)

# all_entities is now List[List[Dict]]
print(len(all_entities))
print(all_entities[0])

# for f in files[:1]:
#     with open(f, "r", encoding="utf-8") as f:
#         text = f.read()

#     source_name = f.name.replace(".txt", "").replace("OCRd/", "")

#     # Split on page headers. Create a tuple of (sourceName, pageNo, text)
#     original_text = "\n\n\n\n".join(
#         [
#             content.strip()
#             for page_no, content in re.findall(
#                 r"^===== Page (\d+) =====\s*\n(.*?)(?=^===== Page \d+ =====|\Z)", text, flags=re.S | re.M
#             )
#         ]
#     )

#     path_out = f"{source_name}_ner.json"

#     # doc = nlp(original_text)
#     doc = nlp.pipe(["my name is jaek", "tom is my friend"], batch_size=8, n_process=8)

#     data = {
#         "entities": [
#             {
#                 "start": ent.start_char,
#                 "end": ent.end_char,
#                 # map spaCy label -> 3-category label... if not in category, put under "other"
#                 "label": LABEL_TO_GROUP.get(ent.label_, "other"),
#                 # optional but useful for debugging / tooltips
#                 "original_label": ent.label_,
#                 "text": ent.text,
#             }
#             for ent in doc.ents
#         ],
#     }

#     # with open(NER_DIR / path_out, "w", encoding="utf-8") as f:
#     #     json.dump(data, f, ensure_ascii=False)
