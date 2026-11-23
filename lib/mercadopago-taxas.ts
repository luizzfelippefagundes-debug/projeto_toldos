import { formatarMoeda } from "./format"

export interface SimularParcela {
  parcelas: number
  valorParcela: number
  valorTotal: number
  taxaPercentual: number
  temJuros: boolean
}

/**
 * Tabela oficial de coeficientes de juros de parcelamento do Mercado Pago (Brasil),
 * cobrados do comprador no Checkout e Point (recebimento na hora).
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

export function simularParcelasMercadoPago(valorBase: number): SimularParcela[] {
  if (valorBase <= 0) return []
  return Object.entries(TAXAS_PADRAO_MERCADO_PAGO).map(([nStr, taxa]) => {
    const parcelas = Number(nStr)
    const valorTotal = valorBase * (1 + taxa / 100)
    const valorParcela = valorTotal / parcelas
    return {
      parcelas,
      valorParcela: Math.round(valorParcela * 100) / 100,
      valorTotal: Math.round(valorTotal * 100) / 100,
      taxaPercentual: taxa,
      temJuros: taxa > 0,
    }
  })
}

/**
 * Gera um texto formatado e profissional pronto para enviar no WhatsApp do cliente
 */
export function formatarSimulacaoParaWhatsapp(
  valorBase: number,
  parcelas: SimularParcela[],
  nomeCliente?: string
): string {
  const saudacao = nomeCliente ? `Olá, ${nomeCliente}! ` : ""
  let texto = `💳 *${saudacao}CONDIÇÕES DE PARCELAMENTO NO CARTÃO (MERCADO PAGO)*\n`
  texto += `Valor à vista: *${formatarMoeda(valorBase)}*\n\n`
  texto += `Opções de parcelamento:\n`

  for (const p of parcelas) {
    if (p.parcelas === 1) {
      texto += `• *1x de ${formatarMoeda(p.valorParcela)}* (à vista)\n`
    } else {
      texto += `• *${p.parcelas}x de ${formatarMoeda(p.valorParcela)}* (Total: ${formatarMoeda(p.valorTotal)})\n`
    }
  }

  texto += `\n*Toldos Print* — Pagamento seguro e aprovado na hora!`
  return texto
}
