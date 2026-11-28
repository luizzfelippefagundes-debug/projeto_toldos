import { enviarMensagemWhatsapp } from "./evolution-api"
import { obterTelefoneKaio } from "./notificacoes-producao"
import { linkOrcamentoLoja, mensagemNovoOrcamentoLoja, type PedidoLoja } from "./loja-orcamento"

const TEMPO_MAXIMO_MS = 10_000

// Avisa o Kaio no WhatsApp que chegou um orçamento novo pelo site. Nunca
// lança erro: o pedido do cliente já foi gravado e não pode falhar por causa
// do aviso (Evolution fora do ar, número errado etc.).
export async function avisarKaioNovoOrcamentoLoja(
  pedido: PedidoLoja,
  orc: { id: string; numeroFormatado: string }
): Promise<boolean> {
  try {
    const telefone = await obterTelefoneKaio()
    const texto = mensagemNovoOrcamentoLoja(pedido, {
      numeroFormatado: orc.numeroFormatado,
      link: linkOrcamentoLoja(process.env.NEXT_PUBLIC_APP_URL, orc.id),
    })
    let timer: ReturnType<typeof setTimeout> | undefined
    const limite = new Promise<{ ok: false }>((resolve) => {
      timer = setTimeout(() => resolve({ ok: false }), TEMPO_MAXIMO_MS)
    })
    const r = await Promise.race([enviarMensagemWhatsapp(telefone, texto), limite]).finally(() => clearTimeout(timer))
    if (!r.ok) console.warn("[loja] aviso de orçamento novo ao Kaio não foi enviado", orc.numeroFormatado)
    return r.ok
  } catch (err) {
    console.error("[loja] erro ao avisar o Kaio do orçamento novo:", err)
    return false
  }
}
