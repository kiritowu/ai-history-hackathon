"use client"

import { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from "react"
import { BookOpen, ChevronDown, Maximize2, PanelRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export interface RetrievedSource {
  id: string
  index: number
  documentName: string
  pageNumber?: number | null
  score?: number
  content: string
  imageUrl?: string | null
  nerText?: unknown
}

type NerEntity = {
  start?: number
  end?: number
  label?: string
  original_label?: string
  text?: string
}

type NerHighlight = {
  start: number
  end: number
  label: string
  originalLabel?: string
}

function getNerHighlightClass(label: string): string {
  const normalizedLabel = label.toLowerCase()

  if (normalizedLabel === "where_when") {
    return "bg-sky-300/45 hover:bg-sky-300/60 dark:bg-sky-500/30 dark:hover:bg-sky-500/40"
  }
  if (normalizedLabel === "agent") {
    return "bg-violet-300/45 hover:bg-violet-300/60 dark:bg-violet-500/30 dark:hover:bg-violet-500/40"
  }
  if (normalizedLabel === "other") {
    return "bg-emerald-300/45 hover:bg-emerald-300/60 dark:bg-emerald-500/30 dark:hover:bg-emerald-500/40"
  }

  return "bg-amber-300/45 hover:bg-amber-300/60 dark:bg-amber-500/30 dark:hover:bg-amber-500/40"
}

function extractNerEntities(nerText: unknown): NerEntity[] {
  if (!nerText) return []

  const parsed = (() => {
    if (typeof nerText === "string") {
      try {
        return JSON.parse(nerText)
      } catch {
        return null
      }
    }
    return nerText
  })()

  if (!parsed) return []
  if (Array.isArray(parsed)) return parsed as NerEntity[]

  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "entities" in parsed &&
    Array.isArray((parsed as { entities?: unknown }).entities)
  ) {
    return (parsed as { entities: NerEntity[] }).entities
  }

  return []
}

function buildNerHighlights(text: string, entities: NerEntity[]): NerHighlight[] {
  if (!text || entities.length === 0) return []

  const max = text.length
  const normalized = entities
    .map((entity) => {
      const rawStart = typeof entity.start === "number" ? entity.start : -1
      const rawEnd = typeof entity.end === "number" ? entity.end : -1
      const start = Math.max(0, Math.min(max, rawStart))
      const end = Math.max(0, Math.min(max, rawEnd))
      const label = entity.label || entity.original_label || "entity"
      const originalLabel = entity.original_label
      return { start, end, label, originalLabel }
    })
    .filter((entity) => entity.start < entity.end)
    .sort((a, b) => a.start - b.start || a.end - b.end)

  // Keep non-overlapping spans to avoid broken nested highlights.
  const highlights: NerHighlight[] = []
  let lastEnd = 0

  for (const entity of normalized) {
    if (entity.start < lastEnd) continue
    highlights.push(entity)
    lastEnd = entity.end
  }

  return highlights
}

function renderTextWithNer(
  text: string,
  entities: NerEntity[],
  keyPrefix: string,
  onEntityClick?: () => void,
) {
  const highlights = buildNerHighlights(text, entities)
  if (highlights.length === 0) return text

  const parts: JSX.Element[] = []
  let cursor = 0

  for (let i = 0; i < highlights.length; i += 1) {
    const highlight = highlights[i]

    if (cursor < highlight.start) {
      parts.push(
        <span key={`${keyPrefix}-plain-${i}`}>
          {text.slice(cursor, highlight.start)}
        </span>,
      )
    }

    const tooltipLabel = highlight.originalLabel || highlight.label

    parts.push(
      <Tooltip key={`${keyPrefix}-ner-${i}`}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => {
              const queryText = text.slice(highlight.start, highlight.end).trim()
              if (!queryText) return
              window.dispatchEvent(
                new CustomEvent("right-panel-ner-query", {
                  detail: { query: queryText },
                }),
              )
              onEntityClick?.()
            }}
            className={`rounded-sm px-0.5 text-left transition-colors ${getNerHighlightClass(
              highlight.label,
            )}`}
          >
            {text.slice(highlight.start, highlight.end)}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{tooltipLabel}</p>
        </TooltipContent>
      </Tooltip>,
    )

    cursor = highlight.end
  }

  if (cursor < text.length) {
    parts.push(
      <span key={`${keyPrefix}-plain-tail`}>
        {text.slice(cursor)}
      </span>,
    )
  }

  return parts
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
  const [isSourceDialogOpen, setIsSourceDialogOpen] = useState(false)
  const selectedSourceEntities = useMemo(
    () => extractNerEntities(selectedSource?.nerText),
    [selectedSource?.nerText],
  )
  const groupedSourcesRef = useRef<HTMLDivElement | null>(null)
  const [showGroupedSourcesScrollHint, setShowGroupedSourcesScrollHint] = useState(false)

  const updateGroupedSourcesScrollHint = useCallback(() => {
    const el = groupedSourcesRef.current
    if (!el) {
      setShowGroupedSourcesScrollHint(false)
      return
    }
    const remainingScroll = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowGroupedSourcesScrollHint(remainingScroll > 8)
  }, [])
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

  useEffect(() => {
    const el = groupedSourcesRef.current
    if (!el) return

    updateGroupedSourcesScrollHint()

    const handleScroll = () => updateGroupedSourcesScrollHint()
    el.addEventListener("scroll", handleScroll)
    window.addEventListener("resize", handleScroll)

    const resizeObserver = new ResizeObserver(handleScroll)
    resizeObserver.observe(el)

    return () => {
      el.removeEventListener("scroll", handleScroll)
      window.removeEventListener("resize", handleScroll)
      resizeObserver.disconnect()
    }
  }, [groupedSources, open, updateGroupedSourcesScrollHint])

  return (
    <TooltipProvider delayDuration={120}>
    <div
      className="shrink-0 transition-[width] duration-200 ease-linear overflow-hidden"
      style={{ width: open ? "50%" : "0" }}
    >
      <div className="flex h-full w-full flex-col border-l border-border">
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
          <div className="min-h-0 flex flex-1 flex-col gap-2 overflow-hidden p-3">
            <div className="relative min-h-0 shrink-0 max-basis-1/2">
              <div ref={groupedSourcesRef} className="h-full space-y-1 overflow-y-auto pr-1">
                {groupedSources.map((group) => (
                  <div key={group.documentName} className="rounded-md border border-border p-3">
                    <p className="text-sm font-medium">{group.documentName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {group.items.length} pages · Top relevance: {Math.round(group.maxScore * 100)}%
                    </p>
                    <div className="mt-3 flex max-h-[200px] flex-wrap gap-2 overflow-y-auto pr-1">
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
              {showGroupedSourcesScrollHint && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-6 items-end justify-center rounded-b-md bg-gradient-to-t from-muted/80 to-transparent pb-1">
                  <ChevronDown className="h-4 w-4 animate-bounce text-muted-foreground" />
                </div>
              )}
            </div>

            {selectedSource && (
              <div className="min-h-0 flex flex-1 flex-col rounded-md border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">Selected source</p>
                  <Dialog open={isSourceDialogOpen} onOpenChange={setIsSourceDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-7 w-7"
                        aria-label="Open selected source in overlay"
                      >
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="h-[85vh] w-[95vw] max-w-6xl p-4 sm:p-6">
                      <DialogHeader>
                        <DialogTitle>
                          {selectedSource.documentName}
                          {selectedSource.pageNumber ? ` · Page ${selectedSource.pageNumber}` : ""}
                        </DialogTitle>
                        <DialogDescription>
                          Expanded view of selected source text and page image.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid min-h-0 flex-1 grid-cols-2 gap-4">
                        <div className="min-h-0 rounded-md border border-border p-4">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Text
                          </p>
                          <div className="mt-3 h-[calc(85vh-13rem)] overflow-y-auto whitespace-pre-wrap text-sm text-muted-foreground">
                            {renderTextWithNer(
                              selectedSource.content,
                              selectedSourceEntities,
                              "overlay",
                              () => setIsSourceDialogOpen(false),
                            )}
                          </div>
                        </div>
                        <div className="min-h-0 rounded-md border border-dashed border-border p-4">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Image
                          </p>
                          {selectedSource.imageUrl ? (
                            <div className="mt-3 h-[calc(85vh-13rem)] overflow-hidden rounded-md border border-border bg-muted/10">
                              <img
                                src={selectedSource.imageUrl}
                                alt={`${selectedSource.documentName}${selectedSource.pageNumber ? ` page ${selectedSource.pageNumber}` : ""}`}
                                className="h-full w-full object-contain"
                              />
                            </div>
                          ) : (
                            <div className="mt-3 flex h-[calc(85vh-13rem)] items-center justify-center rounded-md bg-muted/30">
                              <p className="text-sm text-muted-foreground">
                                Page image preview unavailable
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedSource.documentName}
                  {selectedSource.pageNumber ? ` · Page ${selectedSource.pageNumber}` : ""}
                </p>

                <div className="mt-3 grid min-h-0 flex-1 grid-cols-2 gap-3">
                  <div className="min-h-0 rounded-md border border-border p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Text
                    </p>
                    <div className="mt-2 max-h-full overflow-y-auto whitespace-pre-wrap text-sm text-muted-foreground">
                      {renderTextWithNer(
                        selectedSource.content,
                        selectedSourceEntities,
                        "inline",
                      )}
                    </div>
                  </div>

                  <div className="min-h-0 rounded-md border border-dashed border-border p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Image
                    </p>
                    {selectedSource.imageUrl ? (
                      <div className="mt-2 h-full min-h-0 overflow-hidden rounded-md border border-border bg-muted/10">
                        <img
                          src={selectedSource.imageUrl}
                          alt={`${selectedSource.documentName}${selectedSource.pageNumber ? ` page ${selectedSource.pageNumber}` : ""}`}
                          className="h-full w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="mt-2 flex h-full min-h-0 items-center justify-center rounded-md bg-muted/30">
                        <p className="text-xs text-muted-foreground">
                          Page image preview coming soon
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    </TooltipProvider>
  )
}
