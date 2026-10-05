import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import type { MensagemBot } from "@/lib/types"

export async function GET() {
  const rows = await getSql()`SELECT * FROM mensagens_bot ORDER BY criado_em ASC`
  const mensagens: MensagemBot[] = rows.map((r) => ({
    id: r.id as string,
    clienteId: (r.cliente_id as string) ?? undefined,
    clienteNome: r.cliente_nome as string,
    telefone: r.telefone as string,
    texto: r.texto as string,
    origem: r.origem as MensagemBot["origem"],
    autor: r.autor as MensagemBot["autor"],
    criadoEm: r.criado_em as string,
  }))
  return NextResponse.json(mensagens)
}

export async function POST(req: Request) {
  const b: MensagemBot = await req.json()
  await getSql()`
    INSERT INTO mensagens_bot (id, cliente_id, cliente_nome, telefone, texto, origem, autor, criado_em)
    VALUES (${b.id}, ${b.clienteId ?? null}, ${b.clienteNome}, ${b.telefone}, ${b.texto}, ${b.origem}, ${b.autor}, ${b.criadoEm})
  `
  return NextResponse.json(b, { status: 201 })
}
