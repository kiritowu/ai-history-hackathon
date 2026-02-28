import type { Metadata } from "next"
import { Navigation } from "@/components/Navigation"
import "./globals.css"

export const metadata: Metadata = {
  title: "AI History - Vector Intelligence",
  description: "Explore AI history through intelligent vector embeddings and semantic analysis",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased overflow-hidden">
        <div className="flex flex-col h-screen bg-background">
          <Navigation />
          <main className="flex-1 overflow-hidden">{children}</main>
        </div>
      </body>
    </html>
  )
}
