"use client"

import Link from "next/link"
import { Sun, Moon, BookOpen } from "lucide-react"
import { useTheme } from "@/components/ThemeProvider"

export function Navigation() {
  const { theme, toggleTheme } = useTheme()

  return (
    <nav className="relative z-20 border-b border-border bg-background/50 backdrop-blur-xl transition-colors duration-300">
      <div className="px-8 py-5 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group hover:opacity-90 transition-opacity">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 dark:from-purple-500 dark:to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30 dark:shadow-purple-500/20 group-hover:shadow-xl group-hover:shadow-purple-500/40 transition-all duration-300">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold gradient-text">AI History</h1>
            <p className="text-xs text-muted-foreground font-medium">Research Studio</p>
          </div>
        </Link>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl bg-white/60 dark:bg-white/5 backdrop-blur-md border border-white/40 dark:border-white/10 hover:bg-white/70 dark:hover:bg-white/10 transition-all duration-200 glow-primary dark:glow-accent"
          aria-label="Toggle theme"
        >
          {theme === "light" ? (
            <Moon className="w-5 h-5 text-foreground" />
          ) : (
            <Sun className="w-5 h-5 text-foreground" />
          )}
        </button>
      </div>
    </nav>
  )
}
