import { describe, expect, it } from "vitest"
import { gerarPdfOrcamentoServidor } from "@/lib/pdf-orcamento-servidor"
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
