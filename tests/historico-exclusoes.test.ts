import { beforeEach, describe, expect, it, vi } from "vitest"

// Banco falso: guarda cada consulta escrita (texto + valores) e devolve as
// linhas que o teste programou para as consultas de leitura.
const consultas: { texto: string; valores: unknown[] }[] = []
const transacoes: { texto: string; valores: unknown[] }[][] = []
let linhaDoRegistro: Record<string, unknown> | null = null

function criarSql() {
  const sql = ((strings: TemplateStringsArray, ...valores: unknown[]) => {
    const consulta = { texto: strings.join("?").replace(/\s+/g, " ").trim(), valores }
    consultas.push(consulta)
    const resultado = consulta.texto.startsWith("SELECT")
      ? linhaDoRegistro
        ? [{ dados: linhaDoRegistro }]
        : []
      : []
    return Object.assign(Promise.resolve(resultado), consulta)
  }) as unknown as {
    (strings: TemplateStringsArray, ...valores: unknown[]): Promise<unknown[]>
    transaction: (qs: { texto: string; valores: unknown[] }[]) => Promise<unknown[]>
  }
  sql.transaction = async (qs) => {
    transacoes.push(qs)
    return []
  }
  return sql
}

vi.mock("@/lib/db", () => ({ getSql: () => criarSql() }))
vi.mock("@clerk/nextjs/server", () => ({
  currentUser: async () => ({
    id: "user_kaio",
    firstName: "Kaio",
    lastName: "Lotério",
    primaryEmailAddress: { emailAddress: "kaio@exemplo.com" },
  }),
}))

import { excluirComHistorico, resumirRegistro } from "@/lib/historico-exclusoes"

beforeEach(() => {
  consultas.length = 0
  transacoes.length = 0
  linhaDoRegistro = null
})

describe("resumirRegistro", () => {
  it("orçamento: número, valor e situação", () => {
    expect(
      resumirRegistro("orcamentos", { numero: 1002, total_fechado: "588.3", status: "fechado" })
    ).toBe("Orçamento #1002 — R$ 588,30 (fechado)")
  })

  it("orçamento sem total fechado não inventa valor", () => {
    expect(resumirRegistro("orcamentos", { numero: 1003, total_fechado: null, status: "aberto" })).toBe(
      "Orçamento #1003 (aberto)"
    )
  })

  it("cliente: o nome", () => {
    expect(resumirRegistro("clientes", { nome: "Maria Souza" })).toBe("Cliente Maria Souza")
  })

  it("lançamento: descrição e valor", () => {
    expect(
      resumirRegistro("lancamentos_financeiros", { descricao: "Aluguel", valor: "1500" })
    ).toBe("Lançamento Aluguel — R$ 1.500,00")
  })
})

describe("excluirComHistorico", () => {
  it("guarda uma cópia completa, quem apagou e o resumo, e só então apaga (tudo numa transação)", async () => {
    linhaDoRegistro = { id: "orc-1", numero: 1002, total_fechado: "588.3", status: "fechado" }
    const apagou = await excluirComHistorico("orcamentos", "orc-1")

    expect(apagou).toBe(true)
    expect(transacoes).toHaveLength(1)
    const [guardar, apagar] = transacoes[0]
    expect(guardar.texto).toContain("INSERT INTO historico_exclusoes")
    expect(guardar.valores).toContain("orcamentos")
    expect(guardar.valores).toContain("orc-1")
    expect(guardar.valores).toContain("user_kaio")
    expect(guardar.valores).toContain("Kaio Lotério")
    expect(guardar.valores).toContain("Orçamento #1002 — R$ 588,30 (fechado)")
    expect(guardar.valores.some((v) => typeof v === "string" && v.includes('"numero":1002'))).toBe(true)
    expect(apagar.texto).toContain("DELETE FROM orcamentos")
    expect(apagar.valores).toContain("orc-1")
  })

  it("registro que não existe: não grava nada e devolve false", async () => {
    linhaDoRegistro = null
    expect(await excluirComHistorico("clientes", "cli-x")).toBe(false)
    expect(transacoes).toHaveLength(0)
  })

  it("cada tabela apaga da tabela certa", async () => {
    linhaDoRegistro = { id: "x", nome: "Fulano" }
    await excluirComHistorico("clientes", "cli-1")
    expect(transacoes[0][1].texto).toContain("DELETE FROM clientes")
    linhaDoRegistro = { id: "y", descricao: "Conta", valor: "10" }
    await excluirComHistorico("lancamentos_financeiros", "lan-1")
    expect(transacoes[1][1].texto).toContain("DELETE FROM lancamentos_financeiros")
  })
})
