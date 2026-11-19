import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import { garantirCpfClientes } from "@/lib/migracoes"
import type { Cliente } from "@/lib/types"

export async function GET() {
  await garantirCpfClientes()
  const rows = await getSql()`SELECT * FROM clientes ORDER BY nome`
  const clientes: Cliente[] = rows.map((r) => ({
    id: r.id,
    nome: r.nome,
    telefone: r.telefone,
    email: r.email ?? undefined,
    cpf: r.cpf ?? undefined,
    origem: (r.origem as string) ?? undefined,
  }))
  return NextResponse.json(clientes)
}

export async function POST(req: Request) {
  await garantirCpfClientes()
  const b: Cliente = await req.json()
  await getSql()`
    INSERT INTO clientes (id, nome, telefone, email, cpf, origem)
    VALUES (${b.id}, ${b.nome}, ${b.telefone}, ${b.email ?? null}, ${b.cpf ?? null}, ${b.origem ?? null})
  `
  return NextResponse.json(b, { status: 201 })
}
