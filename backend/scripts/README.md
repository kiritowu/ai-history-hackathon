Concurrency is handled by 2 params
- `max-num-seqs` param in `vllm serve`: Number of API requests one vllm server can process simultaneously
- `max-inputs` in `@modal.concurrent(max_inputs=4)`: Number of inputs each modal container can handle... if total requests exceeds this, modal will spin up more containers

These 2 values should be the same!


We define the `max_concurrency` param in our `ocr_all_to_file()` function, which sets the asyncio semaphore (i.e. max concurrent async requests at any given time...). This is the main driver of concurrency!




Bucket naming preprocessing
- Take the first 3 words + last 2 words of the filename. Then, replace "/" with "_". Lowercase everything. This is used as the folder name




### Spacy
What each label is
PERSON: a person (e.g., “John Smith”)
- ORG: organization/company/institution (e.g., “Google”, “UN”)
- NORP: nationality, religious, political group (e.g., “American”, “Buddhist”, “Democrats”)

Places / locations
- GPE: geopolitical entity (countries, cities, states) (e.g., “Singapore”, “California”)
- LOC: non-political location (e.g., “Pacific Ocean”, “Mount Everest”)
- FAC: facilities/buildings/infrastructure (e.g., “Changi Airport”, “Golden Gate Bridge”)

Time
- DATE: dates or date ranges (e.g., “3 March 2026”, “last year”)
- TIME: times (e.g., “10:30am”, “midnight”)

Numbers / measurements
- CARDINAL: plain numbers not fitting other types (e.g., “two”, “42”)
- ORDINAL: ordered numbers (e.g., “1st”, “second”)
- PERCENT: percentages (e.g., “15%”)
- MONEY: money amounts (e.g., “$10”, “S$2 million”)
- QUANTITY: measurements (e.g., “10 km”, “3 kg”)

Things
- PRODUCT: objects/products (e.g., “iPhone”, “Model 3”)
- WORK_OF_ART: titles of books/songs/movies/art (e.g., “Mona Lisa”, “Hamlet”)

Other named “concepts”
- EVENT: named events (e.g., “World War II”, “Olympics”)
- LAW: named laws/acts (e.g., “GDPR”, “Constitution”)
- LANGUAGE: named languages (e.g., “English”, “Mandarin”)



We reduce this into 3 groups - "agent", "where_when", "others"