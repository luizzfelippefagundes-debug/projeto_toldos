import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import { criarPixMercadoPago } from "@/lib/mercadopago"
import { formatarNumeroOrcamento } from "@/lib/orcamento-pdf"
import { garantirColunasOrcamentos } from "@/lib/migracoes"

export async function POST(request: Request) {
  try {
    await garantirColunasOrcamentos()
    const { orcamentoId, valor, descricao } = await request.json()

    if (!orcamentoId && (!valor || valor <= 0)) {
      return NextResponse.json({ erro: "orcamentoId ou valor válido é obrigatório" }, { status: 400 })
    }

    const sql = getSql()
    let clienteNome = "Cliente"
    let clienteEmail = "financeiro@toldosprint.com.br"
    let clienteCpf = ""
    let valorCobrar = valor ? Number(valor) : 0
    let desc = descricao || "Pagamento Toldos Print"
    let externalRef = `pix-${Date.now()}`

    if (orcamentoId) {
      const orcamentos = await sql`
        SELECT o.id, o.numero, o.criado_em, o.total_fechado, o.pix_copia_cola, o.pix_qr_code_base64,
               c.nome as cliente_nome, c.email as cliente_email, c.cpf as cliente_cpf
        FROM orcamentos o
        LEFT JOIN clientes c ON c.id = o.cliente_id
        WHERE o.id = ${orcamentoId}
        LIMIT 1
      `

      if (orcamentos.length === 0) {
        return NextResponse.json({ erro: "Orçamento não encontrado" }, { status: 404 })
      }

      const o = orcamentos[0]
      clienteNome = String(o.cliente_nome || "Cliente")
      clienteEmail = String(o.cliente_email || clienteEmail)
      clienteCpf = String(o.cliente_cpf || "")
      if (!valorCobrar) {
        valorCobrar = Number(o.total_fechado || 0)
      }
      desc = `Orçamento #${formatarNumeroOrcamento(o.numero as number, o.criado_em as string)} - Toldos Print`
      externalRef = `orc-${o.id}`
    }

    const pix = await criarPixMercadoPago({
      valor: valorCobrar,
      descricao: desc,
      clienteNome,
      clienteEmail,
      clienteCpf,
      externalReference: externalRef,
    })

    // Salva no orçamento para ficar persistido e disponível na OS / documento de entrega
    if (orcamentoId && pix.sucesso) {
      await sql`
        UPDATE orcamentos SET
          mp_payment_id = ${pix.pagamentoId || null},
          pix_copia_cola = ${pix.qrCode || null},
          pix_qr_code_base64 = ${pix.qrCodeBase64 || null}
        WHERE id = ${orcamentoId}
      `
    }

    return NextResponse.json({
      ok: true,
      pix,
      valor: valorCobrar,
      descricao: desc,
    })
  } catch (err: any) {
    console.error("[criar-pix] Erro:", err)
    return NextResponse.json({ erro: err?.message || "Erro ao gerar Pix" }, { status: 500 })
  }
}
