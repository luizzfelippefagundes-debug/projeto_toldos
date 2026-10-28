import {
  calcularOrcamentoCompleto,
  quantidadeMaterialConsumida,
  type ResultadoCalculoCompleto,
} from "./calculo"
import { acabamentosSeed, equipamentosAcessoSeed } from "./seed-data"
import type {
  ItemProduto,
  Material,
  Orcamento,
  OrcamentoItem,
  Servico,
} from "./types"

// O item principal e depois os adicionais, sempre nessa ordem.
export function itensDoOrcamento(item: OrcamentoItem): ItemProduto[] {
  return [item, ...(item.itensAdicionais ?? [])]
}

export interface BaixaItem {
  materialId: string
  solicitada: number
  debitada: number
}

/**
 * Quanto do estoque cada item consegue baixar. Itens que usam o mesmo material
 * dividem o saldo, na ordem da lista. `devolucoes` é o que a versão anterior do
 * orçamento já tinha baixado (conta como saldo disponível ao editar).
 */
export function planejarBaixas(
  itens: ItemProduto[],
  materiais: Material[],
  devolucoes: Map<string, number> = new Map()
): BaixaItem[] {
  const disponivel = new Map<string, number>()
  return itens.map((item) => {
    const material = materiais.find((m) => m.id === item.materialId)
    if (!material) return { materialId: item.materialId, solicitada: 0, debitada: 0 }
    const solicitada = quantidadeMaterialConsumida(item, material)
    const atual =
      disponivel.get(material.id) ??
      material.quantidadeEstoque + (devolucoes.get(material.id) ?? 0)
    const debitada = Math.min(atual, solicitada)
    disponivel.set(material.id, atual - debitada)
    return { materialId: material.id, solicitada, debitada }
  })
}

// O que um orçamento fechado tem baixado do estoque, por material.
export function devolucoesDoOrcamento(
  orcamento: Orcamento,
  materiais: Material[]
): Map<string, number> {
  const mapa = new Map<string, number>()
  const registrar = (item: ItemProduto, debitado?: number) => {
    const material = materiais.find((m) => m.id === item.materialId)
    if (!material) return
    const quantidade = debitado ?? quantidadeMaterialConsumida(item, material)
    mapa.set(material.id, (mapa.get(material.id) ?? 0) + quantidade)
  }
  registrar(orcamento.item, orcamento.quantidadeMaterialDebitada)
  for (const extra of orcamento.item.itensAdicionais ?? []) {
    registrar(extra, extra.quantidadeMaterialDebitada)
  }
  return mapa
}

// Variação final do estoque por material: devolve `devolucoes` e baixa `baixas`.
export function deltasDeEstoque(
  baixas: BaixaItem[],
  devolucoes: Map<string, number>
): Map<string, number> {
  const deltas = new Map<string, number>()
  for (const [id, quantidade] of devolucoes) {
    deltas.set(id, (deltas.get(id) ?? 0) + quantidade)
  }
  for (const baixa of baixas) {
    deltas.set(baixa.materialId, (deltas.get(baixa.materialId) ?? 0) - baixa.debitada)
  }
  return deltas
}

// Grava em cada adicional o que foi debitado e o material no momento do
// fechamento. `baixas[0]` é o principal (já guardado no próprio orçamento).
export function itemComBaixas(
  item: OrcamentoItem,
  baixas: BaixaItem[],
  materiais: Material[]
): OrcamentoItem {
  const extras = item.itensAdicionais
  if (!extras?.length) return item
  return {
    ...item,
    itensAdicionais: extras.map((extra, i) => {
      const material = materiais.find((m) => m.id === extra.materialId)
      const baixa = baixas[i + 1]
      if (!material || !baixa) return extra
      return {
        ...extra,
        quantidadeMaterialDebitada: baixa.debitada,
        materialFechado: {
          id: material.id,
          nome: material.nome,
          unidade: material.unidade,
          quantidade: baixa.solicitada,
          custo: baixa.solicitada * material.precoUnitario,
        },
      }
    }),
  }
}

// Cálculo de um orçamento já salvo (telas de histórico, OS, cliente).
export function calcularOrcamentoSalvo(
  orcamento: Orcamento,
  materiais: Material[],
  servicos: Servico[]
): ResultadoCalculoCompleto | null {
  const material = materiais.find((m) => m.id === orcamento.item.materialId)
  if (!material) return null
  const servico = servicos.find((s) => s.id === orcamento.item.servicoId)
  return calcularOrcamentoCompleto(
    orcamento.item,
    material,
    servico ?? null,
    orcamento.ajusteManual,
    acabamentosSeed,
    equipamentosAcessoSeed,
    { materiais, servicos }
  )
}
