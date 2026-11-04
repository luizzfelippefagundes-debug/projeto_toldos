import { getSql } from "./db"

export interface MensagemHistorico {
  role: "user" | "assistant"
  content: string
}

export interface ConversaBot {
  id: string
  telefone: string
  clienteId: string | null
  nomeTemp: string | null
  localTemp: string | null
  historico: MensagemHistorico[]
  transferidoEm: string | null
  processandoDesde: string | null
  criadoEm: string
  atualizadoEm: string
}

function linhaParaConversa(l: Record<string, unknown>): ConversaBot {
  return {
    id: l.id as string,
    telefone: l.telefone as string,
    clienteId: (l.cliente_id as string) ?? null,
    nomeTemp: (l.nome_temp as string) ?? null,
    localTemp: (l.local_temp as string) ?? null,
    historico: JSON.parse((l.historico as string) ?? "[]"),
    transferidoEm: (l.transferido_em as string) ?? null,
    processandoDesde: (l.processando_desde as string) ?? null,
    criadoEm: l.criado_em as string,
    atualizadoEm: l.atualizado_em as string,
  }
}

export async function getOuCriarConversa(telefone: string): Promise<ConversaBot> {
  const sql = getSql()
  const existente = await sql`SELECT * FROM conversas_bot WHERE telefone = ${telefone}`
  if (existente.length > 0) return linhaParaConversa(existente[0])

  const agora = new Date().toISOString()
  const id = `conv-${Math.random().toString(36).slice(2, 10)}`
  await sql`
    INSERT INTO conversas_bot (id, telefone, historico, criado_em, atualizado_em)
    VALUES (${id}, ${telefone}, '[]', ${agora}, ${agora})
    ON CONFLICT (telefone) DO NOTHING
  `
  const linha = await sql`SELECT * FROM conversas_bot WHERE telefone = ${telefone}`
  return linhaParaConversa(linha[0])
}

export async function atualizarConversa(
  id: string,
  patch: {
    clienteId?: string | null
    nomeTemp?: string | null
    localTemp?: string | null
    historico?: MensagemHistorico[]
  }
): Promise<void> {
  const sql = getSql()
  const agora = new Date().toISOString()
  const atual = await sql`SELECT * FROM conversas_bot WHERE id = ${id}`
  if (atual.length === 0) return
  const c = linhaParaConversa(atual[0])
  await sql`
    UPDATE conversas_bot SET
      cliente_id = ${patch.clienteId !== undefined ? patch.clienteId : c.clienteId},
      nome_temp = ${patch.nomeTemp !== undefined ? patch.nomeTemp : c.nomeTemp},
      local_temp = ${patch.localTemp !== undefined ? patch.localTemp : c.localTemp},
      historico = ${JSON.stringify(patch.historico ?? c.historico)},
      atualizado_em = ${agora}
    WHERE id = ${id}
  `
}

// Marca que o atendimento passou pra um humano — a partir daqui o bot para
// de responder automaticamente nessa conversa (ver lib/bot-whatsapp.ts).
export async function transferirAtendimento(id: string): Promise<void> {
  await getSql()`UPDATE conversas_bot SET transferido_em = ${new Date().toISOString()} WHERE id = ${id}`
}

// Reabre o bot pra essa conversa (ex.: o dono resolveu e quer que o robô
// volte a atender esse número) — usado pela tela "Central do Bot".
export async function reabrirBot(id: string): Promise<void> {
  await getSql()`UPDATE conversas_bot SET transferido_em = NULL WHERE id = ${id}`
}

// Trava atômica (uma linha do Postgres, não só em memória) pra duas
// mensagens do mesmo número não serem processadas ao mesmo tempo — o
// Evolution API pode reentregar o webhook, ou o cliente manda duas
// mensagens em sequência rápida.
export async function tentarTravarProcessamento(id: string): Promise<boolean> {
  const sql = getSql()
  const resultado = await sql`
    UPDATE conversas_bot SET processando_desde = ${new Date().toISOString()}
    WHERE id = ${id} AND processando_desde IS NULL
    RETURNING id
  `
  return resultado.length > 0
}

// Acima desse tempo, assume que a chamada anterior travou sem liberar
// (crashou) e força a trava mesmo assim — nunca por concorrência normal,
// que termina em segundos.
export async function roubarTravaProcessamento(id: string): Promise<void> {
  await getSql()`UPDATE conversas_bot SET processando_desde = ${new Date().toISOString()} WHERE id = ${id}`
}

export async function destravarProcessamento(id: string): Promise<void> {
  await getSql()`UPDATE conversas_bot SET processando_desde = NULL WHERE id = ${id}`
}
