# Quick Start Setup Guide

## Prerequisites

1. **Node.js 18+** - Download from https://nodejs.org/
2. **Weaviate Instance**
   - Option A: Run locally with Docker
     ```bash
     docker run -p 8080:8080 -p 50051:50051 semitechnologies/weaviate:latest
     ```
   - Option B: Use Weaviate Cloud (https://console.weaviate.cloud/)

3. **OpenAI API Key** - Get from https://platform.openai.com/account/api-keys

## Installation Steps

### 1. Install Dependencies
```bash
cd frontend
pnpm install
```

### 2. Configure Environment Variables
```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add:
```
NEXT_PUBLIC_WEAVIATE_URL=http://localhost:8080
WEAVIATE_API_KEY=
OPENAI_API_KEY=your-openai-api-key-here
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### 3. Create Weaviate Schema

Run this in your browser or with curl to set up the Document class:

```bash
curl -X POST http://localhost:8080/v1/schema \
  -H "Content-Type: application/json" \
  -d '{
    "class": "Document",
    "description": "Document chunks with embeddings",
    "vectorizer": "none",
    "properties": [
      {
        "name": "content",
        "dataType": ["text"],
        "description": "The document content"
      },
      {
        "name": "documentName",
        "dataType": ["string"],
        "description": "The name of the document"
      },
      {
        "name": "pageNumber",
        "dataType": ["number"],
        "description": "Page number if applicable"
      }
    ]
  }'
```

### 4. Run Development Server
```bash
pnpm dev
```

Visit http://localhost:3000 in your browser.

## Usage

### Chat Tab
1. Click the upload icon to add documents
2. Supported formats: PDF, TXT, MD, DOCX
3. Ask questions about your documents
4. Get answers with citations

### Visualize Tab
1. View your documents as an interactive cluster graph
2. Drag nodes to explore relationships
3. Colors represent document clusters
4. Similar documents are linked together

## Troubleshooting

### Weaviate Connection Issues
- Ensure Weaviate is running: `curl http://localhost:8080/v1/.well-known/live`
- Check `NEXT_PUBLIC_WEAVIATE_URL` is correct in `.env.local`
- Verify no firewall is blocking port 8080

### OpenAI API Issues
- Confirm API key is valid at https://platform.openai.com/account/api-keys
- Check API key has sufficient credits
- Verify `OPENAI_API_KEY` is set in `.env.local`

### Upload Failures
- File size should be < 10MB
- Check file format is supported
- Check browser console for detailed error messages

### Visualization Not Loading
- Ensure documents are uploaded first
- Try clicking "Refresh" button
- Check network tab in browser DevTools for API errors

## Development Tips

- Hot reload is enabled - changes reflect immediately
- Check browser DevTools console for errors
- Server logs show in terminal where you ran `pnpm dev`
- API responses can be tested with curl or Postman

## Next Steps

1. Upload sample documents
2. Test chat functionality
3. Explore visualization features
4. Customize styling with Tailwind CSS
5. Add more document types support
6. Implement advanced search filters

## Architecture Overview

```
Frontend (Next.js)
├── Chat Interface
│   ├── Document Upload
│   ├── Message History
│   └── Citations
├── API Routes
│   ├── /api/chat - LLM responses
│   ├── /api/upload - Document ingestion
│   └── /api/clusters - Visualization data
└── Services
    ├── Weaviate Integration
    ├── OpenAI Integration
    └── Embeddings & Similarity
```

## File Structure Quick Reference

```
frontend/
├── app/
│   ├── api/          ← API endpoints
│   ├── visualize/    ← Visualization page
│   ├── layout.tsx    ← Root layout
│   └── page.tsx      ← Chat page
├── components/       ← React components
├── lib/              ← Utilities & integrations
├── public/           ← Static files
└── package.json
```
