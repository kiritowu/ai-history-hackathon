import OpenAI from "openai"

if (!process.env.OPENAI_API_KEY) {
  console.warn("Warning: OPENAI_API_KEY is not set")
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "sk-placeholder",
})

export interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
}

export async function chat(messages: ChatMessage[], citations?: string[]) {
  try {
    const systemPrompt = citations
      ? `You are a helpful assistant that answers questions based on provided documents. 
Always cite your sources when referencing information from the documents.
Available documents for reference:
${citations.join("\n")}`
      : "You are a helpful assistant."

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 1000,
    })

    return response.choices[0].message.content || ""
  } catch (error) {
    console.error("OpenAI API error:", error)
    throw error
  }
}

export async function getEmbedding(text: string) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    })
    return response.data[0].embedding
  } catch (error) {
    console.error("Embedding API error:", error)
    throw error
  }
}
