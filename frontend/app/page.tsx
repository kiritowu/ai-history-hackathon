"use client"

import { useState } from "react"
import { ChatInterface } from "@/components/ChatInterface"
import { RightPanelContent } from "@/components/RightPanel"

export default function Home() {
  const [, setStarted] = useState(false)

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ChatInterface onConversationStart={() => setStarted(true)} />
      </div>
      <RightPanelContent />
    </div>
  )
}
