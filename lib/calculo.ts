import type { Material, OrcamentoItem, Servico } from "./types"

export interface ResultadoCalculo {
  areaM2: number
  subtotalMaterial: number
  subtotalMaoDeObra: number
  total: number
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
