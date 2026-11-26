import { getSql } from "@/lib/db"
import { enviarMensagemWhatsapp, enviarImagemWhatsapp } from "@/lib/evolution-api"
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

export interface NotificacaoConclusaoKaioPayload {
  origemTipo: "orcamento" | "pedido"
  origemId: string
  numero: number
  clienteNome: string
  produtoNome?: string
  fotoAntesUrl?: string | null
  fotoDepoisUrl?: string | null
  colaboradores?: Array<{ nome: string; pecas?: number; valor?: number }> | string
  observacao?: string | null
}

export async function obterTelefoneKaio(): Promise<string> {
  try {
    const sql = getSql()
    const rows = await sql`SELECT valor FROM configuracoes WHERE chave = 'telefone_kaio'`
    if (rows.length > 0 && rows[0].valor) {
      const v = typeof rows[0].valor === "string" ? rows[0].valor.replace(/\D/g, "") : ""
      if (v) return v.startsWith("55") ? v : `55${v}`
    }
  } catch (err) {
    console.warn("[notificacoes-producao] erro ao buscar telefone_kaio no banco:", err)
  }
  const envKaio = process.env.WHATSAPP_KAIO_NUMERO || process.env.WHATSAPP_EMPRESA_NUMERO || "5527997488023"
  const limpo = envKaio.replace(/\D/g, "")
  return limpo.startsWith("55") ? limpo : `55${limpo}`
}

export async function salvarTelefoneKaio(telefone: string): Promise<void> {
  const sql = getSql()
  const limpo = telefone.replace(/\D/g, "")
  const comDdi = limpo.startsWith("55") ? limpo : `55${limpo}`
  await sql`
    INSERT INTO configuracoes (chave, valor)
    VALUES ('telefone_kaio', ${comDdi})
    ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor
  `
}

