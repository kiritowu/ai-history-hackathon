"use client"

import { useEffect, useRef, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { FileText, Loader2, Sparkles } from "lucide-react"

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
import { useRightPanel, type RetrievedSource } from "@/components/RightPanel"

const defaultSuggestions = [
  "How did Singapore become a major trading port?",
  "What role did the East India Company play in Singapore's trade?",
  "What were Singapore's key commodities in the 19th century?",
  "How did the rubber and tin trade shape Singapore's economy?",
  "What was the impact of the Suez Canal on Singapore's trade routes?",
  "How did entrepôt trade define Singapore's early growth?",
]

interface ChatInterfaceProps {
  onConversationStart?: () => void
}

function LoadingState({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{text}</span>
    </div>
  )
}

export function ChatInterface({ onConversationStart }: ChatInterfaceProps) {
  const [text, setText] = useState("")
  const [startedNotified, setStartedNotified] = useState(false)
  const [followUpSuggestions, setFollowUpSuggestions] = useState(defaultSuggestions)
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false)
  const lastSuggestedAssistantIdRef = useRef<string | null>(null)
  const { open, openPanel, setSources, selectSource } = useRightPanel()

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { topK: 5 },
    }),
  })

  const handleSend = async (question: string) => {
    if (!question.trim() || status !== "ready") return
    setText("")
    await sendMessage({ text: question })
  }

  const handleSubmit = (message: PromptInputMessage) => {
    if (!message.text?.trim()) return
    handleSend(message.text)
  }

  useEffect(() => {
    if (startedNotified) return
    const hasUserMessage = messages.some((m) => m.role === "user")
    if (hasUserMessage) {
      onConversationStart?.()
      setStartedNotified(true)
    }
  }, [messages, onConversationStart, startedNotified])

  useEffect(() => {
    if (messages.length === 0) {
      lastSuggestedAssistantIdRef.current = null
      setFollowUpSuggestions(defaultSuggestions)
      setIsGeneratingSuggestions(false)
      return
    }

    if (status !== "ready") return

    const latestAssistant = [...messages].reverse().find((m) => m.role === "assistant")
    if (!latestAssistant) return

    if (lastSuggestedAssistantIdRef.current === latestAssistant.id) return
    lastSuggestedAssistantIdRef.current = latestAssistant.id

    let cancelled = false
    setIsGeneratingSuggestions(true)

    const generateSuggestions = async () => {
      setFollowUpSuggestions([])
      
      try {
        const response = await fetch("/api/followups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages }),
        })

        if (!response.ok) throw new Error("Failed to generate follow-up suggestions")

        const data = (await response.json()) as { suggestions?: string[] }
        const generated = (data.suggestions ?? []).filter((s) => Boolean(s?.trim())).slice(0, 5)

        if (!cancelled && generated.length > 0) {
          setFollowUpSuggestions(generated)
        }
      } catch (error) {
        console.error("Failed to fetch follow-up suggestions:", error)
      } finally {
        if (!cancelled) setIsGeneratingSuggestions(false)
      }
    }

    void generateSuggestions()

    return () => {
      cancelled = true
    }
  }, [messages, status])

  useEffect(() => {
    let latestSources: RetrievedSource[] = []

    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg = messages[i]
      for (let j = msg.parts.length - 1; j >= 0; j -= 1) {
        const part = msg.parts[j]
        if (part.type !== "tool-search_documents" || part.state !== "output-available") continue

        const output = part.output as
          | {
              sources?: Array<{
                index: number
                documentName: string
                pageNumber?: number | null
                score?: number
                content?: string
                imageUrl?: string | null
              }>
            }
          | undefined

        const parsed = (output?.sources ?? []).map((s) => ({
          id: `${msg.id}-${j}-${s.index}`,
          index: s.index,
          documentName: s.documentName,
          pageNumber: s.pageNumber ?? null,
          score: s.score ?? 0,
          content: s.content ?? "",
          imageUrl: s.imageUrl ?? null,
        }))

        if (parsed.length > 0) {
          latestSources = parsed
        }
        break
      }
      if (latestSources.length > 0) break
    }

    if (latestSources.length > 0) {
      setSources(latestSources)
      if (!open) openPanel()
    }
  }, [messages, open, openPanel, setSources])

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
                <MessageContent>
                  {msg.parts.map((part, index) => {
                    if (part.type === "text") {
                      return msg.role === "assistant" ? (
                        <MessageResponse key={index}>{part.text}</MessageResponse>
                      ) : (
                        <p key={index}>{part.text}</p>
                      )
                    }

                    if (part.type === "tool-search_documents") {
                      if (part.state === "input-available") {
                        return <LoadingState key={index} text="Searching knowledge base..." />
                      }

                      if (part.state === "output-available") {
                        const output = part.output as
                          | {
                              sources?: Array<{
                                index: number
                                documentName: string
                                pageNumber?: number | null
                                score?: number
                                content?: string
                                imageUrl?: string | null
                              }>
                            }
                          | undefined
                        const sources = (output?.sources ?? []).map((s) => ({
                          id: `${msg.id}-${index}-${s.index}`,
                          index: s.index,
                          documentName: s.documentName,
                          pageNumber: s.pageNumber ?? null,
                          score: s.score ?? 0,
                          content: s.content ?? "",
                          imageUrl: s.imageUrl ?? null,
                        }))

                        if (!sources.length) {
                          return (
                            <div key={index} className="text-xs text-muted-foreground">
                              No sources retrieved.
                            </div>
                          )
                        }

                        return (
                          <Sources key={index}>
                            <SourcesTrigger count={sources.length} />
                            <SourcesContent>
                              {sources.map((s) => (
                                <Source
                                  key={s.id}
                                  href="#"
                                  onClick={(event) => {
                                    event.preventDefault()
                                    setSources(sources)
                                    selectSource(s.id)
                                    openPanel()
                                  }}
                                  title={
                                    s.pageNumber
                                      ? `[${s.index}] ${s.documentName} (p. ${s.pageNumber})`
                                      : `[${s.index}] ${s.documentName}`
                                  }
                                />
                              ))}
                            </SourcesContent>
                          </Sources>
                        )
                      }
                    }

                    return null
                  })}
                </MessageContent>
              </Message>
            ))
          )}

          {(status === "submitted" || status === "streaming") && messages.at(-1)?.role === "user" && (
            <Message from="assistant">
              <MessageContent>
                <LoadingState text="AI is working..." />
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Suggestions + Prompt input */}
      <div className="shrink-0 space-y-3 border-t border-border px-4 py-4">
        <Suggestions className="px-0">
          {followUpSuggestions.map((suggestion) => (
            <Suggestion
              key={suggestion}
              disabled={status !== "ready"}
              suggestion={suggestion}
              onClick={(nextSuggestion) => handleSend(nextSuggestion)}
            />
          ))}
        </Suggestions>
        {isGeneratingSuggestions && (
          <LoadingState text="Finding your next best questions..." />
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
