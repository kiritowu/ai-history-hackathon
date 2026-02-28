import weaviate, { WeaviateClient, generativeParameters } from "weaviate-client"

const COLLECTION_NAME = "DemoCollection"
// const COLLECTION_NAME = "DocumentChunkTest"

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
        client = await weaviate.connectToWeaviateCloud(weaviateURL, {
          authCredentials: new weaviate.ApiKey(weaviateKey),
          headers: {
            'X-OpenAI-Api-Key': process.env.OPENAI_API_KEY as string,
          }
        })
      } else {
        client = await weaviate.connectToLocal()
      }
    } catch (error) {
      console.error("Error connecting to Weaviate:", error)
      throw error
    }
  }
  return client
}

export async function ensureCollection() {
  const client = await getWeaviateClient()
  const exists = await client.collections.exists(COLLECTION_NAME)
  if (!exists) {
    await client.collections.create({
      name: COLLECTION_NAME,
      vectorizers: weaviate.configure.vectors.text2VecOpenAI({
        name: "default",
        sourceProperties: ["content"],
      }),
      properties: [
        { name: "content", dataType: "text" as const },
        { name: "documentName", dataType: "text" as const, skipVectorization: true },
        { name: "pageNumber", dataType: "int" as const, skipVectorization: true },
      ],
    })
  }
}

export interface DocumentVector {
  content: string
  documentName: string
  pageNumber?: number
  metadata?: Record<string, any>
}

export async function addDocument(doc: DocumentVector) {
  const client = await getWeaviateClient()
  await ensureCollection()

  try {
    const collection = client.collections.use(COLLECTION_NAME)
    const properties: Record<string, any> = {
      content: doc.content,
      documentName: doc.documentName,
    }
    if (doc.pageNumber != null) {
      properties.pageNumber = doc.pageNumber
    }
    const result = await collection.data.insert(properties)
    return result
  } catch (error) {
    console.error("Error adding document:", error)
    throw error
  }
}

export async function searchDocuments(query: string, limit: number = 5) {
  const client = await getWeaviateClient()
  await ensureCollection()

  try {
    const collection = client.collections.use(COLLECTION_NAME)
    const result = await collection.generate.nearText(query, {
      groupedTask: `Summarize the following search results for the query: "${query}"`,
      config: generativeParameters.openAI({
        // These parameters are optional
        model: 'gpt-5.1',
        // frequencyPenalty: 0,
        // maxTokens: 500,
        // presencePenalty: 0,
        // temperature: 0.7,
        // topP: 0.7,
        // baseURL: "<custom-openai-url>",
      }),
    }, {
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
