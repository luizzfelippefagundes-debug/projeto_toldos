export function lerArmazenamento<T>(chave: string, valorPadrao: T): T {
  if (typeof window === "undefined") return valorPadrao
  try {
    const bruto = window.localStorage.getItem(chave)
    if (!bruto) return valorPadrao
    return JSON.parse(bruto) as T
  } catch {
    return valorPadrao
  }
}

export function salvarArmazenamento<T>(chave: string, valor: T): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(chave, JSON.stringify(valor))
  } catch {
    // localStorage indisponível (modo privado, quota excedida etc.) — ignora
  }
}
