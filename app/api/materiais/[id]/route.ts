import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import type { Material } from "@/lib/types"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const b: Omit<Material, "id"> = await req.json()
  await getSql()`
    UPDATE materiais
    SET nome=${b.nome}, tipo=${b.tipo}, unidade=${b.unidade},
        preco_unitario=${b.precoUnitario}, estoque_minimo=${b.estoqueMinimo},
        quantidade_estoque=${b.quantidadeEstoque}
    WHERE id=${id}
  `
  return NextResponse.json({ id, ...b })
}
