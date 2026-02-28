"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { SendIcon, UploadIcon } from "lucide-react"
import ReactMarkdown from "react-markdown"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  citations?: string[]
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
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          conversationHistory: messages,
          uploadedDocuments: uploadedDocs,
        }),
      })

      const data = await response.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.content,
        citations: data.citations,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error("Error sending message:", error)
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
    <div className="flex flex-col h-full gap-4 glass rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-white/10">
        <h1 className="gradient-text text-2xl font-bold">AI History Chat</h1>
        <p className="text-muted-foreground text-sm mt-1">Explore semantic relationships in AI history</p>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 px-6">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 opacity-50 flex items-center justify-center">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
                </svg>
              </div>
              <div>
                <p className="text-lg font-medium">Start exploring</p>
                <p className="text-sm">Upload documents and discover semantic relationships</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div key={message.id} className="flex gap-3 pb-2">
                <div
                  className={`flex-1 ${
                    message.role === "user" ? "flex justify-end" : ""
                  }`}
                >
                  <Card
                    className={`max-w-xs px-4 py-3 rounded-lg ${
                      message.role === "assistant"
                        ? "glass-dark glow-sm border-white/20"
                        : "bg-gradient-to-r from-blue-500/80 to-cyan-500/80 border-blue-400/30 text-white shadow-lg shadow-blue-500/20"
                    }`}
                  >
                    <ReactMarkdown className="text-sm leading-relaxed">
                      {message.content}
                    </ReactMarkdown>
                    {message.citations && message.citations.length > 0 && (
                      <>
                        <Separator className="my-2 bg-white/10" />
                        <div className="text-xs opacity-70 space-y-1">
                          <p className="font-semibold">Sources:</p>
                          {message.citations.map((citation, i) => (
                            <p key={i} className="text-xs">
                              {citation}
                            </p>
                          ))}
                        </div>
                      </>
                    )}
                  </Card>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 pb-2">
                <Card className="glass-dark p-3 rounded-lg">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </Card>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Upload Documents Section */}
      {uploadedDocs.length > 0 && (
        <div className="px-6 py-3 mx-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg border border-green-500/30">
          <p className="text-sm font-medium text-green-300">
            ✓ {uploadedDocs.length} document{uploadedDocs.length !== 1 ? 's' : ''} indexed
          </p>
        </div>
      )}

      {/* Input Area */}
      <div className="p-6 border-t border-white/10 space-y-3">
        <div className="flex gap-2">
          <label className="cursor-pointer">
            <input
              type="file"
              multiple
              accept=".pdf,.txt,.md,.docx"
              onChange={handleDocumentUpload}
              className="hidden"
            />
            <div className="p-2 hover:bg-white/10 rounded-lg transition-colors inline-block text-blue-400 hover:text-blue-300">
              <UploadIcon className="w-5 h-5" />
            </div>
          </label>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Ask about your documents..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
            disabled={isLoading}
            className="glass border-white/20 focus:border-blue-400/50 focus:ring-blue-500/20"
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !input.trim()}
            size="icon"
            className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white border-0 rounded-lg glow"
          >
            <SendIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
