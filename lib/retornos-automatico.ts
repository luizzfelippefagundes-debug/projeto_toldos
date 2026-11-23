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
    // TRAVA DE SEGURANÇA DO DONO (Kaio):
    // Quando o cliente sinaliza aprovação no WhatsApp, o robô NÃO emite a OS e NÃO joga direto na produção sozinho.
    // Ele registra a sinalização para o Kaio aprovar e notifica o cliente que o Kaio vai validar o pedido.
    const novoRetorno = {
      ...retAntigo,
      clienteSinalizouAprovacao: true,
      anotacao: `🔔 Cliente confirmou no WhatsApp: "${texto.slice(0, 80)}" — Aguardando Kaio conferir e aprovar`,
      atualizadoEm: agora,
    }

    await sql`
      UPDATE orcamentos SET
        retorno = ${JSON.stringify(novoRetorno)}
      WHERE id = ${orcamentoAlvo.id}
    `

    const msgConfirma = `Perfeito, ${primeiroNome}! 🎉 Recebemos sua mensagem confirmando o orçamento nº ${numeroOrc}!\n\nJá notifiquei o Kaio para validar o seu pedido e conferir os detalhes técnicos. Em instantes entramos em contato para formalizar e dar início! 🤝📋`
    await enviarMensagemWhatsapp(telefone, msgConfirma).catch(() => {})
    await registrarMensagemBot({
      clienteId,
      clienteNome,
      telefone,
      texto: msgConfirma,
      origem: "automatica",
      autor: "bot",
    }).catch(() => {})

    return { processado: true, acao: "sinalizou_aprovacao", orcamentoNumero: numeroOrc }
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
