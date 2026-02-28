"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
      .on("mouseenter", function(d: any) {
        d3.select(this).transition().duration(200).attr("r", 14)
      })
      .on("mouseleave", function(d: any) {
        d3.select(this).transition().duration(200).attr("r", 10)
      })
      .call(
        d3
          .drag()
          .on("start", dragStarted)
          .on("drag", dragged)
          .on("end", dragEnded)
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
    <Card className="h-full flex flex-col glass rounded-xl overflow-hidden border-white/20">
      <CardHeader className="flex flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-white/10">
        <div>
          <CardTitle className="gradient-text text-2xl">Vector Space</CardTitle>
          <p className="text-muted-foreground text-sm mt-1">Semantic clustering of AI history</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchClusterData}
          className="glass border-white/20 hover:bg-white/10 text-blue-400 hover:text-blue-300"
        >
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="flex-1 p-0 relative">
        {isLoading ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-400 border-r-cyan-400 animate-spin"></div>
              <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-purple-400 animate-spin" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
            </div>
            <p className="text-muted-foreground">Loading cluster data...</p>
          </div>
        ) : !data.nodes || data.nodes.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-muted-foreground">No data to visualize</p>
          </div>
        ) : (
          <>
            <svg
              ref={svgRef}
              className="w-full h-full"
              style={{ minHeight: "400px" }}
            />
            {/* Grid overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-5">
              <svg className="w-full h-full">
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
