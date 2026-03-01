import weaviate, { WeaviateClient } from "weaviate-client"

const WEAVIATE_COLLECTION = process.env.WEAVIATE_COLLECTION || "TEST2"

let client: WeaviateClient | null = null

export async function getWeaviateClient() {
  if (!client) {
    const weaviateURL = process.env.WEAVIATE_URL as string
    const weaviateKey = process.env.WEAVIATE_API_KEY as string

    if (!weaviateURL || !weaviateKey) {
      throw new Error("WEAVIATE_URL and WEAVIATE_API_KEY environment variables not set")
    }

    try {
        client = await weaviate.connectToWeaviateCloud(weaviateURL, {
          authCredentials: new weaviate.ApiKey(weaviateKey),
          skipInitChecks: true,
        })
    } catch (error) {
      console.error("Error connecting to Weaviate:", error)
      throw error
    }
  }
  return client
}

export async function getDocumentClusters() {
  const client = await getWeaviateClient()

  try {
    const collection = client.collections.use(WEAVIATE_COLLECTION)
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
