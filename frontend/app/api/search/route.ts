import { getWeaviateClient } from "@/lib/weaviate"
import { generativeParameters } from "weaviate-client"

export async function POST(request: Request) {
  try {
    const { question, topK = 5 } = await request.json()

    const client = await getWeaviateClient()
    const collection = client.collections.use("DemoCollection")

    // Retrieve + Generate in one call using Weaviate's generative API
    const result = await collection.generate.nearText(question, {
      groupedTask: `You are an AI assistant specializing in AI history. Answer the following question using the provided context. Always cite your sources.
      
Question: "${question}"`,
      config: generativeParameters.openAI({
        model: "gpt-4o-mini",
        temperature: 0.7,
        maxTokens: 1000,
      }),
    }, {
      limit: topK,
      returnMetadata: ["distance"],
    })

    // Extract citations from retrieved objects
    const citations: any[] = []
    if (result.objects && result.objects.length > 0) {
      result.objects.forEach((obj) => {
        const properties = obj.properties as Record<string, any>
        const distance = obj.metadata?.distance || 0
        const score = Math.max(0, 1 - distance)

        console.log("Object properties:", properties)

        citations.push({
          content: properties?.content || "",
          documentName: properties?.documentName || "Unknown",
          pageNumber: properties?.pageNumber,
          score,
        })
      })
    }

    const answer = result.generated || "Unable to generate a response."

    return Response.json({
      answer,
      citations,
    })
  } catch (error) {
    console.error("Error searching documents:", error)
    return Response.json(
      { error: "Failed to search documents" },
      { status: 500 }
    )
  }
}
