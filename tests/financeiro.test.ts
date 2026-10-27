import { describe, expect, it } from "vitest"
import {
  estaLancamentoVencido,
  resumirFinanceiro,
} from "@/lib/financeiro"
import type { LancamentoFinanceiro } from "@/lib/types"

const hoje = new Date(2026, 8, 29, 12)

function lancamento(
  dados: Partial<LancamentoFinanceiro> & Pick<LancamentoFinanceiro, "id">
): LancamentoFinanceiro {
  return {
    descricao: "Conta de teste",
    tipo: "receita",
    categoria: "Teste",
    valor: 100,
    vencimento: new Date(2026, 8, 28, 12).toISOString(),
    status: "pendente",
    origem: "manual",
    origemId: null,
    criadoEm: new Date(2026, 8, 20, 12).toISOString(),
    ...dados,
  }
}

describe("resumo financeiro", () => {
  it("separa baixas, contas abertas, vencidas e próximas do vencimento", () => {
    const dados = [
      lancamento({
        id: "recebida",
        status: "pago",
        pagoEm: new Date(2026, 8, 29, 10).toISOString(),
      }),
      lancamento({
        id: "paga",
        tipo: "despesa",
        valor: 40,
        status: "pago",
        pagoEm: new Date(2026, 8, 28, 10).toISOString(),
      }),
      lancamento({
        id: "antiga-sem-baixa",
        valor: 25,
        status: "pago",
        criadoEm: new Date(2026, 8, 29, 9).toISOString(),
      }),
      lancamento({ id: "vencida" }),
      lancamento({
        id: "vence-hoje",
        tipo: "despesa",
        valor: 50,
        vencimento: new Date(2026, 8, 29, 12).toISOString(),
      }),
      lancamento({
        id: "vence-em-sete",
        valor: 20,
        vencimento: new Date(2026, 9, 6, 12).toISOString(),
        formaPagamento: "boleto",
      }),
    ]

    expect(resumirFinanceiro(dados, hoje)).toMatchObject({
      recebido: 125,
      pago: 40,
      aReceber: 120,
      aPagar: 50,
      vencidoAReceber: 100,
      vencidoAPagar: 0,
      recebiveisVencendo7Dias: 1,
      boletosVencendo7Dias: 1,
      quantidadeVencida: 1,
    })
  })

  it("filtra baixas pela data de pagamento e contas abertas pelo vencimento", () => {
    const dados = [
      lancamento({
        id: "recebida-no-dia",
        status: "pago",
        criadoEm: new Date(2026, 8, 20, 12).toISOString(),
        pagoEm: new Date(2026, 8, 29, 10).toISOString(),
      }),
      lancamento({
        id: "recebida-antes",
        status: "pago",
        pagoEm: new Date(2026, 8, 28, 10).toISOString(),
      }),
      lancamento({
        id: "vence-no-dia",
        tipo: "despesa",
        vencimento: new Date(2026, 8, 29, 12).toISOString(),
        valor: 35,
      }),
      lancamento({
        id: "vence-depois",
        tipo: "despesa",
        vencimento: new Date(2026, 8, 30, 12).toISOString(),
        valor: 80,
      }),
    ]

    expect(resumirFinanceiro(dados, hoje, "2026-09-29", "2026-09-29")).toMatchObject({
      recebido: 100,
      pago: 0,
      aReceber: 0,
      aPagar: 35,
    })
  })

  it("não marca a conta com vencimento hoje ou uma conta paga como vencida", () => {
    expect(
      estaLancamentoVencido(
        lancamento({
          id: "hoje",
          vencimento: new Date(2026, 8, 29, 1).toISOString(),
        }),
        hoje
      )
    ).toBe(false)
    expect(
      estaLancamentoVencido(
        lancamento({ id: "paga", status: "pago" }),
        hoje
      )
    ).toBe(false)
  })

  it("não marca vencimento legado à meia-noite UTC como um dia atrasado", () => {
    expect(
      estaLancamentoVencido(
        lancamento({
          id: "vencimento-utc",
          vencimento: "2026-10-05T00:00:00.000Z",
        }),
        new Date(2026, 9, 5, 12)
      )
    ).toBe(false)
  })
})

describe("despesas pessoais e a pagar do mês", () => {
  const base = { tipo: "despesa" as const, status: "pendente" as const }
  const dados = [
    lancamento({ ...base, id: "este-mes", valor: 100, vencimento: new Date(2026, 8, 30, 12).toISOString() }),
    lancamento({ ...base, id: "atrasada", valor: 50, vencimento: new Date(2026, 8, 10, 12).toISOString() }),
    lancamento({ ...base, id: "mes-que-vem", valor: 400, vencimento: new Date(2026, 9, 5, 12).toISOString() }),
    lancamento({ ...base, id: "pessoal", valor: 1000, pessoal: true, vencimento: new Date(2026, 8, 30, 12).toISOString() }),
  ]

  it("separa o a pagar do mês do total comprometido e deixa as pessoais de fora", () => {
    const r = resumirFinanceiro(dados, hoje)
    expect(r.aPagar).toBe(550)
    expect(r.aPagarMes).toBe(150)
    expect(r.pessoalForaDosTotais).toBe(1000)
  })

  it("inclui as pessoais quando pedido", () => {
    const r = resumirFinanceiro(dados, hoje, "", "", true)
    expect(r.aPagar).toBe(1550)
    expect(r.aPagarMes).toBe(1150)
    expect(r.pessoalForaDosTotais).toBe(0)
  })
})
