"use client"

import { createContext, useContext, useState, useCallback, useMemo } from "react"
import { BookOpen, PanelRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface RetrievedSource {
  id: string
  index: number
  documentName: string
  pageNumber?: number | null
  score?: number
  content: string
}

interface RightPanelContextType {
  open: boolean
  toggle: () => void
  openPanel: () => void
  sources: RetrievedSource[]
  selectedSourceId: string | null
  setSources: (sources: RetrievedSource[]) => void
  selectSource: (id: string) => void
}

const RightPanelContext = createContext<RightPanelContextType>({
  open: false,
  toggle: () => {},
  openPanel: () => {},
  sources: [],
  selectedSourceId: null,
  setSources: () => {},
  selectSource: () => {},
})

export function useRightPanel() {
  return useContext(RightPanelContext)
}

export function RightPanelProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [sources, setSourcesState] = useState<RetrievedSource[]>([])
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const toggle = useCallback(() => setOpen((v) => !v), [])
  const openPanel = useCallback(() => setOpen(true), [])
  const selectSource = useCallback((id: string) => setSelectedSourceId(id), [])
  const setSources = useCallback((nextSources: RetrievedSource[]) => {
    setSourcesState(nextSources)
    setSelectedSourceId((current) => {
      if (!nextSources.length) return null
      return current && nextSources.some((s) => s.id === current)
        ? current
        : nextSources[0]!.id
    })
  }, [])

  return (
    <RightPanelContext.Provider
      value={{ open, toggle, openPanel, sources, selectedSourceId, setSources, selectSource }}
    >
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
  const { open, sources, selectedSourceId, selectSource } = useRightPanel()
  const selectedSource = sources.find((s) => s.id === selectedSourceId) ?? null
  const groupedSources = useMemo(() => {
    const groups = new Map<string, RetrievedSource[]>()

    for (const source of sources) {
      const groupKey = source.documentName || "Unknown"
      const existing = groups.get(groupKey)
      if (existing) {
        existing.push(source)
      } else {
        groups.set(groupKey, [source])
      }
    }

    return Array.from(groups.entries())
      .map(([documentName, items]) => ({
        documentName,
        items: [...items].sort((a, b) => {
          const pageA = a.pageNumber ?? Number.MAX_SAFE_INTEGER
          const pageB = b.pageNumber ?? Number.MAX_SAFE_INTEGER
          if (pageA !== pageB) return pageA - pageB
          return b.index - a.index
        }),
        maxScore: Math.max(...items.map((item) => item.score ?? 0)),
      }))
      .sort((a, b) => b.maxScore - a.maxScore)
  }, [sources])

  return (
    <div
      className="shrink-0 transition-[width] duration-200 ease-linear overflow-hidden"
      style={{ width: open ? "20rem" : "0" }}
    >
      <div className="flex h-full w-80 flex-col border-l border-border">
        <div className="shrink-0 border-b border-border px-4 py-3">
          <h2 className="text-lg font-semibold">Sources & Context</h2>
        </div>
        {sources.length === 0 ? (
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
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
            <div className="space-y-2">
              {groupedSources.map((group) => (
                <div key={group.documentName} className="rounded-md border border-border p-3">
                  <p className="text-sm font-medium">{group.documentName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {group.items.length} pages · Top relevance: {Math.round(group.maxScore * 100)}%
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {group.items.map((source) => (
                      <button
                        key={source.id}
                        type="button"
                        onClick={() => selectSource(source.id)}
                        className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                          source.id === selectedSourceId
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:bg-muted/50"
                        }`}
                      >
                        {source.pageNumber ? `p.${source.pageNumber}` : `#${source.index}`} ·{" "}
                        {Math.round((source.score ?? 0) * 100)}%
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {selectedSource && (
              <div className="rounded-md border border-border p-3">
                <p className="text-sm font-semibold mb-2">Selected source content</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {selectedSource.content}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
