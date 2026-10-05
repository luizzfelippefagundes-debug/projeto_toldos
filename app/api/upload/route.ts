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

  const blob = await put(`orcamentos/${Date.now()}-${file.name}`, file, {
    access: "public",
  })

  return NextResponse.json({ url: blob.url, nome: file.name })
}
