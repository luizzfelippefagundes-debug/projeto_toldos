import { currentUser } from "@clerk/nextjs/server"
import { getSql } from "./db"

// Tabelas em que apagar um registro fica guardado: a cópia completa, quem
// apagou e quando. Serve pra descobrir (e, se preciso, refazer) o que foi
// apagado sem querer.
export type TabelaAuditada = "orcamentos" | "clientes" | "lancamentos_financeiros"

export interface ExclusaoRegistrada {
  id: string
  tabela: TabelaAuditada
  registroId: string
  resumo: string
  dados: Record<string, unknown>
  excluidoPorId: string | null
  excluidoPorNome: string | null
  excluidoEm: string
}

let tabelaPronta = false

// Cria a tabela na primeira vez (uma vez por instância). Também está em
// scripts/migrate.sql, mas rodar aqui evita depender de aplicar à mão antes do
// deploy (mesmo padrão de lib/migracoes.ts).
export async function garantirTabelaExclusoes() {
  if (tabelaPronta) return
  await getSql()`
    CREATE TABLE IF NOT EXISTS historico_exclusoes (
      id TEXT PRIMARY KEY,
      tabela TEXT NOT NULL,
      registro_id TEXT NOT NULL,
      resumo TEXT NOT NULL,
      dados JSONB NOT NULL,
      excluido_por_id TEXT,
      excluido_por_nome TEXT,
      excluido_em TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `
  tabelaPronta = true
}

function moeda(valor: unknown): string {
  // O formato pt-BR usa espaço sem quebra depois do "R$"; troca pelo comum.
  return Number(valor)
    .toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    .replace(/\u00a0/g, " ")
}

// Texto curto que identifica o registro apagado na tela de consulta.
export function resumirRegistro(
  tabela: TabelaAuditada,
  dados: Record<string, unknown>
): string {
  if (tabela === "orcamentos") {
    const valor =
      dados.total_fechado !== null && dados.total_fechado !== undefined
        ? ` — ${moeda(dados.total_fechado)}`
        : ""
    return `Orçamento #${dados.numero}${valor} (${dados.status})`
  }
  if (tabela === "clientes") return `Cliente ${dados.nome}`
  return `Lançamento ${dados.descricao} — ${moeda(dados.valor)}`
}

async function quemExcluiu(): Promise<{ id: string | null; nome: string | null }> {
  try {
    const usuario = await currentUser()
    if (!usuario) return { id: null, nome: null }
    const nome = [usuario.firstName, usuario.lastName].filter(Boolean).join(" ")
    return {
      id: usuario.id,
      nome: nome || usuario.primaryEmailAddress?.emailAddress || null,
    }
  } catch {
    return { id: null, nome: null }
  }
}

async function lerRegistro(
  tabela: TabelaAuditada,
  id: string
): Promise<Record<string, unknown> | null> {
  const sql = getSql()
  const linhas =
    tabela === "orcamentos"
      ? await sql`SELECT to_jsonb(t) AS dados FROM orcamentos t WHERE t.id = ${id}`
      : tabela === "clientes"
        ? await sql`SELECT to_jsonb(t) AS dados FROM clientes t WHERE t.id = ${id}`
        : await sql`SELECT to_jsonb(t) AS dados FROM lancamentos_financeiros t WHERE t.id = ${id}`
  return (linhas[0]?.dados as Record<string, unknown> | undefined) ?? null
}

/**
 * Apaga o registro guardando antes uma cópia dele no histórico. As duas coisas
 * acontecem na mesma transação: ou guarda e apaga, ou não faz nada. Devolve
 * false se o registro não existia.
 */
export async function excluirComHistorico(
  tabela: TabelaAuditada,
  id: string
): Promise<boolean> {
  await garantirTabelaExclusoes()
  const dados = await lerRegistro(tabela, id)
  if (!dados) return false

  const quem = await quemExcluiu()
  const sql = getSql()
  const guardar = sql`
    INSERT INTO historico_exclusoes
      (id, tabela, registro_id, resumo, dados, excluido_por_id, excluido_por_nome)
    VALUES (
      ${`exc-${Math.random().toString(36).slice(2, 10)}`}, ${tabela}, ${id},
      ${resumirRegistro(tabela, dados)}, ${JSON.stringify(dados)}::jsonb,
      ${quem.id}, ${quem.nome}
    )
  `
  const apagar =
    tabela === "orcamentos"
      ? sql`DELETE FROM orcamentos WHERE id = ${id}`
      : tabela === "clientes"
        ? sql`DELETE FROM clientes WHERE id = ${id}`
        : sql`DELETE FROM lancamentos_financeiros WHERE id = ${id}`
  await sql.transaction([guardar, apagar])
  return true
}

export async function listarExclusoes(limite = 200): Promise<ExclusaoRegistrada[]> {
  await garantirTabelaExclusoes()
  const linhas = await getSql()`
    SELECT id, tabela, registro_id, resumo, dados, excluido_por_id, excluido_por_nome, excluido_em
    FROM historico_exclusoes ORDER BY excluido_em DESC LIMIT ${limite}
  `
  return linhas.map((r) => ({
    id: r.id as string,
    tabela: r.tabela as TabelaAuditada,
    registroId: r.registro_id as string,
    resumo: r.resumo as string,
    dados: r.dados as Record<string, unknown>,
    excluidoPorId: (r.excluido_por_id as string | null) ?? null,
    excluidoPorNome: (r.excluido_por_nome as string | null) ?? null,
    excluidoEm: new Date(r.excluido_em as string).toISOString(),
  }))
}