export async function notificarConclusaoPecaAoKaio(dados: NotificacaoConclusaoKaioPayload): Promise<{
  ok: boolean
  telefone: string
  antesEnviado: boolean
  depoisEnviado: boolean
  erro?: string
}> {
  const telefoneKaio = await obterTelefoneKaio()

  let fotoAntes = dados.fotoAntesUrl || null
  let fotoDepois = dados.fotoDepoisUrl || null

  // Busca foto antes no banco de dados se não foi informada
  if (!fotoAntes) {
    try {
      const sql = getSql()
      if (dados.origemTipo === "orcamento") {
        const rows = await sql`
          SELECT arte_url, anexo_url
          FROM orcamentos
          WHERE id = ${dados.origemId} OR id = ${"orc-" + dados.origemId} OR numero = ${dados.numero}
          LIMIT 1
        `
        if (rows.length > 0) {
          fotoAntes = rows[0].arte_url || rows[0].anexo_url || null
        }
      } else {
        const rows = await sql`
          SELECT arte_url
          FROM pedidos_rapidos
          WHERE id = ${dados.origemId} OR id = ${"ped-" + dados.origemId} OR numero = ${dados.numero}
          LIMIT 1
        `
        if (rows.length > 0) {
          fotoAntes = rows[0].arte_url || null
        }
      }
    } catch (err) {
      console.warn("[notificacoes-producao] erro ao buscar arte aprovada no banco:", err)
    }
  }

  // Busca foto depois no banco se necessário
  if (!fotoDepois) {
    try {
      const sql = getSql()
      if (dados.origemTipo === "orcamento") {
        const rows = await sql`
          SELECT foto_pronto_url FROM orcamentos
          WHERE id = ${dados.origemId} OR id = ${"orc-" + dados.origemId} OR numero = ${dados.numero}
          LIMIT 1
        `
        if (rows.length > 0) {
          fotoDepois = rows[0].foto_pronto_url || null
        }
      } else {
        const rows = await sql`
          SELECT foto_pronto_url FROM pedidos_rapidos
          WHERE id = ${dados.origemId} OR id = ${"ped-" + dados.origemId} OR numero = ${dados.numero}
          LIMIT 1
        `
        if (rows.length > 0) {
          fotoDepois = rows[0].foto_pronto_url || null
        }
      }
    } catch (err) {
      console.warn("[notificacoes-producao] erro ao buscar foto pronta no banco:", err)
    }
  }

  // Formata colaboradores
  let colabsTexto = "Equipe de Produção"
  if (Array.isArray(dados.colaboradores) && dados.colaboradores.length > 0) {
    colabsTexto = dados.colaboradores
      .map((c) => {
        const pecas = c.pecas || 1
        return `${c.nome} (${pecas} ${pecas === 1 ? "peça" : "peças"})`
      })
      .join(", ")
  } else if (typeof dados.colaboradores === "string" && dados.colaboradores.trim()) {
    colabsTexto = dados.colaboradores.trim()
  }

  const agoraFormatada = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date())

  const tipoDesc = dados.origemTipo === "orcamento" ? "Ordem de Serviço (OS)" : "Pedido"
  const produtoDesc = dados.produtoNome || (dados.origemTipo === "pedido" ? "Gráfica Rápida" : "Comunicação Visual")

  let antesEnviado = false
  let depoisEnviado = false

  // 1. Se tem foto do ANTES (Arte aprovada), envia primeiro para o Kaio
  if (fotoAntes) {
    const legendaAntes =
      `📸 *[ANTES — ARTE APROVADA / LAYOUT]*\n\n` +
      `📋 *${tipoDesc}:* #${dados.numero}\n` +
      `👤 *Cliente:* ${dados.clienteNome}\n` +
      `🛠️ *Produto:* ${produtoDesc}\n\n` +
      `👀 Layout de referência aprovado pelo cliente.`

    try {
      const resAntes = await enviarImagemWhatsapp(telefoneKaio, fotoAntes, legendaAntes)
      antesEnviado = !!resAntes.ok
    } catch (err) {
      console.error(`[notificacoes-producao] erro ao enviar foto ANTES para Kaio (${telefoneKaio}):`, err)
    }

    // Pequeno intervalo entre envios para o WhatsApp processar na ordem correta
    await new Promise((r) => setTimeout(r, 800))
  }

  // 2. Envia foto do DEPOIS (Peça pronta tirada na produção)
  if (fotoDepois) {
    const legendaDepois =
      `✅ *[DEPOIS — PEÇA PRONTA CONCLUÍDA!]*\n\n` +
      `📋 *${tipoDesc}:* #${dados.numero}\n` +
      `👤 *Cliente:* ${dados.clienteNome}\n` +
      `🛠️ *Produto:* ${produtoDesc}\n` +
      `👷 *Produzido por:* ${colabsTexto}\n` +
      `⏰ *Concluído em:* ${agoraFormatada}\n` +
      (dados.observacao ? `⚠️ *Obs:* ${dados.observacao}\n` : "") +
      `\n🚀 O serviço foi finalizado na bancada e está pronto para conferência e entrega!`

    try {
      const resDepois = await enviarImagemWhatsapp(telefoneKaio, fotoDepois, legendaDepois)
      depoisEnviado = !!resDepois.ok
    } catch (err) {
      console.error(`[notificacoes-producao] erro ao enviar foto DEPOIS para Kaio (${telefoneKaio}):`, err)
    }
  } else {
    // Se não houver foto, envia aviso em texto
    const mensagemTexto =
      `✅ *Peça Concluída na Produção!*\n\n` +
      `📋 *${tipoDesc}:* #${dados.numero}\n` +
      `👤 *Cliente:* ${dados.clienteNome}\n` +
      `🛠️ *Produto:* ${produtoDesc}\n` +
      `👷 *Produzido por:* ${colabsTexto}\n` +
      `⏰ *Concluído em:* ${agoraFormatada}\n` +
      (dados.observacao ? `⚠️ *Obs:* ${dados.observacao}\n` : "") +
      `\n🚀 Peça marcada como pronta na fábrica e liberada para conferência/entrega!`

    try {
      const resTxt = await enviarMensagemWhatsapp(telefoneKaio, mensagemTexto)
      depoisEnviado = !!resTxt.ok
    } catch (err) {
      console.error(`[notificacoes-producao] erro ao enviar texto de conclusão para Kaio:`, err)
    }
  }

  // 3. Registra no histórico do bot
  try {
    await registrarMensagemBot({
      clienteId: null,
      clienteNome: "Kaio (Líder Produção)",
      telefone: telefoneKaio,
      texto: `[Conclusão Peça #${dados.numero}] ${dados.clienteNome} - ${produtoDesc} | Produzido por: ${colabsTexto} (Antes: ${antesEnviado ? "sim" : "não"}, Depois: ${depoisEnviado ? "sim" : "não"})`,
      origem: "automatica",
      autor: "bot",
    })
  } catch (err) {
    console.error("[notificacoes-producao] erro ao registrar no histórico do bot:", err)
  }

  return {
    ok: antesEnviado || depoisEnviado,
    telefone: telefoneKaio,
    antesEnviado,
    depoisEnviado,
  }
}
