import { put } from "@vercel/blob"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const form = await req.formData()
  const file = form.get("file")
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 })
  }

  const MAX_MB = 50
  if (file.size > MAX_MB * 1024 * 1024) {
    return NextResponse.json({ error: `Arquivo maior que ${MAX_MB} MB` }, { status: 413 })
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString("base64")
    const mime = file.type || "application/octet-stream"
    const dataUrl = `data:${mime};base64,${base64}`
    return NextResponse.json({ url: dataUrl, nome: file.name })
  }

  try {
    const blob = await put(`orcamentos/${Date.now()}-${file.name}`, file, {
      access: "public",
    })
    return NextResponse.json({ url: blob.url, nome: file.name })
  } catch {
    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString("base64")
    const mime = file.type || "application/octet-stream"
    const dataUrl = `data:${mime};base64,${base64}`
    return NextResponse.json({ url: dataUrl, nome: file.name })
  }
}
