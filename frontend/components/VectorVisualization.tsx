"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import * as d3 from "d3"

interface Node {
  id: string
  label: string
  group: number
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
    } catch (error) {
      console.error("Error fetching cluster data:", error)
      setData({ nodes: [], links: [] })
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
      .attr("stroke", "rgba(255, 255, 255, 0.3)")
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
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
      .attr("fill", "rgba(255, 255, 255, 0.8)")
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
  }, [data])

  return (
    <div className="h-full flex flex-col bg-white/30 dark:bg-white/5 backdrop-blur-sm rounded-2xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex flex-row items-center justify-between px-8 py-6 border-b border-border bg-white/40 dark:bg-white/5">
        <div>
          <h2 className="text-2xl font-bold gradient-text">Semantic Network</h2>
          <p className="text-muted-foreground text-sm mt-1">Explore relationships across documents</p>
        </div>
        <Button 
          onClick={fetchClusterData}
          className="button-primary px-6 h-10 text-sm shadow-lg shadow-purple-500/30 dark:shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/40"
          disabled={isLoading}
        >
          Refresh
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 p-0 relative overflow-hidden">
        {isLoading ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-white/20 to-white/5 dark:from-white/5 dark:to-transparent">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-purple-600 dark:border-t-purple-400 border-r-pink-600 dark:border-r-pink-400 animate-spin"></div>
              <div 
                className="absolute inset-2 rounded-full border-2 border-transparent border-b-cyan-600 dark:border-b-cyan-400 animate-spin" 
                style={{animationDirection: 'reverse', animationDuration: '1.5s'}}
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
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
