import { getSql } from "./db"

// Tema (claro/escuro) escolhido no sistema, guardado no banco pra que o
// Painel TV — que roda em outro aparelho — siga a mesma escolha.
export type TemaTv = "light" | "dark"

let tabelaPronta = false

// A tabela também está em scripts/migrate.sql; criar aqui evita depender de
// rodar a migração à mão antes do primeiro uso.
async function garantirTabela() {
  if (tabelaPronta) return
  await getSql()`
    CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    )
  `
  tabelaPronta = true
}

export function ehTemaTv(valor: unknown): valor is TemaTv {
  return valor === "light" || valor === "dark"
}

export async function lerTemaTv(): Promise<TemaTv> {
  await garantirTabela()
  const rows = await getSql()`SELECT valor FROM configuracoes WHERE chave = 'tema_tv'`
  const valor = rows[0]?.valor
  return ehTemaTv(valor) ? valor : "dark"
}

export async function salvarTemaTv(tema: TemaTv) {
  await garantirTabela()
  await getSql()`
    INSERT INTO configuracoes (chave, valor) VALUES ('tema_tv', ${tema})
    ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor
  `
}
