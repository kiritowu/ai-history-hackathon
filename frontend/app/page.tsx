import { ChatInterface } from "@/components/ChatInterface"
import { VectorVisualization } from "@/components/VectorVisualization"

export default function Home() {
  return (
    <div className="h-full w-full grid grid-cols-2 gap-4 p-4 relative z-10">
      <div className="flex flex-col">
        <ChatInterface />
      </div>
      <div className="flex flex-col">
        <VectorVisualization />
      </div>
    </div>
  )
}
