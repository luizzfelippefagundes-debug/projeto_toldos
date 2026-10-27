import { formatarDataInput, interpretarDataLocal } from "./date"
import type { Orcamento, RetornoOrcamento } from "./types"

// Dias depois de emitir o orçamento pra fazer o primeiro contato, quando
// ninguém marcou uma data ainda.
export const DIAS_PRIMEIRO_RETORNO = 2

export type SituacaoContato = "atrasado" | "hoje" | "futuro"

// Orçamento que nunca foi mexido no quadro entra em "aguardando", com o
// primeiro contato sugerido pra alguns dias depois de emitido.
export function retornoDoOrcamento(orcamento: Orcamento): RetornoOrcamento {
  if (orcamento.retorno) return orcamento.retorno
  const base = interpretarDataLocal(orcamento.fechadoEm ?? orcamento.criadoEm)
  const proximo = new Date(base.getFullYear(), base.getMonth(), base.getDate())
  proximo.setDate(proximo.getDate() + DIAS_PRIMEIRO_RETORNO)
  return {
    etapa: "aguardando",
    proximoContato: Number.isFinite(proximo.getTime()) ? formatarDataInput(proximo) : undefined,
    atualizadoEm: orcamento.fechadoEm ?? orcamento.criadoEm,
  }
}

// Só orçamentos ainda em aberto com o cliente têm lembrete.
export function situacaoContato(
  retorno: RetornoOrcamento,
  hoje: Date
): SituacaoContato | null {
  if (retorno.etapa === "aprovado" || retorno.etapa === "perdido") return null
  if (!retorno.proximoContato) return null
  const hojeIso = formatarDataInput(hoje)
  if (retorno.proximoContato < hojeIso) return "atrasado"
  if (retorno.proximoContato === hojeIso) return "hoje"
  return "futuro"
}

// Emitidos entram no quadro; aberto é rascunho e cancelado saiu do jogo.
export function entraNoQuadro(orcamento: Orcamento): boolean {
  return orcamento.status === "fechado"
}

export function somarDias(dataIso: string | undefined, dias: number, hoje: Date): string {
  const base = dataIso ? interpretarDataLocal(dataIso) : hoje
  const inicio = new Date(base.getFullYear(), base.getMonth(), base.getDate())
  inicio.setDate(inicio.getDate() + dias)
  return formatarDataInput(inicio)
}

// Link do WhatsApp com DDI do Brasil quando o número veio só com DDD.
export function linkWhatsApp(telefone: string, mensagem: string): string | null {
  const digitos = telefone.replace(/\D/g, "")
  if (digitos.length < 10) return null
  const numero = digitos.length <= 11 ? `55${digitos}` : digitos
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`
}
