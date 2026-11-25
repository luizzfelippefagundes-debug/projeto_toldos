import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import { consultarPagamentoMercadoPago } from "@/lib/mercadopago"
import { enviarMensagemWhatsapp } from "@/lib/evolution-api"
import { registrarMensagemBot } from "@/lib/bot-registro"
import { formatarMoeda } from "@/lib/format"
import { formatarTelefoneBrasil } from "@/lib/bot-whatsapp"
import { garantirColunasOrcamentos } from "@/lib/migracoes"

export const maxDuration = 60

export async function POST(request: Request) {
  try {
    await garantirColunasOrcamentos()

    const url = new URL(request.url)
    let body: Record<string, unknown> = {}
    try {
      body = await request.json()
    } catch {}

    // O ID do pagamento pode vir no body ou na query string do Mercado Pago
    const dataObj = (body?.data as Record<string, unknown>) ?? {}
    const paymentId = String(dataObj?.id ?? body?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "")

    const topic = String(body?.type ?? body?.topic ?? url.searchParams.get("topic") ?? url.searchParams.get("type") ?? "")

    if (!paymentId) {
      return NextResponse.json({ ok: true, mensagem: "sem id de pagamento" })
    }

    // Se o tópico não for pagamento (ex.: merchant_order), só confirma recebimento
    if (topic && topic !== "payment") {
      return NextResponse.json({ ok: true, topic })
    }

    const pagamento = await consultarPagamentoMercadoPago(paymentId)
    if (!pagamento) {
      return NextResponse.json({ ok: true, aviso: "pagamento não encontrado ou mock" })
    }

    if (pagamento.status === "approved") {
      const sql = getSql()
      const agora = pagamento.pagoEm || new Date().toISOString()
      const orcamentoIdRef = (pagamento.externalReference || "").replace(/^orc-/, "")

      // Busca orçamentos que tenham esse mp_payment_id ou consulta por externalReference
      const orcamentos = await sql`
        SELECT o.id, o.numero, o.cliente_id, o.total_fechado, o.status, o.status_producao,
               c.nome as cliente_nome, c.telefone as cliente_telefone
        FROM orcamentos o
        LEFT JOIN clientes c ON c.id = o.cliente_id
        WHERE o.mp_payment_id = ${paymentId}
           OR o.id = ${orcamentoIdRef}
        LIMIT 1
      `

      if (orcamentos.length > 0) {
        const o = orcamentos[0]
        const formaTexto = pagamento.metodoPagamento === "credit_card"
          ? `Cartão de Crédito${pagamento.parcelas ? ` (${pagamento.parcelas}x)` : ""}`
          : pagamento.metodoPagamento === "debit_card"
            ? "Cartão de Débito"
            : "Pix"

        // Atualiza orçamento para fechado e pago
        await sql`
          UPDATE orcamentos SET
            status = 'fechado',
            pago_em = ${agora},
            mp_payment_id = ${paymentId},
            status_producao = CASE WHEN status_producao = 'aguardando' THEN 'arte' ELSE status_producao END
          WHERE id = ${o.id}
        `

        // Atualiza lançamento financeiro correspondente se existir
        await sql`
          UPDATE lancamentos_financeiros SET
            status = 'pago',
            pago_em = ${agora},
            forma = ${formaTexto}
          WHERE origem = 'orcamento' AND origem_id = ${o.id}
        `

        const valorFormatado = formatarMoeda(pagamento.valor ?? Number(o.total_fechado ?? 0))
        const clienteTelefone = o.cliente_telefone ? String(o.cliente_telefone) : ""
        const clienteNome = String(o.cliente_nome || "Cliente")

        // 1. Notifica o cliente no WhatsApp
        if (clienteTelefone) {
          const msgCliente =
            `Olá, ${clienteNome.split(" ")[0]}! 🎉\n\n` +
            `Confirmamos o recebimento do seu pagamento via ${formaTexto} no valor de *${valorFormatado}* referente ao pedido *#${o.numero}* da Toldos Print!\n\n` +
            `Seu pedido já está confirmado e em andamento. Qualquer dúvida é só chamar por aqui! 😊`

          await enviarMensagemWhatsapp(clienteTelefone, msgCliente).catch(() => {})
          await registrarMensagemBot({
            clienteId: (o.cliente_id as string) ?? null,
            clienteNome,
            telefone: clienteTelefone,
            texto: msgCliente,
            origem: "automatica",
            autor: "bot",
          }).catch(() => {})
        }

        // 2. Notifica a empresa no WhatsApp
        const telEmpresa = process.env.WHATSAPP_EMPRESA_NUMERO
        if (telEmpresa) {
          const tituloEmpresa = pagamento.metodoPagamento?.includes("card")
            ? `💳 *PAGAMENTO RECEBIDO - CARTÃO (${pagamento.parcelas || 1}x)!*`
            : `💰 *PAGAMENTO RECEBIDO - PIX!*`

          const msgEmpresa =
            `${tituloEmpresa}\n\n` +
            `👤 *Cliente:* ${clienteNome}\n` +
            `📋 *Pedido:* #${o.numero}\n` +
            `💵 *Valor:* ${valorFormatado}\n` +
            `💳 *Forma:* ${formaTexto}\n` +
            `📱 *WhatsApp:* ${formatarTelefoneBrasil(clienteTelefone)}\n\n` +
            `✅ Status do pedido e financeiro atualizados automaticamente!`

          await enviarMensagemWhatsapp(telEmpresa, msgEmpresa).catch(() => {})
        }
      }
    }

    return NextResponse.json({ ok: true, status: pagamento.status })
  } catch (err: any) {
    console.error("[mercadopago webhook] Erro:", err)
    return NextResponse.json({ ok: true, erro: err?.message })
  }
}
