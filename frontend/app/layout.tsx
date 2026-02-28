import type { Metadata } from "next"
import { AppSidebar } from "@/components/AppSidebar"
import { ThemeProvider } from "@/components/ThemeProvider"
import { RightPanelProvider, RightPanelTrigger } from "@/components/RightPanel"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
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
          <SidebarProvider>
            <AppSidebar />
            <RightPanelProvider>
              <main className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <SidebarTrigger className="h-8 w-8 [&>svg]:size-5" />
                  <RightPanelTrigger />
                </div>
                <div className="flex min-h-0 flex-1 overflow-hidden">{children}</div>
              </main>
            </RightPanelProvider>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
