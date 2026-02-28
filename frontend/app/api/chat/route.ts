import { NextRequest, NextResponse } from "next/server"
import { searchDocuments } from "@/lib/weaviate"
import { chat, ChatMessage } from "@/lib/openai"

export async function POST(request: NextRequest) {
  try {
    const { message, conversationHistory } = await request.json()

    // Retrieve relevant chunks from Weaviate using nearText (server-side vectorization)
    const searchResult = await searchDocuments(message, 5)
    const hits = searchResult.objects || []

    // Build context from retrieved chunks
    const contextChunks = hits.map((hit: any, i: number) => {
      const props = hit.properties
      const source = props.documentName || "unknown"
      return `[${i + 1}] (${source}):\n${props.content}`
    })

    const citations = hits.map((hit: any) => {
      const props = hit.properties
      return props.documentName || "unknown document"
    })

    // Build conversation messages for OpenAI
    const messages: ChatMessage[] = (conversationHistory || []).map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    }))

    // Append current user message with RAG context
    const augmentedMessage = contextChunks.length > 0
      ? `Context from indexed documents:\n${contextChunks.join("\n\n")}\n\nQuestion: ${message}`
      : message

    messages.push({ role: "user", content: augmentedMessage })

    // Generate answer via OpenAI
    const answer = await chat(messages, citations)

    return NextResponse.json({
      content: answer,
      citations: citations.length > 0 ? [...new Set(citations)] : undefined,
    })
  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json(
      { error: "Failed to process chat request: " + String(error) },
      { status: 500 }
    )
  }
}
