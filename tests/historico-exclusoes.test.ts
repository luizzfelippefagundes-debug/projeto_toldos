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
        ? consulta.texto.includes("FROM historico_exclusoes")
          ? [{
              id: (linhaDoRegistro.id as string) ?? "exc-1",
              tabela: (linhaDoRegistro.tabela as string) ?? "orcamentos",
              registro_id: (linhaDoRegistro.registro_id as string) ?? "orc-1",
              resumo: (linhaDoRegistro.resumo as string) ?? "Orçamento #1002",
              dados: (linhaDoRegistro.dados as Record<string, unknown>) ?? linhaDoRegistro,
            }]
          : [{ dados: linhaDoRegistro }]
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

import { excluirComHistorico, resumirRegistro, restaurarExclusao } from "@/lib/historico-exclusoes"

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

describe("restaurarExclusao", () => {
  it("restaura orçamento de volta para a tabela orcamentos e apaga do histórico em uma transação", async () => {
    linhaDoRegistro = {
      id: "exc-123",
      tabela: "orcamentos",
      registro_id: "orc-1",
      resumo: "Orçamento #1002 — R$ 588,30 (fechado)",
      dados: {
        id: "orc-1",
        numero: 1002,
        cliente_id: "cli-1",
        item: { nome: "Lona" },
        status: "fechado",
        total_fechado: 588.3,
        criado_em: "2026-11-14T10:00:00.000Z",
      },
    }

    const resultado = await restaurarExclusao("exc-123")

    expect(resultado.sucesso).toBe(true)
    expect(resultado.tabela).toBe("orcamentos")
    expect(resultado.registroId).toBe("orc-1")
    expect(transacoes).toHaveLength(1)

    const [restaurar, apagarDoHistorico] = transacoes[0]
    expect(restaurar.texto).toContain("INSERT INTO orcamentos")
    expect(restaurar.texto).toContain("ON CONFLICT (id) DO UPDATE")
    expect(restaurar.valores).toContain("orc-1")
    expect(restaurar.valores).toContain(1002)
    expect(apagarDoHistorico.texto).toContain("DELETE FROM historico_exclusoes")
    expect(apagarDoHistorico.valores).toContain("exc-123")
  })

  it("restaura cliente de volta para a tabela clientes", async () => {
    linhaDoRegistro = {
      id: "exc-cli-1",
      tabela: "clientes",
      registro_id: "cli-9",
      resumo: "Cliente João Silva",
      dados: {
        id: "cli-9",
        nome: "João Silva",
        telefone: "11999998888",
        email: "joao@teste.com",
        cpf: "123.456.789-00",
        criado_em: "2026-11-14T10:00:00.000Z",
      },
    }

    const resultado = await restaurarExclusao("exc-cli-1")

    expect(resultado.sucesso).toBe(true)
    expect(resultado.tabela).toBe("clientes")
    expect(transacoes).toHaveLength(1)

    const [restaurar, apagarDoHistorico] = transacoes[0]
    expect(restaurar.texto).toContain("INSERT INTO clientes")
    expect(restaurar.valores).toContain("João Silva")
    expect(apagarDoHistorico.texto).toContain("DELETE FROM historico_exclusoes")
  })

  it("quando a exclusão não existe, devolve erro sem fazer transação", async () => {
    linhaDoRegistro = null
    const resultado = await restaurarExclusao("exc-inexistente")

    expect(resultado.sucesso).toBe(false)
    expect(resultado.erro).toBe("Registro de exclusão não encontrado.")
    expect(transacoes).toHaveLength(0)
  })
})
