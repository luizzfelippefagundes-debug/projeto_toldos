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

export type IntencaoRetorno = "aprovado" | "negociacao" | "perdido"

// Analisa a mensagem do cliente recebida pelo WhatsApp e classifica em
// intenção de aprovação, negociação/dúvida ou perda/recusa.
export function identificarIntencaoMensagem(texto: string): IntencaoRetorno | null {
  if (!texto || typeof texto !== "string") return null
  const limpo = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()

  // 1. Recusa / Perdido (checar antes para evitar falsos positivos de "não aprovei", etc.)
  const padroesPerdido = [
    /\b(nao\s+vou\s+querer|nao\s+quero|nao\s+vamos\s+fazer|nao\s+vou\s+fazer)\b/,
    /\b(muito\s+caro|ficou\s+caro|fora\s+do\s+(orcamento|meu\s+bolso))\b/,
    /\b(desisti|desistimos|cancelei|cancelar|cancelado)\b/,
    /\b(fechei\s+com\s+outro|fiz\s+com\s+outro|comprei\s+em\s+outro\s+lugar)\b/,
    /\b(deixa\s+pra\s+(la|depois)|sem\s+interesse|nao\s+tenho\s+interesse)\b/,
    /\b(recusado|reprovado)\b/,
    /\b(nao\s+aprovo|nao\s+aprovei|nao\s+foi\s+aprovado)\b/,
  ]
  if (padroesPerdido.some((p) => p.test(limpo))) {
    return "perdido"
  }

  // 2. Aprovação
  const padroesAprovado = [
    /\b(aprovado|aprovada|aprovo|aprovamos)\b/,
    /\b(pode\s+(fazer|iniciar|produzir|rodar|mandar|dar\s+inicio|tocar|prosseguir))\b/,
    /\b(fechado|fechou|vamos\s+fechar|pode\s+fechar)\b/,
    /\b(ta\s+aprovado|esta\s+aprovado|tudo\s+certo\s+pode\s+fazer)\b/,
    /\b(confirmado|confirmo|confirmar|autorizado|autorizo)\b/,
    /\b(manda\s+bala|bora\s+produzir|bora\s+fazer)\b/,
    /^(sim|ok|beleza|blz|combinado|show|perfeito|positivo|otimo|fechou)[\s!.]*$/,
    /^(sim|ok|beleza|show|perfeito)\s*,\s*(pode\s+fazer|aprovado|manda\s+bala)/,
  ]
  if (padroesAprovado.some((p) => p.test(limpo))) {
    return "aprovado"
  }

  // 3. Negociação / Dúvida
  const padroesNegociacao = [
    /\b(desconto|consegue\s+melhorar|melhor\s+preco|menor\s+valor|faz\s+por)\b/,
    /\b(parcela|parcelar|parcelamento|divide|dividir|quantas\s+vezes)\b/,
    /\b(frete|prazo|entrega|consegue\s+entregar)\b/,
    /\b(duvida|pergunta|queria\s+saber|alterar|mudar|trocar|medida|tamanho)\b/,
  ]
  if (padroesNegociacao.some((p) => p.test(limpo))) {
    return "negociacao"
  }

  return null
}
