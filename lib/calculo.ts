import type {
  Acabamento,
  EquipamentoAcesso,
  Material,
  ItemProduto,
  OrcamentoItem,
  Servico,
} from "./types"

export interface ResultadoCalculo {
  areaM2: number
  subtotalMaterial: number
  subtotalMaoDeObra: number
  total: number
}

// Parte de um item no resultado: o índice 0 é o item principal e os demais
// seguem a ordem de `itensAdicionais` (sempre alinhados, mesmo com material removido).
export interface ResultadoItem {
  materialId: string
  areaM2: number
  subtotalMaterial: number
  subtotalMaoDeObra: number
  subtotalAcabamentos: number
}

export interface CatalogoOrcamento {
  materiais: Material[]
  servicos: Servico[]
}

export interface ResultadoCalculoCompleto extends ResultadoCalculo {
  subtotalAcabamentos: number
  itens: ResultadoItem[]
  subtotalInstalacao: number
  subtotalDeslocamento: number
  custoBase: number
  comMargem: number
  comDesconto: number
  valorImposto: number
}

// Quantas peças iguais o item tem. Em material por m² multiplica a área;
// orçamentos antigos que não guardaram quantidade valem 1 peça.
export function quantidadePecas(item: ItemProduto): number {
  return item.quantidadeUnidades > 0 ? item.quantidadeUnidades : 1
}

export function quantidadeMaterialConsumida(
  item: ItemProduto,
  material: Material
): number {
  const areaM2 = item.largura * item.altura * quantidadePecas(item)
  return material.unidade === "m2" ? areaM2 : item.quantidadeUnidades
}

export function calcularOrcamento(
  item: ItemProduto,
  material: Material,
  servico: Servico | null,
  ajusteManual: number
): ResultadoCalculo {
  const areaM2 =
    item.largura *
    item.altura *
    (material.unidade === "m2" ? quantidadePecas(item) : 1)
  const subtotalMaterial =
    quantidadeMaterialConsumida(item, material) * material.precoUnitario

  let subtotalMaoDeObra = 0
  if (servico) {
    switch (servico.formaCobranca) {
      case "fixo":
        subtotalMaoDeObra = servico.valor
        break
      case "hora":
        subtotalMaoDeObra = servico.valor * item.horasEstimadas
        break
      case "m2":
        subtotalMaoDeObra = servico.valor * areaM2
        break
      case "percentual":
        subtotalMaoDeObra = subtotalMaterial * (servico.valor / 100)
        break
    }
  }

  const total = subtotalMaterial + subtotalMaoDeObra + ajusteManual

  return { areaM2, subtotalMaterial, subtotalMaoDeObra, total }
}

function subtotalAcabamentosDe(
  item: ItemProduto,
  acabamentosDisponiveis: Acabamento[]
): number {
  return (item.acabamentos ?? []).reduce((soma, sel) => {
    const acabamento = acabamentosDisponiveis.find(
      (a) => a.id === sel.acabamentoId
    )
    return acabamento ? soma + acabamento.precoUnitario * sel.quantidade : soma
  }, 0)
}

/**
 * Versão estendida usada pelo wizard de Novo Orçamento: soma acabamentos,
 * instalação (mão de obra + equipamento de acesso) e deslocamento ao custo
 * base, aplica margem e desconto percentuais, e só então o ajuste manual em
 * R$ (igual a `calcularOrcamento`). Itens antigos sem esses campos opcionais
 * contribuem 0 em cada parte nova, então o resultado bate com
 * `calcularOrcamento` para orçamentos que nunca usaram o wizard novo.
 *
 * Itens adicionais (`item.itensAdicionais`) entram no custo base com o seu
 * material, mão de obra e acabamentos; precisam do `catalogo` pra achar o
 * material e o serviço de cada um. Instalação, deslocamento, margem, desconto
 * e imposto valem uma vez, sobre o total.
 */
export function calcularOrcamentoCompleto(
  item: OrcamentoItem,
  material: Material,
  servico: Servico | null,
  ajusteManual: number,
  acabamentosDisponiveis: Acabamento[],
  equipamentosDisponiveis: EquipamentoAcesso[],
  catalogo?: CatalogoOrcamento
): ResultadoCalculoCompleto {
  const base = calcularOrcamento(item, material, servico, 0)

  const itens: ResultadoItem[] = [
    {
      materialId: item.materialId,
      areaM2: base.areaM2,
      subtotalMaterial: base.subtotalMaterial,
      subtotalMaoDeObra: base.subtotalMaoDeObra,
      subtotalAcabamentos: subtotalAcabamentosDe(item, acabamentosDisponiveis),
    },
  ]
  for (const extra of item.itensAdicionais ?? []) {
    const materialExtra = catalogo?.materiais.find((m) => m.id === extra.materialId)
    if (!materialExtra) {
      itens.push({
        materialId: extra.materialId,
        areaM2: 0,
        subtotalMaterial: 0,
        subtotalMaoDeObra: 0,
        subtotalAcabamentos: 0,
      })
      continue
    }
    const servicoExtra =
      catalogo?.servicos.find((s) => s.id === extra.servicoId) ?? null
    const baseExtra = calcularOrcamento(extra, materialExtra, servicoExtra, 0)
    itens.push({
      materialId: extra.materialId,
      areaM2: baseExtra.areaM2,
      subtotalMaterial: baseExtra.subtotalMaterial,
      subtotalMaoDeObra: baseExtra.subtotalMaoDeObra,
      subtotalAcabamentos: subtotalAcabamentosDe(extra, acabamentosDisponiveis),
    })
  }
  const somar = (campo: keyof Omit<ResultadoItem, "materialId">) =>
    itens.reduce((soma, parte) => soma + parte[campo], 0)
  const areaM2 = somar("areaM2")
  const subtotalMaterial = somar("subtotalMaterial")
  const subtotalMaoDeObra = somar("subtotalMaoDeObra")
  const subtotalAcabamentos = somar("subtotalAcabamentos")

  const instalacao = item.instalacao
  let subtotalInstalacao = 0
  if (instalacao?.incluida) {
    const equipamento = equipamentosDisponiveis.find(
      (e) => e.id === instalacao.equipamentoId
    )
    subtotalInstalacao =
      instalacao.horas * instalacao.custoHora +
      instalacao.numAjudantes * instalacao.diariaAjudante +
      (equipamento?.precoDiaria ?? 0)
  }

  const deslocamento = item.deslocamento
  let subtotalDeslocamento = 0
  if (deslocamento?.incluido) {
    subtotalDeslocamento =
      deslocamento.distanciaKm * deslocamento.custoPorKm +
      deslocamento.pedagio +
      deslocamento.alimentacao
  }

  const custoBase =
    subtotalMaterial +
    subtotalMaoDeObra +
    subtotalAcabamentos +
    subtotalInstalacao +
    subtotalDeslocamento

  const margemPercent = item.margemPercent ?? 0
  const descontoPercent = item.descontoPercent ?? 0
  const impostoPercent = item.impostoPercent ?? 0

  const comMargem = custoBase * (1 + margemPercent / 100)
  const comDesconto = comMargem * (1 - descontoPercent / 100)
  const valorImposto = comDesconto * (impostoPercent / 100)
  const total = comDesconto + valorImposto + ajusteManual

  return {
    areaM2,
    subtotalMaterial,
    subtotalMaoDeObra,
    subtotalAcabamentos,
    itens,
    subtotalInstalacao,
    subtotalDeslocamento,
    custoBase,
    comMargem,
    comDesconto,
    valorImposto,
    total,
  }
}
