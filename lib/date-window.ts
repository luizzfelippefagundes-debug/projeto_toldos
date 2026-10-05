import { interpretarDataLocal } from "./date"

export function estaNosProximosDias(
  data: Date | string,
  hoje: Date,
  dias: number
): boolean {
  const instante = data instanceof Date ? data : interpretarDataLocal(data)
  if (
    !Number.isFinite(instante.getTime()) ||
    !Number.isFinite(dias) ||
    dias < 0
  ) {
    return false
  }

  const inicioHoje = new Date(
    hoje.getFullYear(),
    hoje.getMonth(),
    hoje.getDate()
  )
  const inicioDepoisDaJanela = new Date(inicioHoje)
  inicioDepoisDaJanela.setDate(inicioDepoisDaJanela.getDate() + dias + 1)

  return instante >= inicioHoje && instante < inicioDepoisDaJanela
}
