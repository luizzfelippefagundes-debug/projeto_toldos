import type {
  Acabamento,
  EquipamentoAcesso,
  Material,
  OrcamentoItem,
  Servico,
} from "./types"

export interface ResultadoCalculo {
  areaM2: number
  subtotalMaterial: number
  subtotalMaoDeObra: number
  total: number
}

export interface ResultadoCalculoCompleto extends ResultadoCalculo {
  subtotalAcabamentos: number
  subtotalInstalacao: number
  subtotalDeslocamento: number
  custoBase: number
  comMargem: number
  comDesconto: number
  valorImposto: number
}

export function quantidadeMaterialConsumida(
  item: OrcamentoItem,
  material: Material
): number {
  const areaM2 = item.largura * item.altura
  return material.unidade === "m2" ? areaM2 : item.quantidadeUnidades
}

export function calcularOrcamento(
  item: OrcamentoItem,
  material: Material,
  servico: Servico,
  ajusteManual: number
): ResultadoCalculo {
  const areaM2 = item.largura * item.altura
  const subtotalMaterial =
    quantidadeMaterialConsumida(item, material) * material.precoUnitario

  let subtotalMaoDeObra = 0
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

  const total = subtotalMaterial + subtotalMaoDeObra + ajusteManual

  return { areaM2, subtotalMaterial, subtotalMaoDeObra, total }
}

/**
 * Versão estendida usada pelo wizard de Novo Orçamento: soma acabamentos,
 * instalação (mão de obra + equipamento de acesso) e deslocamento ao custo
 * base, aplica margem e desconto percentuais, e só então o ajuste manual em
 * R$ (igual a `calcularOrcamento`). Itens antigos sem esses campos opcionais
 * contribuem 0 em cada parte nova, então o resultado bate com
 * `calcularOrcamento` para orçamentos que nunca usaram o wizard novo.
 */
export function calcularOrcamentoCompleto(
  item: OrcamentoItem,
  material: Material,
  servico: Servico,
  ajusteManual: number,
  acabamentosDisponiveis: Acabamento[],
  equipamentosDisponiveis: EquipamentoAcesso[]
): ResultadoCalculoCompleto {
  const base = calcularOrcamento(item, material, servico, 0)

  const subtotalAcabamentos = (item.acabamentos ?? []).reduce((soma, sel) => {
    const acabamento = acabamentosDisponiveis.find(
      (a) => a.id === sel.acabamentoId
    )
    return acabamento ? soma + acabamento.precoUnitario * sel.quantidade : soma
  }, 0)

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
    base.subtotalMaterial +
    base.subtotalMaoDeObra +
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
    areaM2: base.areaM2,
    subtotalMaterial: base.subtotalMaterial,
    subtotalMaoDeObra: base.subtotalMaoDeObra,
    subtotalAcabamentos,
    subtotalInstalacao,
    subtotalDeslocamento,
    custoBase,
    comMargem,
    comDesconto,
    valorImposto,
    total,
  }
}
