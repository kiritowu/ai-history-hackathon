import { ensureCollection, addDocument } from "@/lib/weaviate"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return Response.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }

    await ensureCollection()

    const text = await file.text()
    const documentName = file.name

    // Add document to Weaviate
    await addDocument({
      content: text,
      documentName,
      metadata: {
        uploadedAt: new Date().toISOString(),
        fileType: file.type,
      },
    })

    return Response.json({
      documentId: documentName,
      success: true,
    })
  } catch (error) {
    console.error("Error uploading document:", error)
    return Response.json(
      { error: "Failed to upload document" },
      { status: 500 }
    )
  }
}
