import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { getSql } from "@/lib/db"
import { enviarMensagemWhatsapp } from "@/lib/evolution-api"
import { formatarNumeroOrcamento } from "@/lib/orcamento-pdf"
import { formatarMoeda } from "@/lib/format"
import { gerarPayloadPixEstatico, criarLinkPagamentoMercadoPago } from "@/lib/mercadopago"
import { registrarMensagemBot } from "@/lib/bot-registro"
import { garantirTabelaAssinaturasOs, garantirColunasOrcamentos } from "@/lib/migracoes"
import type { Orcamento } from "@/lib/types"

export async function POST(req: Request) {
  try {
    const { orcamentoId, telefone, clienteNome, valor, numero } = await req.json()

    if (!telefone) {
      return NextResponse.json({ erro: "Telefone do cliente é obrigatório" }, { status: 400 })
    }

    await garantirColunasOrcamentos()
    await garantirTabelaAssinaturasOs()

    const sql = getSql()
    let totalFinal = Number(valor || 0)
    let numeroOS = numero ? String(numero) : ""
    let nomeClienteFinal = clienteNome || "Cliente"
    let linkAssinatura = ""
    let linkPagamento = ""
    let clienteId: string | null = null

    if (orcamentoId) {
      const semPrefixo = orcamentoId.startsWith("orc-") ? orcamentoId.slice(4) : orcamentoId
      const comPrefixo = orcamentoId.startsWith("orc-") ? orcamentoId : `orc-${orcamentoId}`

      const rows = await sql`
        SELECT * FROM orcamentos 
        WHERE id = ${orcamentoId} OR id = ${comPrefixo} OR id = ${semPrefixo} 
        LIMIT 1
      `

      if (rows.length > 0) {
        const r = rows[0]
        const orcamento = {
          id: r.id,
          numero: r.numero,
          clienteId: r.cliente_id,
          item: r.item,
          materialFechado: r.material_fechado,
          servicoFechado: r.servico_fechado,
          totalFechado: r.total_fechado ? Number(r.total_fechado) : undefined,
          ajusteManual: Number(r.ajuste_manual ?? 0),
          anexoNome: r.anexo_nome,
          anexoUrl: r.anexo_url,
          status: r.status,
          criadoEm: r.criado_em,
          fechadoEm: r.fechado_em,
          validadeDias: r.validade_dias ?? undefined,
        } as Orcamento

        clienteId = orcamento.clienteId ?? null
        totalFinal = orcamento.totalFechado ? Number(orcamento.totalFechado) : totalFinal
        numeroOS = formatarNumeroOrcamento(orcamento.numero, orcamento.criadoEm)

        const clienteRows = await sql`SELECT nome, telefone FROM clientes WHERE id = ${orcamento.clienteId} LIMIT 1`
        if (clienteRows.length > 0) {
          nomeClienteFinal = (clienteRows[0].nome as string) || nomeClienteFinal
        }

        // 1. Verificação se o cliente JÁ ASSINOU a Ordem de Serviço
        const assinRows = await sql`
          SELECT id, assinado_em 
          FROM assinaturas_os 
          WHERE orcamento_id = ${orcamento.id} 
          ORDER BY criado_em DESC 
          LIMIT 1
        `
        const jaAssinado = !!assinRows[0]?.assinado_em

        if (jaAssinado) {
          // Cliente já assinou! O sistema reconhece e não envia link de assinatura novamente
          linkAssinatura = ""
        } else {
          let tokenAssinatura = assinRows[0]?.id as string | undefined
          if (!tokenAssinatura) {
            tokenAssinatura = randomUUID()
            const agora = new Date()
            const expira = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000)
            await sql`
              INSERT INTO assinaturas_os (id, orcamento_id, criado_em, expira_em)
              VALUES (${tokenAssinatura}, ${orcamento.id}, ${agora.toISOString()}, ${expira.toISOString()})
            `
          }
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL
            ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://sistema.toldosprint.com.br")
          linkAssinatura = `${baseUrl}/assinar/${tokenAssinatura}`
        }

        // 2. Link de Cartão de Crédito Mercado Pago
        linkPagamento = (r.link_pagamento as string | null) ?? ""
        if (!linkPagamento && totalFinal > 0) {
          try {
            const resMp = await criarLinkPagamentoMercadoPago({
              valor: totalFinal,
              descricao: `Ordem de Serviço #${numeroOS} - Toldos Print`,
              externalReference: `orc-${orcamento.id}`,
              clienteNome: nomeClienteFinal,
              clienteTelefone: telefone,
            })
            if (resMp.linkPagamento) {
              linkPagamento = resMp.linkPagamento
              await sql`UPDATE orcamentos SET link_pagamento = ${linkPagamento}, mp_preference_id = ${resMp.preferenciaId || null} WHERE id = ${orcamento.id}`
            }
          } catch (e) {
            console.warn("[enviar-cobranca] Erro ao criar link MP:", e)
          }
        }
      }
    }

    // 3. Chave Pix & Payload Copia e Cola Oficial
    const chavePix = "63.177.134/0001-00"
    const chaveNumeros = "63177134000100"
    const pixCopiaCola = totalFinal > 0
      ? gerarPayloadPixEstatico({
          chave: chaveNumeros || chavePix,
          nome: process.env.PIX_NOME_BENEFICIARIO || "TOLDOS PRINT",
          cidade: process.env.PIX_CIDADE_BENEFICIARIO || "COLATINA",
          valor: totalFinal,
          identificador: String(numeroOS || "TOLDOS"),
        })
      : ""

    const totalFormatado = formatarMoeda(totalFinal)
    const primeiroNome = nomeClienteFinal.split(" ")[0]

    const linkCartaoBloco = linkPagamento
      ? `\n2️⃣ *Cartão de Crédito (em até 12x no Mercado Pago):*\n👉 ${linkPagamento}\n`
      : ""
    const linkAssinaturaBloco = linkAssinatura
      ? `\n✍️ *Assinatura Digital da OS:*\n👉 ${linkAssinatura}\n`
      : ""
    const pixCopiaColaBloco = pixCopiaCola
      ? `\n📋 *Pix Copia e Cola:*\n\`\`\`${pixCopiaCola}\`\`\`\n`
      : ""

    const avisoAssinatura = linkAssinatura
      ? "Assim que realizar o pagamento ou assinar, favor enviar o comprovante por aqui para darmos andamento imediato na produção! 🤝✨"
      : "Assim que realizar o pagamento, favor enviar o comprovante por aqui para darmos andamento imediato na produção! 🤝✨"

    const mensagem =
      `Olá, ${primeiroNome}! Seguem as opções de pagamento da sua *Ordem de Serviço nº ${numeroOS || ""}* da Toldos Print. 📄✨\n\n` +
      `💰 *Valor Total:* ${totalFormatado}\n\n` +
      `*Qual forma de pagamento você prefere?*\n\n` +
      `1️⃣ *Pix (à vista):*\n` +
      `👉 Chave Pix (CNPJ): *${chavePix}*\n` +
      `👉 Chave para copiar: *${chaveNumeros}*\n` +
      `👤 Favorecido: Luis Carlos Loterio (Toldos Print & Comunicação Visual)\n` +
      pixCopiaColaBloco +
      linkCartaoBloco +
      linkAssinaturaBloco +
      avisoAssinatura

    // 4. Envio automático pelo bot
    const envio = await enviarMensagemWhatsapp(telefone, mensagem)

    if (!envio.ok) {
      return NextResponse.json({
        ok: false,
        erro: typeof envio.data === "string" ? envio.data : "Robô do WhatsApp não conectado ou falha no envio",
        mensagem,
      }, { status: 502 })
    }

    // 5. Registra mensagem no histórico
    await registrarMensagemBot({
      clienteId,
      clienteNome: nomeClienteFinal,
      telefone,
      texto: `💳 Opções de pagamento (Pix e Cartão) enviadas automaticamente: ${numeroOS || ""}`,
      origem: "automatica",
      autor: "bot",
    })

    return NextResponse.json({
      ok: true,
      linkPagamento,
      linkAssinatura,
      pixCopiaCola,
    })
  } catch (err: any) {
    console.error("[enviar-cobranca] Erro:", err)
    return NextResponse.json({ erro: err?.message || String(err) }, { status: 500 })
  }
}
