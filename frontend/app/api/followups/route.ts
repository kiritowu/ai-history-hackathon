import { generateText, Output, type UIMessage } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"

const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-5.2"
const OPENAI_FOLLOWUP_MODEL = process.env.OPENAI_FOLLOWUP_MODEL || OPENAI_CHAT_MODEL

const FollowupSchema = z.object({
  suggestions: z
    .array(
      z
        .string()
        .min(4)
        .max(120)
        .describe("A short follow-up question the user can ask next."),
    )
    .min(3)
    .max(5),
})

function extractText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join("\n")
}

export async function POST(request: Request) {
  try {
    const { messages }: { messages: UIMessage[] } = await request.json()

    const latestUser = [...messages].reverse().find((m) => m.role === "user")
    const latestAssistant = [...messages].reverse().find((m) => m.role === "assistant")

    if (!latestUser || !latestAssistant) {
      return Response.json({ suggestions: [] })
    }

    const userQuestion = extractText(latestUser)
    const assistantAnswer = extractText(latestAssistant)

    const result = await generateText({
      model: openai(OPENAI_FOLLOWUP_MODEL),
      output: Output.object({ schema: FollowupSchema }),
      prompt: `Generate 3 to 5 short follow-up questions based on this conversation.

Rules:
- Each item must be a question.
- Keep each question concise (ideally under 12 words).
- Questions should explore next-step angles, clarifications, comparisons, or deeper historical context.
- Avoid repeating the exact wording from the user's question.
- Return only useful questions a user might click next.

User question:
${userQuestion}

Assistant answer:
${assistantAnswer}`,
    })

    const suggestions = [...new Set(result.output.suggestions.map((s) => s.trim()).filter(Boolean))].slice(0, 5)
    return Response.json({ suggestions })
  } catch (error) {
    console.error("Error generating follow-up suggestions:", error)
    return Response.json({ suggestions: [] }, { status: 200 })
  }
}
