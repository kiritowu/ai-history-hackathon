"use client"

import Link from "next/link"
import { SparklesIcon } from "lucide-react"

export function Navigation() {
  return (
    <nav className="relative z-20 border-b border-white/10 bg-gradient-to-r from-slate-900/50 via-slate-800/50 to-slate-900/50 backdrop-blur-md">
      <div className="px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg shadow-blue-500/50">
            <SparklesIcon className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold gradient-text">AI History</h1>
            <p className="text-xs text-muted-foreground">Vector Intelligence</p>
          </div>
        </Link>
        
        <div className="text-xs text-muted-foreground">
          Powered by semantic embeddings
        </div>
      </div>
    </nav>
  )
}
