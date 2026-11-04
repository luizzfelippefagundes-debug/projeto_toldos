// Cliente da Evolution API (servidor próprio, self-hosted, já usado nos
// outros projetos) — aqui a Toldos Print é uma instância só (negócio único),
// então o nome da instância vem de EVOLUTION_INSTANCE, não de uma coluna no
// banco. Sem as env vars configuradas, vira um no-op registrado no log, pra
// não derrubar o fluxo do bot antes da instância estar pronta.
function configurada() {
  const baseUrl = process.env.EVOLUTION_API_URL
  const apiKey = process.env.EVOLUTION_API_KEY
  const instancia = process.env.EVOLUTION_INSTANCE
  if (!baseUrl || !apiKey || !instancia) return null
  return { baseUrl: baseUrl.replace(/\/$/, ""), apiKey, instancia }
}

export async function enviarMensagemWhatsapp(numero: string, texto: string): Promise<void> {
  const cfg = configurada()
  if (!cfg) {
    console.warn("[whatsapp] Evolution API não configurada — mensagem não enviada:", { numero, texto })
    return
  }
  const resposta = await fetch(`${cfg.baseUrl}/message/sendText/${cfg.instancia}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: cfg.apiKey },
    body: JSON.stringify({ number: numero, text: texto }),
  })
  if (!resposta.ok) {
    console.error("[whatsapp] Falha ao enviar mensagem:", resposta.status, (await resposta.text().catch(() => "")).slice(0, 500))
  }
}

// PDF do orçamento (ou qualquer documento) anexado — mediaBase64 sem o
// prefixo "data:...;base64,", só o conteúdo.
export async function enviarDocumentoWhatsapp(
  numero: string,
  mediaBase64: string,
  nomeArquivo: string,
  legenda?: string
): Promise<void> {
  const cfg = configurada()
  if (!cfg) {
    console.warn("[whatsapp] Evolution API não configurada — documento não enviado:", { numero, nomeArquivo })
    return
  }
  const resposta = await fetch(`${cfg.baseUrl}/message/sendMedia/${cfg.instancia}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: cfg.apiKey },
    body: JSON.stringify({
      number: numero,
      mediatype: "document",
      mimetype: "application/pdf",
      fileName: nomeArquivo,
      caption: legenda,
      media: mediaBase64,
    }),
  })
  if (!resposta.ok) {
    console.error("[whatsapp] Falha ao enviar documento:", resposta.status, (await resposta.text().catch(() => "")).slice(0, 500))
  }
}

// Mídia recebida do cliente (foto, áudio) — o payload do webhook só traz
// metadados; o conteúdo em si precisa ser buscado à parte, com a `key`
// exatamente como veio no webhook.
export async function buscarMidiaBase64(chaveMensagem: Record<string, unknown>): Promise<string | null> {
  const cfg = configurada()
  if (!cfg) return null
  const resposta = await fetch(`${cfg.baseUrl}/chat/getBase64FromMediaMessage/${cfg.instancia}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: cfg.apiKey },
    body: JSON.stringify({ message: { key: chaveMensagem }, convertToMp4: false }),
  })
  if (!resposta.ok) {
    console.error("[whatsapp] Falha ao buscar mídia:", resposta.status)
    return null
  }
  const dados = (await resposta.json()) as { base64?: string }
  return dados.base64 ?? null
}
