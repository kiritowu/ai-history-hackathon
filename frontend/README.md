# Vector Store Chatbot

A Next.js application that enables users to chat with documents stored in Weaviate vector database using OpenAI's LLM, with advanced visualization of document clusters.

## Features

### 1. Chat Interface
- Upload documents (PDF, TXT, MD, DOCX)
- Ask questions about your documents
- Receive AI-generated answers with citations
- Real-time conversation history

### 2. Vector Visualization
- D3.js-powered graph visualization of document clusters
- Interactive force-directed graph showing document relationships
- Color-coded clusters based on semantic similarity
- Draggable nodes for exploration
- Displays similar concepts and related documents

## Prerequisites

- Node.js 18+
- Weaviate instance running (locally or remote)
- OpenAI API key

## Setup

1. **Install dependencies:**
```bash
pnpm install
```

2. **Configure environment variables:**
```bash
cp .env.local.example .env.local
```

Update `.env.local` with:
- `NEXT_PUBLIC_WEAVIATE_URL`: Your Weaviate instance URL
- `WEAVIATE_API_KEY`: Weaviate API key (if needed)
- `OPENAI_API_KEY`: Your OpenAI API key

3. **Run the development server:**
```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
frontend/
├── app/
│   ├── api/
│   │   ├── chat/          # Chat endpoint
│   │   ├── upload/        # Document upload endpoint
│   │   └── clusters/      # Clustering visualization data
│   ├── visualize/         # Visualization page
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Chat page
│   └── globals.css        # Global styles
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── ChatInterface.tsx  # Chat interface component
│   ├── VectorVisualization.tsx # Visualization component
│   └── Navigation.tsx     # Navigation component
├── lib/
│   ├── utils.ts           # Utility functions
│   ├── weaviate.ts        # Weaviate client
│   └── openai.ts          # OpenAI integration
└── public/                # Static assets
```

## Usage

### Chat with Documents
1. Click the upload icon to select documents
2. Ask questions about your documents in the chat input
3. Responses include citations to source documents
4. Conversation history is maintained during the session

### Visualize Clusters
1. Navigate to the "Visualize" tab
2. View the document cluster graph
3. Interact with the graph:
   - Drag nodes to explore relationships
   - Hover to see document names
   - Colors represent different clusters
4. Click "Refresh" to update with new documents

## API Endpoints

### POST `/api/chat`
Sends a message and gets a response with citations.

**Request:**
```json
{
  "message": "What is this about?",
  "conversationHistory": [],
  "uploadedDocuments": []
}
```

**Response:**
```json
{
  "content": "Answer text...",
  "citations": ["document.pdf"]
}
```

### POST `/api/upload`
Uploads a document and stores it in Weaviate.

**Request:** FormData with `file` field

**Response:**
```json
{
  "documentId": "uuid",
  "fileName": "document.pdf",
  "message": "Document uploaded successfully"
}
```

### GET `/api/clusters`
Retrieves cluster data for visualization.

**Response:**
```json
{
  "nodes": [
    {
      "id": "uuid",
      "label": "doc name",
      "group": 0
    }
  ],
  "links": [
    {
      "source": "uuid",
      "target": "uuid",
      "distance": 0.3
    }
  ]
}
```

## Technologies Used

- **Frontend:** Next.js, React, TypeScript
- **UI Components:** shadcn/ui with Tailwind CSS
- **Vector Database:** Weaviate
- **LLM:** OpenAI GPT-3.5
- **Visualization:** D3.js
- **Embeddings:** OpenAI Embeddings API

## Development

### Build for production:
```bash
pnpm build
pnpm start
```

### Linting:
```bash
pnpm lint
```

## Notes

- Documents are split into chunks and embedded using OpenAI's embedding model
- Similarity search finds relevant documents for each query
- K-means clustering groups similar documents for visualization
- Cosine similarity is used for document relatedness

## Future Enhancements

- Support for more file formats (CSV, JSON)
- Batch document processing
- Document metadata and tagging
- Advanced search filters
- Custom clustering algorithms
- Export visualization as image
- Multi-language support
