import { getSql } from "./db"
import { identificarIntencaoMensagem } from "./retornos"
import { enviarMensagemWhatsapp } from "./evolution-api"
import { registrarMensagemBot } from "./bot-registro"

export async function processarRetornoWhatsapp({
  clienteId,
  clienteNome,
  telefone,
  texto,
}: {
  clienteId: string
  clienteNome: string
  telefone: string
  texto: string
}): Promise<{ processado: boolean; acao?: string; orcamentoNumero?: number }> {
  const intencao = identificarIntencaoMensagem(texto)
  if (!intencao) return { processado: false }

  const sql = getSql()
  const primeiroNome = clienteNome.split(" ")[0] || "Cliente"
  const agora = new Date().toISOString()

  // 1. Primeiro verifica se tem orçamento aguardando confirmação de arte na produção
  const artesPendentes = await sql`
    SELECT id, numero, status_producao, arte_url
    FROM orcamentos
    WHERE cliente_id = ${clienteId}
      AND status = 'fechado'
      AND status_producao = 'ag_confirmacao'
    ORDER BY numero DESC
    LIMIT 1
  `

  if (artesPendentes.length > 0 && intencao === "aprovado") {
    const o = artesPendentes[0]
    await sql`
      UPDATE orcamentos SET
        status_producao = 'impressao',
        arte_aprovada_em = ${agora}
      WHERE id = ${o.id}
    `
    const msgConfirma = `Perfeito, ${primeiroNome}! 🎉 Sua arte foi aprovada e já encaminhamos o pedido para a impressão! 🖨️✨`
    await enviarMensagemWhatsapp(telefone, msgConfirma).catch(() => {})
    await registrarMensagemBot({
      clienteId,
      clienteNome,
      telefone,
      texto: msgConfirma,
      origem: "automatica",
      autor: "bot",
    }).catch(() => {})

    return { processado: true, acao: "arte_aprovada", orcamentoNumero: o.numero as number }
  }

  // 2. Busca orçamentos fechados recentes desse cliente em Retornos
  const orcamentosRetorno = await sql`
    SELECT id, numero, status, status_producao, retorno, os_emitida_em
    FROM orcamentos
    WHERE cliente_id = ${clienteId}
      AND status = 'fechado'
    ORDER BY numero DESC
    LIMIT 5
  `

  // Encontra o orçamento que está em aguardando ou negociação (ou sem retorno definido ainda)
  const orcamentoAlvo = orcamentosRetorno.find((o) => {
    const ret = o.retorno as { etapa?: string } | null
    const etapa = ret?.etapa ?? "aguardando"
    return etapa === "aguardando" || etapa === "negociacao"
  })

  if (!orcamentoAlvo) {
    return { processado: false }
  }

  const retAntigo = (orcamentoAlvo.retorno as Record<string, unknown>) ?? {}
  const numeroOrc = orcamentoAlvo.numero as number

  if (intencao === "aprovado") {
    const novoRetorno = {
      ...retAntigo,
      etapa: "aprovado",
      anotacao: `Aprovado pelo cliente via WhatsApp: "${texto.slice(0, 80)}"`,
      atualizadoEm: agora,
    }
    const osEmitidaEm = (orcamentoAlvo.os_emitida_em as string | null) ?? agora
    // Cai direto em Ag. Assinatura na Produção
    const statusProducao = (orcamentoAlvo.status_producao as string | null) || "aguardando"

    await sql`
      UPDATE orcamentos SET
        retorno = ${JSON.stringify(novoRetorno)},
        os_emitida_em = ${osEmitidaEm},
        status_producao = ${statusProducao}
      WHERE id = ${orcamentoAlvo.id}
    `

    const msgConfirma = `Perfeito, ${primeiroNome}! 🎉 Seu orçamento nº ${numeroOrc} foi aprovado com sucesso!\n\nJá geramos sua Ordem de Serviço e encaminhamos para a produção. Em instantes enviamos o link para sua conferência e assinatura! 📋✍️`
    await enviarMensagemWhatsapp(telefone, msgConfirma).catch(() => {})
    await registrarMensagemBot({
      clienteId,
      clienteNome,
      telefone,
      texto: msgConfirma,
      origem: "automatica",
      autor: "bot",
    }).catch(() => {})

    return { processado: true, acao: "orcamento_aprovado", orcamentoNumero: numeroOrc }
  }

  if (intencao === "negociacao") {
    const novoRetorno = {
      ...retAntigo,
      etapa: "negociacao",
      anotacao: `Mensagem do cliente via WhatsApp: "${texto.slice(0, 100)}"`,
      atualizadoEm: agora,
    }

    await sql`
      UPDATE orcamentos SET
        retorno = ${JSON.stringify(novoRetorno)}
      WHERE id = ${orcamentoAlvo.id}
    `

    return { processado: true, acao: "orcamento_negociacao", orcamentoNumero: numeroOrc }
  }

  if (intencao === "perdido") {
    const novoRetorno = {
      ...retAntigo,
      etapa: "perdido",
      anotacao: `Recusado pelo cliente via WhatsApp: "${texto.slice(0, 100)}"`,
      atualizadoEm: agora,
    }

    await sql`
      UPDATE orcamentos SET
        retorno = ${JSON.stringify(novoRetorno)}
      WHERE id = ${orcamentoAlvo.id}
    `

    return { processado: true, acao: "orcamento_perdido", orcamentoNumero: numeroOrc }
  }

  return { processado: false }
}
