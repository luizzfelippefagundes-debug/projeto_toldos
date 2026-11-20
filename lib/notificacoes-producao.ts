import { getSql } from "@/lib/db"
import { enviarMensagemWhatsapp } from "@/lib/evolution-api"
import { registrarMensagemBot } from "@/lib/bot-registro"
import { formatarData } from "@/lib/format"

export const TELEFONES_PRODUCAO_PADRAO = [
  "5527998051301",
  "5527999210057",
  "5527996125835",
]

export async function obterTelefonesProducao(): Promise<string[]> {
  try {
    const sql = getSql()
    const rows = await sql`SELECT valor FROM configuracoes WHERE chave = 'telefones_producao'`
    if (rows.length > 0 && rows[0].valor) {
      const parsed = JSON.parse(rows[0].valor)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch (err) {
    console.warn("[notificacoes-producao] usando telefones padrao:", err)
  }
  return TELEFONES_PRODUCAO_PADRAO
}

export async function salvarTelefonesProducao(telefones: string[]): Promise<void> {
  const sql = getSql()
  await sql`
    INSERT INTO configuracoes (chave, valor)
    VALUES ('telefones_producao', ${JSON.stringify(telefones)})
    ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor
  `
}

export async function enviarNotificacaoEquipeProducao(mensagem: string): Promise<void> {
  const telefones = await obterTelefonesProducao()
  for (const tel of telefones) {
    try {
      await enviarMensagemWhatsapp(tel, mensagem)
      await registrarMensagemBot({
        clienteId: null,
        clienteNome: "Equipe de Produção",
        telefone: tel,
        texto: mensagem,
        origem: "automatica",
        autor: "bot",
      })
    } catch (err) {
      console.error(`[notificacoes-producao] erro ao enviar para ${tel}:`, err)
    }
  }
}

export async function notificarNovaDemandaPedidoRapido(pedido: {
  numero: number
  clienteNome: string
  produtoNome?: string
  varianteNome?: string
  acabamento?: string | null
  observacao?: string | null
  prazoEntregaEm?: string | null
}): Promise<void> {
  const prazo = pedido.prazoEntregaEm ? formatarData(pedido.prazoEntregaEm) : null
  const mensagem =
    `🔔 *Nova Demanda na Produção!*\n\n` +
    `📋 *Pedido:* #${pedido.numero}\n` +
    `👤 *Cliente:* ${pedido.clienteNome}\n` +
    `🛠️ *Produto:* ${pedido.produtoNome || "Pedido de Produção"}${pedido.varianteNome ? ` (${pedido.varianteNome})` : ""}\n` +
    (pedido.acabamento ? `✨ *Acabamento:* ${pedido.acabamento}\n` : "") +
    (pedido.observacao ? `⚠️ *Instrução:* ${pedido.observacao}\n` : "") +
    (prazo ? `📅 *Prazo:* ${prazo}\n` : "") +
    `\n👉 Acesse o painel da produção para conferir!`

  await enviarNotificacaoEquipeProducao(mensagem)
}

export async function notificarNovaDemandaOrcamento(orcamento: {
  numero: number
  clienteNome: string
  material?: string | null
  servico?: string | null
  dimensoes?: string | null
  observacao?: string | null
}): Promise<void> {
  const mensagem =
    `🔔 *Nova Demanda na Produção!*\n\n` +
    `📋 *Ordem de Serviço (OS):* #${orcamento.numero}\n` +
    `👤 *Cliente:* ${orcamento.clienteNome}\n` +
    `🛠️ *Material/Item:* ${orcamento.material || "Comunicação Visual"}\n` +
    (orcamento.servico ? `✨ *Serviço:* ${orcamento.servico}\n` : "") +
    (orcamento.dimensoes ? `📏 *Medidas:* ${orcamento.dimensoes}\n` : "") +
    (orcamento.observacao ? `⚠️ *Instrução:* ${orcamento.observacao}\n` : "") +
    `\n👉 Acesse o painel da produção para conferir!`

  await enviarNotificacaoEquipeProducao(mensagem)
}

export async function notificarAvisoTvEquipe(mensagem: string, icone?: string): Promise<void> {
  const iconeDisplay = icone || "📢"
  const texto =
    `${iconeDisplay} *Aviso da Gerência no Telão da Fábrica:*\n\n` +
    `"${mensagem}"\n\n` +
    `— Toldos Print 🤝`

  await enviarNotificacaoEquipeProducao(texto)
}
