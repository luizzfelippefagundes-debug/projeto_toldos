import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import type { EntradaEstoque } from "@/lib/types"

export async function GET() {
  const rows = await getSql()`SELECT * FROM entradas_estoque ORDER BY data DESC`
  const entradas: EntradaEstoque[] = rows.map((r) => ({
    id: r.id as string,
    materialId: r.material_id as string,
    quantidade: Number(r.quantidade),
    fornecedor: (r.fornecedor as string) ?? undefined,
    comNotaFiscal: r.com_nota_fiscal as boolean,
    numeroNota: (r.numero_nota as string) ?? undefined,
    data: r.data as string,
  }))
  return NextResponse.json(entradas)
}

export async function POST(req: Request) {
  const b: EntradaEstoque = await req.json()
  await getSql()`
    INSERT INTO entradas_estoque (id, material_id, quantidade, fornecedor, com_nota_fiscal, numero_nota, data)
    VALUES (${b.id}, ${b.materialId}, ${b.quantidade}, ${b.fornecedor ?? null}, ${b.comNotaFiscal}, ${b.numeroNota ?? null}, ${b.data})
  `
  return NextResponse.json(b, { status: 201 })
}
