import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { message, conversationHistory } = await request.json()

    const backendUrl = process.env.BACKEND_API_URL || "http://localhost:8000"

    // Build history in backend format
    const history = (conversationHistory || []).map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    }))

    // Add current message
    history.push({ role: "user", content: message })

    // Call backend RAG pipeline
    const response = await fetch(`${backendUrl}/v1/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: message,
        history,
        top_k: 5,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Backend error (${response.status}): ${errorText}`)
    }

    const data = await response.json()

    // Extract citations from hits
    const citations = data.hits?.map((hit: any) => {
      const chunk = hit.chunk
      return `${chunk.source} (chunk ${chunk.chunk_index})`
    }) || []

    return NextResponse.json({
      content: data.answer,
      citations: citations.length > 0 ? citations : undefined,
    })
  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json(
      { error: "Failed to process chat request: " + String(error) },
      { status: 500 }
    )
  }
}
