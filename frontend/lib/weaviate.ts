import weaviate, { WeaviateClient } from "weaviate-client"

const COLLECTION_NAME = "DocumentChunkTest"

let client: WeaviateClient | null = null

export async function getWeaviateClient() {
  if (!client) {
    const weaviateURL = process.env.WEAVIATE_URL as string
    const weaviateKey = process.env.WEAVIATE_API_KEY as string

    if (!weaviateURL) {
      throw new Error("WEAVIATE_URL environment variable not set")
    }

    try {
      if (weaviateKey) {
        // Use WCD (Weaviate Cloud Deployment) connection
        client = await weaviate.connectToWeaviateCloud(weaviateURL, {
          authCredentials: new weaviate.ApiKey(weaviateKey),
          headers: {
            'X-OpenAI-Api-Key': process.env.OPENAI_API_KEY,
          }
        })
      } else {
        // Use local connection (no auth)
        client = await weaviate.connectToLocal()
      }
    } catch (error) {
      console.error("Error connecting to Weaviate:", error)
      throw error
    }
  }
  return client
}

export interface DocumentVector {
  content: string
  documentName: string
  pageNumber?: number
  metadata?: Record<string, any>
  vector?: number[]
}

export async function addDocument(doc: DocumentVector) {
  const client = await getWeaviateClient()

  const obj = {
    content: doc.content,
    documentName: doc.documentName,
    pageNumber: doc.pageNumber,
  }

  try {
    const collection = client.collections.use(COLLECTION_NAME)
    const result = await collection.data.insert(obj)
    return result
  } catch (error) {
    console.error("Error adding document:", error)
    throw error
  }
}

export async function searchDocuments(query: string, limit: number = 5) {
  const client = await getWeaviateClient()

  try {
    const collection = client.collections.use(COLLECTION_NAME)
    const result = await collection.query.nearText(query, {
      limit,
      returnMetadata: ["distance"],
    })

    return result
  } catch (error) {
    console.error("Error searching documents:", error)
    throw error
  }
}

export async function getAllDocuments() {
  const client = await getWeaviateClient()

  try {
    const collection = client.collections.use(COLLECTION_NAME)
    const result = await collection.query.fetchObjects({
      limit: 1000,
    })

    return result
  } catch (error) {
    console.error("Error getting all documents:", error)
    throw error
  }
}

export async function getDocumentClusters() {
  const client = await getWeaviateClient()

  try {
    const collection = client.collections.use(COLLECTION_NAME)
    const result = await collection.query.fetchObjects({
      limit: 1000,
      includeVector: true,
    })

    return result
  } catch (error) {
    console.error("Error getting document clusters:", error)
    throw error
  }
}
