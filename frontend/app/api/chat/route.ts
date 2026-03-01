import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage, embed } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import { getWeaviateClient } from "@/lib/weaviate"

const WEAVIATE_COLLECTION = process.env.WEAVIATE_COLLECTION || "TEST2"
const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-5.2"
const OPENAI_EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small"
const WEAVIATE_HYBRID_ALPHA_DEFAULT = (() => {
  const parsed = Number(process.env.WEAVIATE_HYBRID_ALPHA)
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) return parsed
  return 0.65
})()

export async function POST(request: Request) {
  try {
    const { topK = 5, messages }: { topK: number, messages: UIMessage[] } = await request.json()

    const client = await getWeaviateClient()
    const collection = client.collections.use(WEAVIATE_COLLECTION)

    const resultStream = streamText({
      model: openai(OPENAI_CHAT_MODEL),
      system:
        "You are an AI assistant specializing in AI history. Use the search_documents tool to retrieve evidence before answering. Cite sources with [1], [2] based on tool result indexes. If evidence is insufficient, say you don't know.",
      messages: await convertToModelMessages(messages),
      tools: {
        search_documents: tool({
          description:
            "Run hybrid retrieval (keyword + vector) over indexed history documents and return the most relevant chunks.",
          inputSchema: z.object({
            query: z.string().describe("Search query to retrieve relevant chunks"),
            topK: z.number().int().min(1).max(10).optional().default(10),
            alpha: z.number().min(0).max(1).optional().describe("Hybrid weight for vector signal (0=keyword only, 1=vector only)"),
          }),
          execute: async ({ query, topK: toolTopK, alpha }) => {
            // Hybrid retrieval: combine lexical matching with vector similarity.
            const { embedding } = await embed({
              model: openai.embedding(OPENAI_EMBEDDING_MODEL),
              value: query,
            })
            
            const result = await collection.query.hybrid(query, {
              alpha: alpha ?? WEAVIATE_HYBRID_ALPHA_DEFAULT,
              vector: embedding,
              limit: toolTopK ?? topK,
              returnMetadata: ["distance", "score"],
            })
            
            const hits = result.objects || []
            const sources = hits.map((hit: any, i: number) => {
              const properties = hit.properties as Record<string, any>
              const distance = hit.metadata?.distance
              const scoreFromDistance =
                typeof distance === "number" ? 1 / (1 + Math.max(0, distance)) : undefined
              const scoreFromMetadata =
                typeof hit.metadata?.score === "number" ? hit.metadata.score : undefined
              const normalizedScore =
                scoreFromMetadata ?? scoreFromDistance ?? 0
              return {
                index: i + 1,
                documentName: properties?.source || properties?.documentName || "Unknown",
                pageNumber: properties?.pageNumber ?? null,
                score: Math.max(0, Math.min(1, normalizedScore)),
                content: properties?.text || properties?.content || "",
                imageUrl: properties?.imageUrl || null,
              }
            })

             console.log("Retrieved sources:", {
              query,
              total: sources.length,
              sources: sources.map((s: { index: number; documentName: string; pageNumber: number | null; score: number; content: string; imageUrl: string | null }) => ({
                index: s.index,
                documentName: s.documentName,
                pageNumber: s.pageNumber,
                score: s.score,
                snippet: s.content.slice(0, 200),
                hasImage: Boolean(s.imageUrl),
              })),
            })

            return { sources }
          },
        }),
      },
      stopWhen: stepCountIs(5),
    })

    return resultStream.toUIMessageStreamResponse()
  } catch (error) {
    console.error("Error in chat endpoint:", error)
    return Response.json(
      { error: "Failed to process chat request" },
      { status: 500 }
    )
  }
}
