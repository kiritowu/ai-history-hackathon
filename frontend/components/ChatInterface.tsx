"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, Upload, Sparkles, FileText, CheckCircle2 } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { performRAG, type Citation } from "@/lib/rag"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  citations?: Citation[]
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [uploadedDocs, setUploadedDocs] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async () => {
    if (!input.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const ragResponse = await performRAG(
        input,
        messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }))
      )

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: ragResponse.answer,
        citations: ragResponse.citations,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error("Error sending message:", error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, there was an error processing your question. Please try again.",
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleDocumentUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files
    if (!files) return

    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append("file", file)

      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })

        const data = await response.json()
        setUploadedDocs((prev) => [...prev, data.documentId])
      } catch (error) {
        console.error("Error uploading document:", error)
      }
    }
  }

  return (
    <div className="flex flex-col h-full gap-0 bg-gradient-to-br from-background via-background to-purple-50/5 dark:to-purple-950/10 rounded-2xl border border-border overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 border-b border-border bg-white/30 dark:bg-white/5 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 dark:from-purple-500 dark:to-pink-500 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-2xl font-bold gradient-text">AI Research Assistant</h2>
        </div>
        <p className="text-sm text-muted-foreground ml-13">Ask questions about your documents and discover insights</p>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto space-y-6 px-8 py-6">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-6 max-w-md">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 dark:from-purple-500/30 dark:to-pink-500/30 flex items-center justify-center border border-purple-500/30 dark:border-purple-500/20">
                <FileText className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground mb-2">Welcome to AI History Research</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Upload documents about AI history and ask intelligent questions. Get context-aware answers with citations from your sources.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div key={message.id} className="flex gap-4">
                {/* Avatar */}
                <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-1">
                  {message.role === "assistant" ? (
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 dark:from-purple-500 dark:to-pink-500 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 dark:from-cyan-400 dark:to-blue-500 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">You</span>
                    </div>
                  )}
                </div>

                {/* Message Content */}
                <div className="flex-1 space-y-3">
                  {/* Message Bubble */}
                  <div
                    className={`inline-block max-w-xl ${
                      message.role === "assistant"
                        ? "bg-white/60 dark:bg-white/5 backdrop-blur-md border border-white/40 dark:border-white/10"
                        : "bg-gradient-to-r from-cyan-500/80 to-blue-600/80 dark:from-cyan-500/70 dark:to-blue-600/70"
                    } rounded-2xl px-6 py-4 shadow-sm dark:shadow-md`}
                  >
                    <div
                      className={`text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none ${
                        message.role === "assistant"
                          ? "text-foreground"
                          : "text-white"
                      }`}
                    >
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>,
                          li: ({ children }) => <li className="mb-1">{children}</li>,
                          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                          em: ({ children }) => <em className="italic">{children}</em>,
                          code: ({ children }) => (
                            <code className="bg-black/10 dark:bg-black/30 px-2 py-1 rounded text-xs font-mono">
                              {children}
                            </code>
                          ),
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  </div>

                  {/* Citations */}
                  {message.citations && message.citations.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Sources
                      </p>
                      <div className="space-y-2">
                        {message.citations.map((citation, i) => (
                          <div
                            key={i}
                            className="bg-white/40 dark:bg-white/5 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-lg p-3 text-xs space-y-1"
                          >
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="w-3 h-3 mt-0.5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="font-semibold text-foreground">
                                  {citation.documentName}
                                  {citation.pageNumber && ` (p. ${citation.pageNumber})`}
                                </p>
                                {citation.content && (
                                  <p className="text-muted-foreground mt-1 line-clamp-2">
                                    {citation.content.substring(0, 150)}...
                                  </p>
                                )}
                                <p className="text-muted-foreground/60 mt-1">
                                  Relevance: {(citation.score * 100).toFixed(0)}%
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading State */}
            {isLoading && (
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 dark:from-purple-500 dark:to-pink-500 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 bg-white/60 dark:bg-white/5 backdrop-blur-md border border-white/40 dark:border-white/10 rounded-2xl px-6 py-4">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full animate-bounce"></div>
                    <div
                      className="w-2 h-2 bg-pink-600 dark:bg-pink-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-cyan-600 dark:bg-cyan-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Upload Status */}
      {uploadedDocs.length > 0 && (
        <div className="px-8 py-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 dark:from-green-500/5 dark:to-emerald-500/5 border-t border-border">
          <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>
              {uploadedDocs.length} document{uploadedDocs.length !== 1 ? "s" : ""} indexed and ready
            </span>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-6 border-t border-border bg-white/30 dark:bg-white/5 backdrop-blur-sm space-y-4">
        {/* File Upload */}
        <div className="flex items-center gap-2">
          <label className="cursor-pointer">
            <input
              type="file"
              multiple
              accept=".pdf,.txt,.md,.docx"
              onChange={handleDocumentUpload}
              className="hidden"
            />
            <div className="p-2.5 hover:bg-white/60 dark:hover:bg-white/10 rounded-xl transition-colors inline-block text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 border border-transparent hover:border-white/20">
              <Upload className="w-5 h-5" />
            </div>
          </label>
          <span className="text-xs text-muted-foreground">Upload documents (PDF, TXT, MD, DOCX)</span>
        </div>

        {/* Message Input */}
        <div className="flex gap-3">
          <Input
            placeholder="Ask a question about your documents..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
            disabled={isLoading}
            className="input-modern text-sm"
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !input.trim()}
            size="lg"
            className="button-primary px-6 h-12 flex-shrink-0 shadow-lg shadow-purple-500/30 dark:shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
