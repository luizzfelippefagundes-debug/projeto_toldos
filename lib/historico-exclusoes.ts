import { currentUser } from "@clerk/nextjs/server"
import { getSql } from "./db"
import {
  garantirColunasOrcamentos,
  garantirColunasLancamentos,
  garantirCpfClientes,
} from "./migracoes"

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

/**
 * Restaura um registro apagado que está no histórico de exclusões.
 * Insere de volta na tabela original e apaga do histórico de exclusões numa transação atômica.
 */
export async function restaurarExclusao(id: string): Promise<{
  sucesso: boolean
  erro?: string
  tabela?: TabelaAuditada
  registroId?: string
  resumo?: string
}> {
  await garantirTabelaExclusoes()
  const sql = getSql()
  const linhas = await sql`
    SELECT id, tabela, registro_id, resumo, dados
    FROM historico_exclusoes
    WHERE id = ${id}
  `
  if (!linhas || linhas.length === 0) {
    return { sucesso: false, erro: "Registro de exclusão não encontrado." }
  }

  const { tabela, registro_id: registroId, resumo, dados } = linhas[0] as {
    tabela: TabelaAuditada
    registro_id: string
    resumo: string
    dados: Record<string, unknown>
  }

  if (tabela === "orcamentos") {
    await garantirColunasOrcamentos()
    const itemJson = typeof dados.item === "string" ? dados.item : JSON.stringify(dados.item ?? {})
    const matFechado = dados.material_fechado
      ? typeof dados.material_fechado === "string"
        ? dados.material_fechado
        : JSON.stringify(dados.material_fechado)
      : null
    const servFechado = dados.servico_fechado
      ? typeof dados.servico_fechado === "string"
        ? dados.servico_fechado
        : JSON.stringify(dados.servico_fechado)
      : null
    const retornoJson = dados.retorno
      ? typeof dados.retorno === "string"
        ? dados.retorno
        : JSON.stringify(dados.retorno)
      : null

    const restaurar = sql`
      INSERT INTO orcamentos (
        id, numero, cliente_id, item, quantidade_material_debitada,
        material_fechado, servico_fechado, total_fechado, ajuste_manual,
        anexo_nome, anexo_url, status, criado_em, fechado_em, validade_dias,
        retorno, status_producao, os_emitida_em, arte_url, arte_aprovada_em
      ) VALUES (
        ${dados.id as string},
        ${Number(dados.numero)},
        ${dados.cliente_id as string},
        ${itemJson}::jsonb,
        ${dados.quantidade_material_debitada != null ? Number(dados.quantidade_material_debitada) : null},
        ${matFechado}::jsonb,
        ${servFechado}::jsonb,
        ${dados.total_fechado != null ? Number(dados.total_fechado) : null},
        ${Number(dados.ajuste_manual ?? 0)},
        ${(dados.anexo_nome as string) ?? null},
        ${(dados.anexo_url as string) ?? null},
        ${(dados.status as string) ?? "aberto"},
        ${dados.criado_em as string},
        ${(dados.fechado_em as string) ?? null},
        ${dados.validade_dias != null ? Number(dados.validade_dias) : null},
        ${retornoJson}::jsonb,
        ${(dados.status_producao as string) ?? null},
        ${(dados.os_emitida_em as string) ?? null},
        ${(dados.arte_url as string) ?? null},
        ${(dados.arte_aprovada_em as string) ?? null}
      )
      ON CONFLICT (id) DO UPDATE SET
        numero = EXCLUDED.numero,
        cliente_id = EXCLUDED.cliente_id,
        item = EXCLUDED.item,
        quantidade_material_debitada = EXCLUDED.quantidade_material_debitada,
        material_fechado = EXCLUDED.material_fechado,
        servico_fechado = EXCLUDED.servico_fechado,
        total_fechado = EXCLUDED.total_fechado,
        ajuste_manual = EXCLUDED.ajuste_manual,
        anexo_nome = EXCLUDED.anexo_nome,
        anexo_url = EXCLUDED.anexo_url,
        status = EXCLUDED.status,
        criado_em = EXCLUDED.criado_em,
        fechado_em = EXCLUDED.fechado_em,
        validade_dias = EXCLUDED.validade_dias,
        retorno = EXCLUDED.retorno,
        status_producao = EXCLUDED.status_producao,
        os_emitida_em = EXCLUDED.os_emitida_em,
        arte_url = EXCLUDED.arte_url,
        arte_aprovada_em = EXCLUDED.arte_aprovada_em
    `
    const apagarDoHistorico = sql`DELETE FROM historico_exclusoes WHERE id = ${id}`
    await sql.transaction([restaurar, apagarDoHistorico])
  } else if (tabela === "clientes") {
    await garantirCpfClientes()
    const restaurar = sql`
      INSERT INTO clientes (id, nome, telefone, email, cpf)
      VALUES (
        ${dados.id as string},
        ${dados.nome as string},
        ${dados.telefone as string},
        ${(dados.email as string) ?? null},
        ${(dados.cpf as string) ?? null}
      )
      ON CONFLICT (id) DO UPDATE SET
        nome = EXCLUDED.nome,
        telefone = EXCLUDED.telefone,
        email = EXCLUDED.email,
        cpf = EXCLUDED.cpf
    `
    const apagarDoHistorico = sql`DELETE FROM historico_exclusoes WHERE id = ${id}`
    await sql.transaction([restaurar, apagarDoHistorico])
  } else if (tabela === "lancamentos_financeiros") {
    await garantirColunasLancamentos()
    const restaurar = sql`
      INSERT INTO lancamentos_financeiros (
        id, descricao, tipo, categoria, valor, vencimento, status, pago_em,
        origem, origem_id, criado_em, cliente_id, forma_pagamento, numero_boleto, parcela, pessoal, despesa_fixa,
        observacoes, pix_copia_cola
      ) VALUES (
        ${dados.id as string},
        ${dados.descricao as string},
        ${dados.tipo as string},
        ${dados.categoria as string},
        ${Number(dados.valor)},
        ${dados.vencimento as string},
        ${(dados.status as string) ?? "pendente"},
        ${(dados.pago_em as string) ?? null},
        ${dados.origem as string},
        ${(dados.origem_id as string) ?? null},
        ${dados.criado_em as string},
        ${(dados.cliente_id as string) ?? null},
        ${(dados.forma_pagamento as string) ?? null},
        ${(dados.numero_boleto as string) ?? null},
        ${(dados.parcela as string) ?? null},
        ${dados.pessoal === true},
        ${dados.despesaFixa === true || dados.despesa_fixa === true},
        ${(dados.observacoes as string) ?? null},
        ${(dados.pix_copia_cola as string) ?? (dados.pixCopiaECola as string) ?? null}
      )
      ON CONFLICT (id) DO UPDATE SET
        descricao = EXCLUDED.descricao,
        tipo = EXCLUDED.tipo,
        categoria = EXCLUDED.categoria,
        valor = EXCLUDED.valor,
        vencimento = EXCLUDED.vencimento,
        status = EXCLUDED.status,
        pago_em = EXCLUDED.pago_em,
        origem = EXCLUDED.origem,
        origem_id = EXCLUDED.origem_id,
        criado_em = EXCLUDED.criado_em,
        cliente_id = EXCLUDED.cliente_id,
        forma_pagamento = EXCLUDED.forma_pagamento,
        numero_boleto = EXCLUDED.numero_boleto,
        parcela = EXCLUDED.parcela,
        pessoal = EXCLUDED.pessoal,
        despesa_fixa = EXCLUDED.despesa_fixa,
        observacoes = EXCLUDED.observacoes,
        pix_copia_cola = EXCLUDED.pix_copia_cola
    `
    const apagarDoHistorico = sql`DELETE FROM historico_exclusoes WHERE id = ${id}`
    await sql.transaction([restaurar, apagarDoHistorico])
  }

  return { sucesso: true, tabela, registroId, resumo }
}
