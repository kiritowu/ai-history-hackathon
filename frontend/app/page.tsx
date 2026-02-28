import { ChatInterface } from "@/components/ChatInterface"
import { VectorVisualization } from "@/components/VectorVisualization"

export default function Home() {
  return (
    <div className="h-full w-full grid grid-cols-2 gap-6 p-6 relative z-10">
      {/* Chat Section */}
      <div className="flex flex-col min-h-0">
        <ChatInterface />
      </div>

      {/* Visualization Section */}
      <div className="flex flex-col min-h-0">
        <div className="h-full bg-gradient-to-br from-background via-background to-cyan-50/5 dark:to-cyan-950/10 rounded-2xl border border-border overflow-hidden shadow-2xl shadow-purple-500/10 dark:shadow-purple-500/5">
          <VectorVisualization />
        </div>
      </div>
    </div>
  )
}
