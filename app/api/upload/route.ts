import { put } from "@vercel/blob"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const file = form.get("file")
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 })
    }

    const MAX_MB = 100
    if (file.size > MAX_MB * 1024 * 1024) {
      return NextResponse.json({ error: `Arquivo maior que ${MAX_MB} MB` }, { status: 413 })
    }

    const nomeLimpo = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const base64 = buffer.toString("base64")
      const mime = file.type || "application/octet-stream"
      const dataUrl = `data:${mime};base64,${base64}`
      return NextResponse.json({ url: dataUrl, nome: nomeLimpo })
    }

    try {
      const blob = await put(`orcamentos/${Date.now()}-${nomeLimpo}`, file, {
        access: "public",
      })
      return NextResponse.json({ url: blob.url, nome: nomeLimpo })
    } catch {
      const buffer = Buffer.from(await file.arrayBuffer())
      const base64 = buffer.toString("base64")
      const mime = file.type || "application/octet-stream"
      const dataUrl = `data:${mime};base64,${base64}`
      return NextResponse.json({ url: dataUrl, nome: nomeLimpo })
    }
  } catch (err: any) {
    console.error("[api/upload] erro ao processar upload:", err)
    return NextResponse.json({ error: err?.message || "Erro no upload do arquivo" }, { status: 500 })
  }
}
