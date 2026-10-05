export function interpretarDataLocal(valor: string): Date {
  const partes = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00(?::00(?:\.000)?)?Z)?$/.exec(
    valor
  )
  if (partes) {
    const ano = Number(partes[1])
    const mes = Number(partes[2]) - 1
    const dia = Number(partes[3])
    const data = new Date(ano, mes, dia)
    if (
      data.getFullYear() === ano &&
      data.getMonth() === mes &&
      data.getDate() === dia
    ) {
      return data
    }
  }
  return new Date(valor)
}

export function formatarDataInput(data: Date): string {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, "0")
  const dia = String(data.getDate()).padStart(2, "0")
  return `${ano}-${mes}-${dia}`
}
