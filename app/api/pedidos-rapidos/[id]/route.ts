import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import type { PedidoRapido } from "@/lib/types"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const b: PedidoRapido = await req.json()
  await getSql()`
    UPDATE pedidos_rapidos SET
      numero=${b.numero}, produto_id=${b.produtoId}, variante_id=${b.varianteId},
      acabamento=${b.acabamento ?? null}, cliente_nome=${b.clienteNome},
      cliente_telefone=${b.clienteTelefone}, observacao=${b.observacao},
      total=${b.total}, status=${b.status}, criado_em=${b.criadoEm},
      vendedor_id=${b.vendedorId ?? null}, produto_nome=${b.produtoNome ?? null},
      variante_nome=${b.varianteNome ?? null}, prazo_entrega_em=${b.prazoEntregaEm ?? null}
    WHERE id=${id}
  `
  return NextResponse.json(b)
}
