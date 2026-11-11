import { describe, expect, it } from "vitest"
import { gerarPdfOrcamentoServidor } from "@/lib/pdf-orcamento-servidor"
import { gerarPdfOsServidor } from "@/lib/pdf-os-servidor"
import type { Orcamento } from "@/lib/types"

function orcamentoFechadoDeTeste(): Orcamento {
  return {
    id: "orc-teste",
    numero: 1234,
    clienteId: "cli-teste",
    item: {
      materialId: "mat-1",
      servicoId: "srv-1",
      largura: 2,
      altura: 1,
      quantidadeUnidades: 1,
      horasEstimadas: 0,
      condicoesPagamento: "50% de entrada + 50% na entrega",
    },
    materialFechado: { id: "mat-1", nome: "BANNER", unidade: "m2", quantidade: 2, custo: 170 },
    totalFechado: 360.4,
    ajusteManual: 0,
    anexoNome: null,
    status: "fechado",
    criadoEm: new Date().toISOString(),
    fechadoEm: new Date().toISOString(),
  }
}

describe("gerarPdfOrcamentoServidor", () => {
  it("gera um PDF válido (assinatura %PDF) com conteúdo não trivial", async () => {
    const buffer = await gerarPdfOrcamentoServidor(orcamentoFechadoDeTeste(), "Cliente de Teste")
    expect(buffer.subarray(0, 4).toString("ascii")).toBe("%PDF")
    expect(buffer.length).toBeGreaterThan(1000)
  })

  it("funciona mesmo sem itens adicionais nem imagens de logo/assinatura encontradas", async () => {
    const orcamento = orcamentoFechadoDeTeste()
    orcamento.item.itensAdicionais = []
    const buffer = await gerarPdfOrcamentoServidor(orcamento, "Cliente de Teste")
    expect(buffer.subarray(0, 4).toString("ascii")).toBe("%PDF")
  })
})

describe("gerarPdfOsServidor", () => {
  it("gera um PDF de OS válido com total e itens unificados", async () => {
    const orcamento = orcamentoFechadoDeTeste()
    orcamento.item.itensAdicionais = [
      {
        id: "ad-1",
        materialId: "mat-1",
        servicoId: "nenhum",
        largura: 0.5,
        altura: 0.3,
        quantidadeUnidades: 2,
        horasEstimadas: 0,
      },
    ]
    const buffer = await gerarPdfOsServidor(orcamento, "Cliente Teste OS", "27999999999")
    expect(buffer.subarray(0, 4).toString("ascii")).toBe("%PDF")
    expect(buffer.length).toBeGreaterThan(1000)
  })
})
