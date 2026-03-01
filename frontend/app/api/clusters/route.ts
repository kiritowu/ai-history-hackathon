import { NextResponse } from "next/server"
import { getDocumentClusters } from "@/lib/weaviate"

// Simple cosine similarity function
function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0)
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
  return dotProduct / (magnitudeA * magnitudeB)
}

// K-means clustering
function kMeansClustering(
  vectors: number[][],
  k: number = 5
): { clusters: number[][]; labels: number[] } {
  const labels = new Array(vectors.length).fill(0)
  const clusters: number[][] = []

  // Initialize centroids
  for (let i = 0; i < k; i++) {
    clusters.push([...vectors[i]])
  }

  for (let iteration = 0; iteration < 10; iteration++) {
    // Assign points to nearest centroid
    for (let i = 0; i < vectors.length; i++) {
      let minDistance = Infinity
      let closestCluster = 0

      for (let j = 0; j < clusters.length; j++) {
        const distance = 1 - cosineSimilarity(vectors[i], clusters[j])
        if (distance < minDistance) {
          minDistance = distance
          closestCluster = j
        }
      }

      labels[i] = closestCluster
    }

    // Update centroids
    for (let j = 0; j < clusters.length; j++) {
      const clusterPoints = vectors.filter((_, i) => labels[i] === j)
      if (clusterPoints.length > 0) {
        const newCentroid = new Array(vectors[0].length)
          .fill(0)
          .map((_, dim) =>
            clusterPoints.reduce((sum, point) => sum + point[dim], 0) /
            clusterPoints.length
          )
        clusters[j] = newCentroid
      }
    }
  }

  return { clusters, labels }
}

export async function GET() {
  try {
    const result = await getDocumentClusters()

    if (!result.objects || result.objects.length === 0) {
      return NextResponse.json({ nodes: [], links: [] })
    }

    const documents = result.objects

    // Keep document/vector alignment by filtering objects once.
    const vectorizedDocuments = documents.filter((doc: any) => {
      const vector = doc.vectors?.default || doc.vector
      return vector && Array.isArray(vector)
    })
    const vectors = vectorizedDocuments.map(
      (doc: any) => (doc.vectors?.default || doc.vector) as number[]
    )

    if (vectors.length === 0) {
      return NextResponse.json({ nodes: [], links: [] })
    }

    // Cluster documents
    const { labels } = kMeansClustering(vectors, Math.min(5, vectors.length))

    // Create nodes
    const nodes = vectorizedDocuments.map((doc: any, i: number) => {
      // Prefer your current schema fields first: text + source.
      const text =
        doc.properties?.text ||
        doc.properties?.content ||
        ""
      const sourceRaw = doc.properties?.source
      const source = typeof sourceRaw === "string" ? sourceRaw : ""
      const summaryRaw = doc.properties?.summary
      const summary = typeof summaryRaw === "string" ? summaryRaw : ""
      const pageCountRaw = doc.properties?.pageCount
      const pageCount =
        typeof pageCountRaw === "number"
          ? pageCountRaw
          : typeof pageCountRaw === "string"
            ? Number.parseInt(pageCountRaw, 10)
            : null

      const sourceLabel =
        source.split("/").pop() ||
        doc.properties?.documentName ||
        "Document"
      const textSnippet = text
        ? text.substring(0, 24).replace(/\n/g, " ").trim()
        : "Document"

      const label = text
        ? `${sourceLabel}: ${textSnippet}`
        : sourceLabel

      return {
        id: doc.id || i.toString(),
        label: label.substring(0, 25),
        group: labels[i],
        documentName: doc.properties?.documentName || sourceLabel,
        source: source || null,
        pageCount: Number.isFinite(pageCount) ? pageCount : null,
        summary: summary.trim(),
        snippet: text.substring(0, 500).trim(),
      }
    })

    // Create links for similar documents
    const links: any[] = []
    const threshold = 0.7

    for (let i = 0; i < vectors.length; i++) {
      for (let j = i + 1; j < vectors.length; j++) {
        try {
          const similarity = cosineSimilarity(vectors[i], vectors[j])

          if (similarity > threshold) {
            links.push({
              source: nodes[i].id,
              target: nodes[j].id,
              distance: 1 - similarity,
            })
          }
        } catch (linkError) {
          console.warn(`Failed to calculate similarity between documents ${i} and ${j}`)
        }
      }
    }

    return NextResponse.json({ nodes, links })
  } catch (error) {
    console.error("Clusters API error:", error)
    // Return empty data instead of error to avoid breaking the UI
    return NextResponse.json({ nodes: [], links: [] })
  }
}
