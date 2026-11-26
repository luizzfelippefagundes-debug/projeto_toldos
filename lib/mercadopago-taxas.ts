import { formatarMoeda } from "./format"

export interface SimularParcela {
  parcelas: number
  valorParcela: number
  valorTotal: number
  valorTotalCliente: number
  taxaPercentual: number
  valorTaxaDescontada: number
  valorLiquidoReceber: number
  temJuros: boolean
}

export type ModoSimulacaoTaxa =
  | "repassar" // Cliente assume os juros do parcelamento (acréscimo no valor final)
  | "absorver" // Valor fixo sem juros pro cliente (a gráfica assume as taxas do parcelamento)
  | "reverso"  // Quero receber o valor líquido limpo (calcula quanto cobrar para sobrar o valor)

/**
 * Tabela oficial de coeficientes de juros de parcelamento do Mercado Pago (Brasil),
 * cobrados no Checkout e Point (recebimento na hora).
 */
export const TAXAS_PADRAO_MERCADO_PAGO: Record<number, number> = {
  1: 0,
  2: 4.59,
  3: 5.97,
  4: 7.33,
  5: 8.66,
  6: 9.96,
  7: 11.24,
  8: 12.50,
  9: 13.73,
  10: 14.93,
  11: 16.12,
  12: 17.28,
}

// Tarifa base de processamento no crédito à vista (recebimento na hora)
export const TARIFA_PROCESSAMENTO_BASE = 4.98

/**
 * Simula todas as opções de 1x a 12x de acordo com o modo escolhido:
 * - repassar: o valor digitado é o valor base à vista; adiciona juros do MP pro cliente.
 * - absorver: o valor digitado já é o preço final total; o cliente paga em até Nx sem juros a mais.
 * - reverso: o valor digitado é quanto a gráfica quer que sobre LIMPO na conta bancária.
 */
export function simularParcelasMercadoPago(
  valor: number,
  modo: ModoSimulacaoTaxa = "repassar"
): SimularParcela[] {
  if (valor <= 0) return []

  return Object.entries(TAXAS_PADRAO_MERCADO_PAGO).map(([nStr, taxaJuros]) => {
    const parcelas = Number(nStr)

    if (modo === "repassar") {
      // Cliente paga o acréscimo do parcelamento
      const valorTotalCliente = Math.round(valor * (1 + taxaJuros / 100) * 100) / 100
      const valorParcela = Math.round((valorTotalCliente / parcelas) * 100) / 100
      const valorTaxa = Math.round((valorTotalCliente - valor) * 100) / 100
      const valorLiquido = valor // a empresa recebe o valor base

      return {
        parcelas,
        valorParcela,
        valorTotal: valorTotalCliente,
        valorTotalCliente,
        taxaPercentual: taxaJuros,
        valorTaxaDescontada: valorTaxa,
        valorLiquidoReceber: valorLiquido,
        temJuros: taxaJuros > 0,
      }
    }

    if (modo === "reverso") {
      // Quer receber `valor` limpo na conta: Valor Cobrado = Valor / (1 - taxa/100)
      const taxaTotal = taxaJuros > 0 ? taxaJuros : TARIFA_PROCESSAMENTO_BASE
      const fator = Math.max(0.1, 1 - taxaTotal / 100)
      const valorTotalCliente = Math.round((valor / fator) * 100) / 100
      const valorParcela = Math.round((valorTotalCliente / parcelas) * 100) / 100
      const valorTaxa = Math.round((valorTotalCliente - valor) * 100) / 100

      return {
        parcelas,
        valorParcela,
        valorTotal: valorTotalCliente,
        valorTotalCliente,
        taxaPercentual: taxaTotal,
        valorTaxaDescontada: valorTaxa,
        valorLiquidoReceber: valor,
        temJuros: taxaJuros > 0,
      }
    }

    // modo === "absorver" (Padrão para valores cheios que o Kaio já combinou, ex: R$ 560 em 3x)
    const valorTotalCliente = valor
    const valorParcela = Math.round((valor / parcelas) * 100) / 100
    const taxaAplicada = taxaJuros > 0 ? taxaJuros : 0
    const valorTaxa = Math.round((valor * (taxaAplicada / 100)) * 100) / 100
    const valorLiquido = Math.round((valor - valorTaxa) * 100) / 100

    return {
      parcelas,
      valorParcela,
      valorTotal: valorTotalCliente,
      valorTotalCliente,
      taxaPercentual: taxaAplicada,
      valorTaxaDescontada: valorTaxa,
      valorLiquidoReceber: valorLiquido,
      temJuros: false, // para o cliente é sem juros adicionais
    }
  })
}

/**
 * Gera um texto formatado e profissional pronto para enviar no WhatsApp do cliente
 */
export function formatarSimulacaoParaWhatsapp(
  valorBase: number,
  parcelas: SimularParcela[],
  modoOuNome?: ModoSimulacaoTaxa | string,
  nomeClienteParam?: string
): string {
  let modo: ModoSimulacaoTaxa = parcelas.some((p) => p.temJuros) ? "repassar" : "absorver"
  let nomeCliente = nomeClienteParam
  if (modoOuNome === "absorver" || modoOuNome === "repassar" || modoOuNome === "reverso") {
    modo = modoOuNome
  } else if (typeof modoOuNome === "string") {
    nomeCliente = modoOuNome
  }

  const saudacao = nomeCliente ? `Olá, ${nomeCliente.split(" ")[0]}! ` : ""
  let texto = `💳 *${saudacao}CONDIÇÕES DE PAGAMENTO NO CARTÃO (MERCADO PAGO)*\n\n`

  if (modo === "absorver") {
    texto += `💰 *Valor Total do Pedido:* ${formatarMoeda(valorBase)}\n`
    texto += `✨ *Parcelamento sem juros adicionais no link:*\n\n`
  } else if (modo === "repassar") {
    texto += `💰 *Valor à vista:* ${formatarMoeda(valorBase)}\n`
    texto += `Opções de parcelamento no cartão de crédito:\n\n`
  } else {
    texto += `Opções de pagamento no cartão:\n\n`
  }

  for (const p of parcelas) {
    if (p.parcelas === 1) {
      texto += `• *1x de ${formatarMoeda(p.valorParcela)}* (à vista no crédito)\n`
    } else {
      texto += `• *${p.parcelas}x de ${formatarMoeda(p.valorParcela)}*`
      if (modo === "repassar" && p.temJuros) {
        texto += ` (Total: ${formatarMoeda(p.valorTotalCliente)})\n`
      } else {
        texto += ` (sem acréscimo)\n`
      }
    }
  }

  texto += `\nAssim que confirmar a opção desejada, enviamos o link seguro do Mercado Pago para você pagar em até 12x! 🤝✨\n`
  texto += `*Toldos Print & Comunicação Visual*`
  return texto
}
