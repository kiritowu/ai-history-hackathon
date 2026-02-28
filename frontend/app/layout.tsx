import type { Metadata } from "next"
import { Navigation } from "@/components/Navigation"
import { ThemeProvider } from "@/components/ThemeProvider"
import "./globals.css"

export const metadata: Metadata = {
  title: "AI History Research - Intelligent Document Analysis",
  description: "Explore AI history through intelligent semantic embeddings and contextual understanding",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased overflow-hidden">
        <ThemeProvider>
          <div className="flex flex-col h-screen bg-background transition-colors duration-300">
            <Navigation />
            <main className="flex-1 overflow-hidden">{children}</main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
