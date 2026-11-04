import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { buscarMidiaBase64, enviarDocumentoWhatsapp, enviarMensagemWhatsapp } from "@/lib/evolution-api"

// Sem EVOLUTION_API_URL/EVOLUTION_API_KEY/EVOLUTION_INSTANCE configurados
// (ex.: ambiente de teste, ou antes da instância estar pronta), tudo vira
// no-op — nunca derruba o fluxo do bot nem tenta chamar a rede.
describe("evolution-api: sem credenciais configuradas", () => {
  const originais = {
    EVOLUTION_API_URL: process.env.EVOLUTION_API_URL,
    EVOLUTION_API_KEY: process.env.EVOLUTION_API_KEY,
    EVOLUTION_INSTANCE: process.env.EVOLUTION_INSTANCE,
  }

  beforeEach(() => {
    delete process.env.EVOLUTION_API_URL
    delete process.env.EVOLUTION_API_KEY
    delete process.env.EVOLUTION_INSTANCE
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    process.env.EVOLUTION_API_URL = originais.EVOLUTION_API_URL
    process.env.EVOLUTION_API_KEY = originais.EVOLUTION_API_KEY
    process.env.EVOLUTION_INSTANCE = originais.EVOLUTION_INSTANCE
    vi.unstubAllGlobals()
  })

  it("enviarMensagemWhatsapp não chama fetch", async () => {
    await enviarMensagemWhatsapp("5511999990000", "oi")
    expect(fetch).not.toHaveBeenCalled()
  })

  it("enviarDocumentoWhatsapp não chama fetch", async () => {
    await enviarDocumentoWhatsapp("5511999990000", "base64...", "orcamento.pdf")
    expect(fetch).not.toHaveBeenCalled()
  })

  it("buscarMidiaBase64 devolve null sem chamar fetch", async () => {
    const resultado = await buscarMidiaBase64({ id: "abc" })
    expect(resultado).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe("evolution-api: com credenciais configuradas", () => {
  beforeEach(() => {
    process.env.EVOLUTION_API_URL = "https://evolution.exemplo.com/"
    process.env.EVOLUTION_API_KEY = "chave-teste"
    process.env.EVOLUTION_INSTANCE = "toldosprint"
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })))
  })

  afterEach(() => {
    delete process.env.EVOLUTION_API_URL
    delete process.env.EVOLUTION_API_KEY
    delete process.env.EVOLUTION_INSTANCE
    vi.unstubAllGlobals()
  })

  it("enviarMensagemWhatsapp chama a URL certa, sem barra duplicada", async () => {
    await enviarMensagemWhatsapp("5511999990000", "oi")
    expect(fetch).toHaveBeenCalledWith(
      "https://evolution.exemplo.com/message/sendText/toldosprint",
      expect.objectContaining({ method: "POST" })
    )
  })

  it("enviarDocumentoWhatsapp manda mediatype 'document'", async () => {
    await enviarDocumentoWhatsapp("5511999990000", "base64...", "orcamento.pdf", "segue o PDF")
    const chamada = vi.mocked(fetch).mock.calls[0]
    const corpo = JSON.parse((chamada[1] as RequestInit).body as string)
    expect(corpo).toMatchObject({
      number: "5511999990000",
      mediatype: "document",
      fileName: "orcamento.pdf",
      caption: "segue o PDF",
    })
  })
})
