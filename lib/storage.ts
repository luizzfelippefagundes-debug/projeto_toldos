import { toast } from "sonner"

let erroArmazenamentoNotificado = false

function notificarErroArmazenamento(operacao: string, chave: string, erro: unknown) {
  console.error(`Falha ao ${operacao} "${chave}" no armazenamento local.`, erro)
  if (erroArmazenamentoNotificado) return

  erroArmazenamentoNotificado = true
  toast.error("Não foi possível acessar os dados salvos neste navegador.", {
    description:
      "Confira o armazenamento do navegador. Alterações recentes podem não persistir.",
  })
}

export function lerArmazenamento<T>(chave: string, valorPadrao: T): T {
  if (typeof window === "undefined") return valorPadrao
  try {
    const bruto = window.localStorage.getItem(chave)
    if (!bruto) return valorPadrao
    const valor: unknown = JSON.parse(bruto)
    if (
      (Array.isArray(valorPadrao) && !Array.isArray(valor)) ||
      (!Array.isArray(valorPadrao) &&
        (typeof valor !== typeof valorPadrao || valor === null))
    ) {
      throw new TypeError("Os dados salvos têm um formato incompatível.")
    }
    return valor as T
  } catch (erro) {
    notificarErroArmazenamento("ler", chave, erro)
    return valorPadrao
  }
}

export function salvarArmazenamento<T>(chave: string, valor: T): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(chave, JSON.stringify(valor))
  } catch (erro) {
    notificarErroArmazenamento("salvar", chave, erro)
  }
}
