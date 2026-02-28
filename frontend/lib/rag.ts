export interface Citation {
  content: string
  documentName: string
  pageNumber?: number
  score: number
}

export interface RAGResponse {
  answer: string
  citations: Citation[]
}

export async function performRAG(
  question: string,
  _conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>,
  topK: number = 5
): Promise<RAGResponse> {
  try {
    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        topK,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to search: ${response.statusText}`)
    }

    const data = await response.json()

    return {
      answer: data.answer,
      citations: data.citations,
    }
  } catch (error) {
    console.error("Error in RAG pipeline:", error)
    throw error
  }
}
