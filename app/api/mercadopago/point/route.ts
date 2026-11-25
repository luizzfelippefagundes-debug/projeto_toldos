import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import {
  listarMaquininhasPoint,
  enviarCobrancaPoint,
  cancelarCobrancaPoint,
  consultarCobrancaPoint,
} from "@/lib/mercadopago"
import { formatarNumeroOrcamento } from "@/lib/orcamento-pdf"
import { garantirColunasOrcamentos } from "@/lib/migracoes"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const intentId = url.searchParams.get("intentId")

    if (intentId) {
      const statusIntent = await consultarCobrancaPoint(intentId)
      return NextResponse.json({ ok: true, dados: statusIntent })
    }

    const maquininhas = await listarMaquininhasPoint()
    return NextResponse.json({ ok: true, maquininhas })
  } catch (err: any) {
    console.error("[api/point] Erro GET:", err)
    return NextResponse.json({ erro: err?.message || "Erro ao consultar maquininhas" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await garantirColunasOrcamentos()
    const { orcamentoId, deviceId, valor } = await request.json()

    if (!deviceId) {
      return NextResponse.json({ erro: "deviceId da maquininha é obrigatório" }, { status: 400 })
    }

    const sql = getSql()
    let valorCobrar = valor ? Number(valor) : 0
    let desc = "Pagamento Toldos Print"
    let externalRef = `point-${Date.now()}`

    if (orcamentoId) {
      const orcamentos = await sql`
        SELECT o.id, o.numero, o.criado_em, o.total_fechado
        FROM orcamentos o
        WHERE o.id = ${orcamentoId}
        LIMIT 1
      `
      if (orcamentos.length > 0) {
        const o = orcamentos[0]
        if (!valorCobrar) {
          valorCobrar = Number(o.total_fechado || 0)
        }
        desc = `OS #${formatarNumeroOrcamento(o.numero as number, o.criado_em as string)} - Toldos Print`
        externalRef = `orc-${o.id}`
      }
    }

    if (!valorCobrar || valorCobrar <= 0) {
      return NextResponse.json({ erro: "Valor inválido para cobrança" }, { status: 400 })
    }

    const res = await enviarCobrancaPoint({
      deviceId,
      valor: valorCobrar,
      descricao: desc,
      externalReference: externalRef,
    })

    if (!res.sucesso) {
      return NextResponse.json({ erro: res.erro || "Falha ao enviar para a maquininha" }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      intentId: res.intentId,
      valor: valorCobrar,
      deviceId,
      descricao: desc,
    })
  } catch (err: any) {
    console.error("[api/point] Erro POST:", err)
    return NextResponse.json({ erro: err?.message || "Erro ao enviar cobrança" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { deviceId, intentId } = await request.json()
    if (!deviceId || !intentId) {
      return NextResponse.json({ erro: "deviceId e intentId são obrigatórios" }, { status: 400 })
    }

    const res = await cancelarCobrancaPoint({ deviceId, intentId })
    return NextResponse.json(res)
  } catch (err: any) {
    console.error("[api/point] Erro DELETE:", err)
    return NextResponse.json({ erro: err?.message || "Erro ao cancelar cobrança" }, { status: 500 })
  }
}
