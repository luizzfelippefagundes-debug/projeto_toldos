import { getSql } from "./db"
import type { MensagemBot } from "./types"

// Grava no histórico visível em "Central do Bot" (app/(app)/bot/page.tsx) —
// mesma tabela usada pelo simulador de perguntas, agora também alimentada
// pelas conversas reais do WhatsApp.
export async function registrarMensagemBot(dados: {
  clienteId?: string | null
  clienteNome: string
  telefone: string
  texto: string
  origem: MensagemBot["origem"]
  autor: MensagemBot["autor"]
}): Promise<void> {
  const id = `msg-${Math.random().toString(36).slice(2, 10)}`
  await getSql()`
    INSERT INTO mensagens_bot (id, cliente_id, cliente_nome, telefone, texto, origem, autor, criado_em)
    VALUES (${id}, ${dados.clienteId ?? null}, ${dados.clienteNome}, ${dados.telefone}, ${dados.texto}, ${dados.origem}, ${dados.autor}, ${new Date().toISOString()})
  `
}
