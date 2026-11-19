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

// Se WHATSAPP_TEST_RECIPIENT estiver definida e estivermos fora de produção,
// redireciona para esse número — em produção, sempre envia diretamente ao destinatário real.
function resolverNumero(numero: string): string {
  const alvo =
    process.env.NODE_ENV === "development" && process.env.WHATSAPP_TEST_RECIPIENT
      ? process.env.WHATSAPP_TEST_RECIPIENT
      : numero
  return alvo.replace(/\D/g, "")
}

export async function enviarMensagemWhatsapp(
  numero: string,
  texto: string
): Promise<{ ok: boolean; status?: number; data?: unknown }> {
  const cfg = configurada()
  if (!cfg) {
    console.warn("[whatsapp] Evolution API não configurada — mensagem não enviada:", { numero, texto })
    return { ok: false, status: 500, data: "Evolution API não configurada" }
  }
  const numDestino = resolverNumero(numero)
  console.log(`[whatsapp] Enviando mensagem para ${numDestino} via instancia ${cfg.instancia}...`)
  const resposta = await fetch(`${cfg.baseUrl}/message/sendText/${cfg.instancia}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: cfg.apiKey },
    body: JSON.stringify({ number: numDestino, text: texto }),
  })
  const textBody = await resposta.text().catch(() => "")
  let jsonBody: unknown = null
  try {
    jsonBody = JSON.parse(textBody)
  } catch {}
  if (!resposta.ok) {
    console.error("[whatsapp] Falha ao enviar mensagem:", resposta.status, textBody.slice(0, 500))
    return { ok: false, status: resposta.status, data: jsonBody || textBody }
  }
  console.log("[whatsapp] Resposta do envio:", textBody.slice(0, 200))
  return { ok: true, status: resposta.status, data: jsonBody || textBody }
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
      number: resolverNumero(numero),
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

export async function enviarImagemWhatsapp(
  numero: string,
  imagemBase64OuUrl: string,
  legenda?: string,
  mimetype?: string
): Promise<{ ok: boolean; status?: number; data?: unknown }> {
  const cfg = configurada()
  if (!cfg) {
    console.warn("[whatsapp] Evolution API não configurada — imagem não enviada:", { numero })
    return { ok: false, status: 500, data: "Evolution API não configurada" }
  }

  let mediaPayload = imagemBase64OuUrl
  let mime = mimetype || "image/jpeg"

  if (imagemBase64OuUrl.startsWith("data:")) {
    const match = imagemBase64OuUrl.match(/^data:([^;]+);base64,(.*)$/)
    if (match) {
      mime = match[1] || mime
      mediaPayload = match[2]
    }
  }

  const resposta = await fetch(`${cfg.baseUrl}/message/sendMedia/${cfg.instancia}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: cfg.apiKey },
    body: JSON.stringify({
      number: resolverNumero(numero),
      mediatype: "image",
      mimetype: mime,
      caption: legenda,
      media: mediaPayload,
    }),
  })
  const textBody = await resposta.text().catch(() => "")
  let jsonBody: unknown = null
  try {
    jsonBody = JSON.parse(textBody)
  } catch {}

  if (!resposta.ok) {
    console.error("[whatsapp] Falha ao enviar imagem:", resposta.status, textBody.slice(0, 500))
    return { ok: false, status: resposta.status, data: jsonBody || textBody }
  }
  return { ok: true, status: resposta.status, data: jsonBody || textBody }
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
