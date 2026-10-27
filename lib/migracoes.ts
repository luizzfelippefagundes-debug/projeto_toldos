import { getSql } from "./db"

let orcamentosProntos = false
let lancamentosProntos = false

// Colunas novas em tabelas que já existem em produção. Também estão em
// scripts/migrate.sql; rodar aqui (uma vez por instância) evita depender de
// alguém aplicar a migração à mão antes do deploy.
export async function garantirColunasOrcamentos() {
  if (orcamentosProntos) return
  await getSql()`ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS retorno JSONB`
  orcamentosProntos = true
}

export async function garantirColunasLancamentos() {
  if (lancamentosProntos) return
  await getSql()`ALTER TABLE lancamentos_financeiros ADD COLUMN IF NOT EXISTS parcela TEXT`
  await getSql()`ALTER TABLE lancamentos_financeiros ADD COLUMN IF NOT EXISTS pessoal BOOLEAN NOT NULL DEFAULT FALSE`
  lancamentosProntos = true
}
