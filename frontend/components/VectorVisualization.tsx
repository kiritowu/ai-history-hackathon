"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Sparkles } from "lucide-react"
import ReactMarkdown from "react-markdown"
import * as d3 from "d3"

interface Node {
  id: string
  label: string
  group: number
  documentName?: string
  source?: string
  summary?: string
  snippet?: string
  pageCount?: number | null
  x?: number
  y?: number
}

interface Link {
  source: string | Node
  target: string | Node
  distance: number
}

export function VectorVisualization() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [data, setData] = useState<{ nodes: Node[]; links: Link[] }>({
    nodes: [],
    links: [],
  })
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchClusterData()
  }, [])

  const fetchClusterData = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/clusters")
      const clusterData = await response.json()
      setData(clusterData || { nodes: [], links: [] })
      setSelectedNodeId(null)
    } catch (error) {
      console.error("Error fetching cluster data:", error)
      setData({ nodes: [], links: [] })
      setSelectedNodeId(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!data.nodes || data.nodes.length === 0 || !svgRef.current) return

    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight

    // Clear previous content
    d3.select(svgRef.current).selectAll("*").remove()

    const svg = d3.select(svgRef.current)

    // Create a group for zoom/pan
    const g = svg.append("g")

    // Create simulation
    const simulation = d3
      .forceSimulation(data.nodes)
      .force(
        "link",
        d3
          .forceLink(data.links)
          .id((d: any) => d.id)
          .distance(100)
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))

    // Create links
    const link = g
      .append("g")
      .selectAll("line")
      .data(data.links)
      .enter()
      .append("line")
      .attr("stroke", "rgba(100, 200, 255, 0.3)")
      .attr("stroke-opacity", 0.5)
      .attr("stroke-width", (d: any) => Math.sqrt(d.distance) * 2)

    // Create nodes
    const node = g
      .append("g")
      .selectAll("circle")
      .data(data.nodes)
      .enter()
      .append("circle")
      .attr("r", 10)
      .attr("fill", (d: any) => {
        const colors = [
          "#3b82f6", // blue
          "#06b6d4", // cyan
          "#8b5cf6", // purple
          "#ec4899", // pink
          "#f59e0b", // amber
        ]
        return colors[d.group % colors.length]
      })
      .attr("opacity", 0.8)
      .attr("stroke", (d: any) => (d.id === selectedNodeId ? "#111111" : "rgba(255, 255, 255, 0.3)"))
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
      .on("click", (_event, d: any) => {
        setSelectedNodeId(d.id)
      })
      .on("mouseenter", function() {
        d3.select(this).transition().duration(200).attr("r", 14)
      })
      .on("mouseleave", function() {
        d3.select(this).transition().duration(200).attr("r", 10)
      })
      .call(
        d3
          .drag<SVGCircleElement, Node>()
          .on("start", dragStarted)
          .on("drag", dragged)
          .on("end", dragEnded) as any
      )

    // Add labels
    const labels = g
      .append("g")
      .selectAll("text")
      .data(data.nodes)
      .enter()
      .append("text")
      .text((d: any) => d.label)
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .attr("fill", "#000000")
      .attr("text-anchor", "middle")
      .attr("dy", "0.3em")
      .attr("pointer-events", "none")

    // Add zoom/pan functionality
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .on("zoom", (event) => {
        g.attr("transform", event.transform)
      })

    svg.call(zoom)

    // Update positions on simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y)

      node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y)
      node
        .attr("stroke", (d: any) => (d.id === selectedNodeId ? "#111111" : "rgba(255, 255, 255, 0.3)"))
        .attr("stroke-width", (d: any) => (d.id === selectedNodeId ? 2.5 : 1))

      labels.attr("x", (d: any) => d.x).attr("y", (d: any) => d.y)
    })

    function dragStarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart()
      d.fx = d.x
      d.fy = d.y
    }

    function dragged(event: any, d: any) {
      d.fx = event.x
      d.fy = event.y
    }

    function dragEnded(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0)
      d.fx = null
      d.fy = null
    }

    return () => {
      simulation.stop()
    }
  }, [data, selectedNodeId])

  const selectedNode = data.nodes.find((node) => node.id === selectedNodeId) ?? null

  return (
    <div className="h-full flex bg-white/30 dark:bg-white/5 backdrop-blur-sm border border-border overflow-hidden">
      <div className="min-w-0 flex flex-1 flex-col">
        {/* Header */}
        <div className="shrink-0 border-b border-border px-6 py-4 bg-background">
          <div className="flex flex-row items-start justify-between gap-3">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                <h2 className="text-xl font-semibold">Semantic Network</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Explore relationships across documents.
              </p>
            </div>
          <Button
            onClick={fetchClusterData}
            className="h-9 px-4 text-sm"
            disabled={isLoading}
          >
            Refresh
          </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-0 relative overflow-hidden">
          {isLoading ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-white/20 to-white/5 dark:from-white/5 dark:to-transparent">
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-purple-600 dark:border-t-purple-400 border-r-pink-600 dark:border-r-pink-400 animate-spin"></div>
                <div
                  className="absolute inset-2 rounded-full border-2 border-transparent border-b-cyan-600 dark:border-b-cyan-400 animate-spin"
                  style={{ animationDirection: "reverse", animationDuration: "1.5s" }}
                ></div>
              </div>
              <p className="text-muted-foreground font-medium">Loading vector space...</p>
            </div>
          ) : !data.nodes || data.nodes.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/20 to-white/5 dark:from-white/5 dark:to-transparent">
              <div className="text-center space-y-4">
                <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 dark:from-purple-500/10 dark:to-pink-500/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <p className="text-muted-foreground">Upload documents to visualize semantic relationships</p>
              </div>
            </div>
          ) : (
            <>
              <svg
                ref={svgRef}
                className="w-full h-full"
                style={{ minHeight: "400px", background: "linear-gradient(135deg, rgba(168, 85, 247, 0.05) 0%, rgba(34, 211, 238, 0.05) 100%)" }}
              />
              {/* Grid overlay */}
              <div className="absolute inset-0 pointer-events-none opacity-10">
                <svg className="w-full h-full">
                  <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
              </div>
            </>
          )}
        </div>
      </div>

      <aside className="w-1/2 shrink-0 border-l border-border bg-white/70 dark:bg-black/20 backdrop-blur-sm">
        {!selectedNode ? (
          <div className="h-full flex items-center justify-center p-6 text-center">
            <div>
              <p className="text-sm font-medium">Select a node</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Click any node to view file details.
              </p>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto p-5 space-y-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">File name</p>
              <p className="mt-1 text-base font-semibold break-words">
                {selectedNode.documentName || selectedNode.label || "Untitled document"}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Page count</p>
              <p className="mt-1 text-sm font-medium">
                {typeof selectedNode.pageCount === "number" ? selectedNode.pageCount : "N/A"}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Summary</p>
              <div className="mt-1 text-sm leading-6 text-foreground/90 break-words">
                <ReactMarkdown>
                  {selectedNode.summary || "No summary available for this file yet."}
                </ReactMarkdown>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Source</p>
              <p className="mt-1 text-sm break-words text-foreground/90">
                {selectedNode.source || "N/A"}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Excerpt</p>
              <p className="mt-1 text-sm text-foreground/90 whitespace-pre-wrap">
                {selectedNode.snippet || "No excerpt available."}
              </p>
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}
