import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import { EMPRESA_ORCAMENTO } from "@/lib/orcamento-pdf"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sql = getSql()

    const recibos = await sql`
      SELECT * FROM recibos_comissao
      WHERE id = ${id} OR numero_recibo = ${id}
      LIMIT 1
    `

    if (recibos.length === 0) {
      return NextResponse.json({ error: "Recibo não encontrado" }, { status: 404 })
    }

    const recibo = recibos[0]

    // Buscar os itens que compõem este recibo
    const itens = await sql`
      SELECT id, numero, cliente_nome, produto_nome, valor_pedido, comissao_percent, valor_comissao, criado_em, pago_em
      FROM comissoes_producao
      WHERE recibo_id = ${recibo.id}
      ORDER BY criado_em ASC
    `

    return NextResponse.json({
      recibo,
      itens,
      empresa: EMPRESA_ORCAMENTO,
    })
  } catch (error) {
    console.error("Erro ao carregar recibo:", error)
    return NextResponse.json({ error: "Erro ao carregar recibo" }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { assinatura_digital } = await req.json()

    if (!assinatura_digital) {
      return NextResponse.json({ error: "Assinatura não informada" }, { status: 400 })
    }

    const sql = getSql()
    const agora = new Date().toISOString()

    await sql`
      UPDATE recibos_comissao
      SET assinatura_digital = ${assinatura_digital},
          tipo_assinatura = 'digital',
          assinado_em = ${agora}
      WHERE id = ${id} OR numero_recibo = ${id}
    `

    return NextResponse.json({ ok: true, assinadoEm: agora })
  } catch (error) {
    console.error("Erro ao atualizar assinatura do recibo:", error)
    return NextResponse.json({ error: "Erro ao atualizar assinatura" }, { status: 500 })
  }
}
