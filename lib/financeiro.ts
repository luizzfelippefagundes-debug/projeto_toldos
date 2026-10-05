import type { LancamentoFinanceiro } from "./types"
import { estaNosProximosDias } from "./date-window"
import { interpretarDataLocal } from "./date"

export interface ResumoFinanceiro {
  aReceber: number
  aPagar: number
  recebido: number
  pago: number
  vencidoAReceber: number
  vencidoAPagar: number
  recebiveisVencendo7Dias: number
  boletosVencendo7Dias: number
  quantidadeVencida: number
}

function dentroDoPeriodo(
  dataIso: string,
  dataDe: string,
  dataAte: string
): boolean {
  if (!dataDe && !dataAte) return true

  const data = interpretarDataLocal(dataIso)
  if (!Number.isFinite(data.getTime())) return false
  if (dataDe) {
    const inicio = new Date(`${dataDe}T00:00:00`)
    if (!Number.isFinite(inicio.getTime()) || data < inicio) return false
  }
  if (dataAte) {
    const fim = new Date(`${dataAte}T23:59:59.999`)
    if (!Number.isFinite(fim.getTime()) || data > fim) return false
  }
  return true
}

export function estaLancamentoVencido(
  lancamento: LancamentoFinanceiro,
  hoje: Date
): boolean {
  if (
    lancamento.status !== "pendente" ||
    !Number.isFinite(hoje.getTime())
  ) {
    return false
  }

  const vencimento = interpretarDataLocal(lancamento.vencimento)
  if (!Number.isFinite(vencimento.getTime())) return false
  const inicioHoje = new Date(
    hoje.getFullYear(),
    hoje.getMonth(),
    hoje.getDate()
  )
  const inicioVencimento = new Date(
    vencimento.getFullYear(),
    vencimento.getMonth(),
    vencimento.getDate()
  )
  return inicioVencimento < inicioHoje
}

export function resumirFinanceiro(
  lancamentos: LancamentoFinanceiro[],
  hoje: Date,
  dataDe = "",
  dataAte = ""
): ResumoFinanceiro {
  const resumo: ResumoFinanceiro = {
    aReceber: 0,
    aPagar: 0,
    recebido: 0,
    pago: 0,
    vencidoAReceber: 0,
    vencidoAPagar: 0,
    recebiveisVencendo7Dias: 0,
    boletosVencendo7Dias: 0,
    quantidadeVencida: 0,
  }

  for (const lancamento of lancamentos) {
    const vencido = estaLancamentoVencido(lancamento, hoje)
    const dataReferencia =
      lancamento.status === "pago"
        ? lancamento.pagoEm ?? lancamento.criadoEm
        : lancamento.vencimento
    const noPeriodo = dentroDoPeriodo(dataReferencia, dataDe, dataAte)

    if (lancamento.status === "pago" && noPeriodo) {
      if (lancamento.tipo === "receita") resumo.recebido += lancamento.valor
      else resumo.pago += lancamento.valor
    }

    if (lancamento.status === "pendente" && noPeriodo) {
      if (lancamento.tipo === "receita") resumo.aReceber += lancamento.valor
      else resumo.aPagar += lancamento.valor

      if (vencido) {
        resumo.quantidadeVencida += 1
        if (lancamento.tipo === "receita") {
          resumo.vencidoAReceber += lancamento.valor
        } else {
          resumo.vencidoAPagar += lancamento.valor
        }
      }
    }

    if (
      lancamento.status === "pendente" &&
      estaNosProximosDias(lancamento.vencimento, hoje, 7)
    ) {
      if (lancamento.tipo === "receita") {
        resumo.recebiveisVencendo7Dias += 1
      }
      if (lancamento.formaPagamento === "boleto") {
        resumo.boletosVencendo7Dias += 1
      }
    }
  }

  return resumo
}
