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

    // Extract vectors and prepare data
    const vectors = documents
      .map((doc: any) => doc.vectors?.default || doc.vector)
      .filter((v: any) => v && Array.isArray(v))

    if (vectors.length === 0) {
      return NextResponse.json({ nodes: [], links: [] })
    }

    // Cluster documents
    const { labels } = kMeansClustering(vectors, Math.min(5, vectors.length))

    // Create nodes
    const nodes = documents.map((doc: any, i: number) => {
      // Try to get a meaningful label from content or documentName
      let label = "Document"
      if (doc.properties?.content) {
        label = doc.properties.content.substring(0, 30).replace(/\n/g, " ")
      } else if (doc.properties?.documentName) {
        label = doc.properties.documentName.split("/").pop() || "Document"
      }
      return {
        id: doc.id || i.toString(),
        label: label.substring(0, 25),
        group: labels[i],
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
