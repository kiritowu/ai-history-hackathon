"use client"

import { createContext, useContext, useState, useCallback } from "react"
import { BookOpen, PanelRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface RightPanelContextType {
  open: boolean
  toggle: () => void
}

const RightPanelContext = createContext<RightPanelContextType>({
  open: false,
  toggle: () => {},
})

export function useRightPanel() {
  return useContext(RightPanelContext)
}

export function RightPanelProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const toggle = useCallback(() => setOpen((v) => !v), [])

  return (
    <RightPanelContext.Provider value={{ open, toggle }}>
      {children}
    </RightPanelContext.Provider>
  )
}

export function RightPanelTrigger() {
  const { toggle } = useRightPanel()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      className="h-8 w-8 [&>svg]:size-5"
    >
      <PanelRight />
      <span className="sr-only">Toggle right panel</span>
    </Button>
  )
}

export function RightPanelContent() {
  const { open } = useRightPanel()

  return (
    <div
      className="shrink-0 transition-[width] duration-200 ease-linear overflow-hidden"
      style={{ width: open ? "20rem" : "0" }}
    >
      <div className="flex h-full w-80 flex-col border-l border-border">
        <div className="shrink-0 border-b border-border px-4 py-3">
          <h2 className="text-lg font-semibold">Sources & Context</h2>
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="space-y-3 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              Sources and context from retrieved documents will appear here.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
