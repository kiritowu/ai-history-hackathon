# Straits Cipher Frontend

Next.js frontend for grounded AI-history Q&A powered by Weaviate retrieval and OpenAI models.

Check out the live deployment at:  
https://ai-history-hackathon-529573690692.asia-southeast1.run.app

## What Straits Cipher Can Do

- Answer AI-history questions with **grounded, citation-backed responses**.
- Combine **semantic + keyword search** to find the **most relevant source evidence**.
- Show a **rich source context panel** with grouped pages, relevance scores, text snippets, and optional page images.
- Suggest **smart follow-up questions** to help users continue exploration.
- Visualize **relationships between documents** in an **interactive cluster map**.
- Let users click **highlighted entities** in source text to launch **focused follow-up queries**.

## Prerequisites

- Node.js 18+
- Weaviate Cloud project with indexed documents
- OpenAI API access

## Required API Keys and Environment Variables

Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

### Required

- `WEAVIATE_API_KEY` - Weaviate API key
- `OPENAI_API_KEY` - OpenAI API key

### Optional (has defaults)

- `WEAVIATE_COLLECTION` - collection used by `/api/chat` retrieval
- `WEAVIATE_CLUSTERS_COLLECTION` - collection used by `/api/clusters` map
- `WEAVIATE_HYBRID_ALPHA` (default `0.65`)
- `OPENAI_CHAT_MODEL` (default `gpt-5.2`)
- `OPENAI_EMBEDDING_MODEL` (default `text-embedding-3-small`)
- `OPENAI_FOLLOWUP_MODEL` (default inherits `OPENAI_CHAT_MODEL`)
- `NEXT_PUBLIC_API_URL` (default local frontend URL)

## Getting Started

### 1) Use the Live Deployment (Cloud Run) — Recommended

1. Open the deployed app:  
   https://ai-history-hackathon-529573690692.asia-southeast1.run.app
2. Ask a question in **Straits Cipher** and verify citations appear.
3. Open **Kratoska Index** to verify document relationship visualization.

### 2) Run Locally (npm) — For Development

1. Install dependencies:

```bash
npm install
```

2. Configure `.env.local` with the required values above.

3. Start the development server:

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Quick Verification Checklist

1. Ask a question in chat and confirm a streamed assistant answer appears.
2. Click citation chips (`[1]`, `[2]`) and confirm the source side panel opens.
3. Confirm follow-up suggestions appear after the assistant responds.
4. Visit `http://localhost:3000/visualize` and confirm the cluster graph renders.

## Important Notes

- This frontend does **not** currently provide a document upload API route.
- Your ingestion pipeline must already populate the Weaviate collections used above.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```
