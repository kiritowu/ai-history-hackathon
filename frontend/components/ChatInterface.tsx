"use client"

import { useState } from "react"
import { FileText, Sparkles } from "lucide-react"

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai/conversation"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai/message"
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai/prompt-input"
import { Source, Sources, SourcesContent, SourcesTrigger } from "@/components/ai/sources"
import { Suggestion, Suggestions } from "@/components/ai/suggestion"
import { performRAG, type Citation } from "@/lib/rag"

const suggestions = [
  "How did Singapore become a major trading port?",
  "What role did the East India Company play in Singapore's trade?",
  "What were Singapore's key commodities in the 19th century?",
  "How did the rubber and tin trade shape Singapore's economy?",
  "What was the impact of the Suez Canal on Singapore's trade routes?",
  "How did entrepôt trade define Singapore's early growth?",
]

type Status = "ready" | "submitted" | "streaming" | "error"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  citations?: Citation[]
}

interface ChatInterfaceProps {
  onConversationStart?: () => void
}

export function ChatInterface({ onConversationStart }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState("")
  const [status, setStatus] = useState<Status>("ready")
  const handleSend = async (question: string) => {
    if (!question.trim() || status !== "ready") return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
    }
    setMessages((prev) => {
      if (prev.length === 0) onConversationStart?.()
      return [...prev, userMessage]
    })
    setText("")
    setStatus("submitted")

    try {
      const ragResponse = await performRAG(
        question,
        messages.map((m) => ({ role: m.role, content: m.content }))
      )

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: ragResponse.answer,
          citations: ragResponse.citations,
        },
      ])
    } catch (error) {
      console.error("Error sending message:", error)
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "Sorry, there was an error processing your question. Please try again.",
        },
      ])
    } finally {
      setStatus("ready")
    }
  }

  const handleSubmit = (message: PromptInputMessage) => {
    if (!message.text?.trim()) return
    handleSend(message.text)
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-6 py-4">
        <div className="mb-1 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          <h2 className="text-xl font-semibold">AI Research Assistant</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Ask questions about AI history and get cited answers.
        </p>
      </div>

      {/* Conversation */}
      <Conversation className="min-h-0 flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              className="flex-1"
              title="Ask a Question"
              description="Ask questions about AI history to get grounded answers with source citations."
              icon={<FileText className="h-6 w-6" />}
            />
          ) : (
            messages.map((msg) => (
              <Message key={msg.id} from={msg.role}>
                {msg.role === "assistant" && msg.citations && msg.citations.length > 0 && (
                  <Sources>
                    <SourcesTrigger count={msg.citations.length} />
                    <SourcesContent>
                      {msg.citations.map((c, i) => (
                        <Source
                          key={`${c.documentName}-${i}`}
                          title={
                            c.pageNumber
                              ? `${c.documentName} (p. ${c.pageNumber})`
                              : c.documentName
                          }
                        />
                      ))}
                    </SourcesContent>
                  </Sources>
                )}
                <MessageContent>
                  {msg.role === "assistant" ? (
                    <MessageResponse>{msg.content}</MessageResponse>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </MessageContent>
              </Message>
            ))
          )}

          {status === "submitted" && (
            <Message from="assistant">
              <MessageContent>
                <p className="text-sm text-muted-foreground animate-pulse">
                  Thinking...
                </p>
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Suggestions + Prompt input */}
      <div className="shrink-0 space-y-3 border-t border-border px-4 py-4">
        {messages.length === 0 && (
          <Suggestions className="px-0">
            {suggestions.map((s) => (
              <Suggestion
                key={s}
                suggestion={s}
                onClick={(suggestion) => handleSend(suggestion)}
              />
            ))}
          </Suggestions>
        )}
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ask a question about AI history..."
            />
          </PromptInputBody>
          <PromptInputFooter>
            <div />
            <PromptInputSubmit
              disabled={!text.trim() || status !== "ready"}
              status={status}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}
