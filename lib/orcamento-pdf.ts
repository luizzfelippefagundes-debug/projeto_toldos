import type { ResultadoCalculoCompleto } from "./calculo"
import { quantidadePecas } from "./calculo"
import type { Acabamento, ItemProduto, OrcamentoItem, UnidadeMedida } from "./types"
import { interpretarDataLocal } from "./date"

// Dados fixos do cabeçalho/rodapé do orçamento oficial da empresa.
export const EMPRESA_ORCAMENTO = {
  nome: "TOLDOSPRINT",
  cnpj: "CNPJ: 09.141.206/0001-06  /  63.177.134/0001-00",
  endereco: ["Avenida João Quiuqui", "29795-000 - Águia Branca/ES"],
  email: "kaioloterio2908@gmail.com",
  contato: "27997489714",
} as const

// O anexo da etapa 6 ("Foto ou vídeo do local") também entra nas fotos do
// PDF quando é imagem; vídeo não tem como imprimir.
export function ehImagem(nomeOuTipo: string | null | undefined): boolean {
  if (!nomeOuTipo) return false
  return nomeOuTipo.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic|avif)$/i.test(nomeOuTipo)
}

export interface LinhaOrcamento {
  nome: string
  quantidade: number
  unidade: string
  valorUnitario: number
  valorTotal: number
}

const arredondar = (n: number) => Math.round(n * 100) / 100
const medida = (n: number) => n.toFixed(2).replace(".", ",")

// "0129-25": sequência com 4 dígitos + ano do orçamento com 2.
export function formatarNumeroOrcamento(numero: number, criadoEm: string): string {
  const ano = interpretarDataLocal(criadoEm).getFullYear()
  return `${String(numero).padStart(4, "0")}-${String(ano % 100).padStart(2, "0")}`
}

export interface ItemAdicionalPdf {
  item: ItemProduto
  nomeMaterial: string
  unidadeMaterial: UnidadeMedida
}

type LinhaBruta = Omit<LinhaOrcamento, "valorUnitario">

function linhaDoProduto(
  item: ItemProduto,
  nomeMaterial: string,
  unidadeMaterial: UnidadeMedida,
  valorTotal: number
): LinhaBruta {
  const pecas = quantidadePecas(item)
  const nome =
    unidadeMaterial === "m2" && item.largura > 0 && item.altura > 0
      ? `${nomeMaterial} ${medida(item.largura)} x ${medida(item.altura)} m`
      : nomeMaterial
  return {
    nome,
    quantidade: unidadeMaterial === "m2" ? pecas : item.quantidadeUnidades || 1,
    unidade: "un",
    valorTotal,
  }
}

function linhasDosAcabamentos(
  item: ItemProduto,
  acabamentosDisponiveis: Acabamento[]
): LinhaBruta[] {
  const linhas: LinhaBruta[] = []
  for (const sel of item.acabamentos ?? []) {
    const acabamento = acabamentosDisponiveis.find((a) => a.id === sel.acabamentoId)
    if (!acabamento || sel.quantidade <= 0) continue
    linhas.push({
      nome: acabamento.nome,
      quantidade: sel.quantidade,
      unidade: acabamento.unidade,
      valorTotal: acabamento.precoUnitario * sel.quantidade,
    })
  }
  return linhas
}

/**
 * Monta as linhas da tabela "Serviços" a partir do cálculo do orçamento: uma
 * linha pro produto (material + mão de obra), uma por acabamento e uma pra
 * instalação e deslocamento. Margem, desconto, imposto e ajuste manual são
 * diluídos proporcionalmente nas linhas pra a soma bater com o total final.
 */
export function gerarLinhasOrcamento({
  item,
  nomeMaterial,
  unidadeMaterial,
  acabamentosDisponiveis,
  resultado,
  total,
  adicionais,
}: {
  item: OrcamentoItem
  nomeMaterial: string
  unidadeMaterial: UnidadeMedida
  acabamentosDisponiveis: Acabamento[]
  resultado: ResultadoCalculoCompleto
  total: number
  adicionais?: ItemAdicionalPdf[]
}): LinhaOrcamento[] {
  // O resultado traz a parte de cada item: [0] é o principal, o resto os adicionais.
  const [partePrincipal, ...partesAdicionais] = resultado.itens
  const valorPrincipal = partePrincipal
    ? partePrincipal.subtotalMaterial + partePrincipal.subtotalMaoDeObra
    : resultado.subtotalMaterial + resultado.subtotalMaoDeObra
  const brutas: LinhaBruta[] = [
    linhaDoProduto(item, nomeMaterial, unidadeMaterial, valorPrincipal),
    ...linhasDosAcabamentos(item, acabamentosDisponiveis),
  ]
  ;(adicionais ?? []).forEach((adicional, i) => {
    const parte = partesAdicionais[i]
    brutas.push(
      linhaDoProduto(
        adicional.item,
        adicional.nomeMaterial,
        adicional.unidadeMaterial,
        parte ? parte.subtotalMaterial + parte.subtotalMaoDeObra : 0
      )
    )
    // Adicional sem material no cadastro entra zerado no cálculo (acabamentos
    // inclusive); gerar as linhas de acabamento dele inflaria a diluição.
    if (parte && parte.subtotalAcabamentos > 0) {
      brutas.push(...linhasDosAcabamentos(adicional.item, acabamentosDisponiveis))
    }
  })
  if (resultado.subtotalInstalacao > 0) {
    brutas.push({
      nome: "Instalação",
      quantidade: 1,
      unidade: "un",
      valorTotal: resultado.subtotalInstalacao,
    })
  }
  if (resultado.subtotalDeslocamento > 0) {
    brutas.push({
      nome: "Deslocamento",
      quantidade: 1,
      unidade: "un",
      valorTotal: resultado.subtotalDeslocamento,
    })
  }

  const somaBruta = brutas.reduce((s, l) => s + l.valorTotal, 0)
  const fator = somaBruta > 0 ? total / somaBruta : 0
  const linhas = brutas.map((l) => ({
    ...l,
    valorTotal: arredondar(somaBruta > 0 ? l.valorTotal * fator : 0),
  }))

  // Sem custo calculado (ou arredondamento): o total vai na linha do produto.
  if (somaBruta <= 0) {
    linhas[0].valorTotal = arredondar(total)
  } else {
    const diferenca = arredondar(total - linhas.reduce((s, l) => s + l.valorTotal, 0))
    if (diferenca !== 0) {
      const maior = linhas.reduce((m, l) => (l.valorTotal > m.valorTotal ? l : m))
      maior.valorTotal = arredondar(maior.valorTotal + diferenca)
    }
  }

  return linhas.map((l) => ({
    ...l,
    valorUnitario: arredondar(l.valorTotal / l.quantidade),
  }))
}
