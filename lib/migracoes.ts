import { getSql } from "./db"

let orcamentosProntos = false
let lancamentosProntos = false
let conversasBotProntas = false
let assinaturasOsProntas = false

// Colunas novas em tabelas que já existem em produção. Também estão em
// scripts/migrate.sql; rodar aqui (uma vez por instância) evita depender de
// alguém aplicar a migração à mão antes do deploy.
export async function garantirColunasOrcamentos() {
  if (orcamentosProntos) return
  await getSql()`ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS retorno JSONB`
  // Preenchido ao emitir a OS (quadro de Produção) — repetido aqui porque
  // é usado também pelo bot do WhatsApp pra informar o status ao cliente.
  await getSql()`ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS status_producao TEXT`
  await getSql()`ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS os_emitida_em TEXT`
  orcamentosProntos = true
}

export async function garantirColunasLancamentos() {
  if (lancamentosProntos) return
  await getSql()`ALTER TABLE lancamentos_financeiros ADD COLUMN IF NOT EXISTS parcela TEXT`
  await getSql()`ALTER TABLE lancamentos_financeiros ADD COLUMN IF NOT EXISTS pessoal BOOLEAN NOT NULL DEFAULT FALSE`
  lancamentosProntos = true
}

// Estado da conversa do bot do WhatsApp, por telefone (negócio único, sem
// coluna de instância/tenant). Ver lib/bot-conversa.ts.
export async function garantirTabelaAssinaturasOs() {
  if (assinaturasOsProntas) return
  await getSql()`
    CREATE TABLE IF NOT EXISTS assinaturas_os (
      id TEXT PRIMARY KEY,
      orcamento_id TEXT NOT NULL,
      assinado_em TEXT,
      assinatura_data TEXT,
      ip_assinante TEXT,
      pdf_url TEXT,
      criado_em TEXT NOT NULL,
      expira_em TEXT NOT NULL
    )
  `
  await getSql()`ALTER TABLE assinaturas_os ADD COLUMN IF NOT EXISTS pdf_url TEXT`
  assinaturasOsProntas = true
}

export async function garantirTabelaConversasBot() {
  if (conversasBotProntas) return
  await getSql()`
    CREATE TABLE IF NOT EXISTS conversas_bot (
      id TEXT PRIMARY KEY,
      telefone TEXT NOT NULL UNIQUE,
      cliente_id TEXT,
      nome_temp TEXT,
      local_temp TEXT,
      historico TEXT NOT NULL DEFAULT '[]',
      transferido_em TEXT,
      processando_desde TEXT,
      criado_em TEXT NOT NULL,
      atualizado_em TEXT NOT NULL
    )
  `
  conversasBotProntas = true
}
