import { describe, expect, it, vi, beforeEach } from "vitest"
import { POST } from "@/app/api/transmissao/route"
import * as evolutionApi from "@/lib/evolution-api"
import { linkWhatsapp } from "@/lib/whatsapp"

describe("Transmissão API e Disparo Manual", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("rejeita payload sem destinatários ou sem mensagem/imagem", async () => {
    const res = await POST(
      new Request("http://localhost/api/transmissao", {
        method: "POST",
        body: JSON.stringify({ mensagem: "", telefones: [] }),
      })
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.erro).toBeDefined()
  })

  it("envia mensagem de texto para telefones selecionados via robô", async () => {
    const spy = vi.spyOn(evolutionApi, "enviarMensagemWhatsapp").mockResolvedValue({ ok: true })

    const res = await POST(
      new Request("http://localhost/api/transmissao", {
        method: "POST",
        body: JSON.stringify({
          mensagem: "Feliz Natal e Boas Festas da Toldos Print!",
          telefones: ["27999991111", "27999992222"],
        }),
      })
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.enviados).toBe(2)
    expect(json.falhas).toBe(0)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it("envia foto com legenda quando imagem for fornecida", async () => {
    const spy = vi.spyOn(evolutionApi, "enviarImagemWhatsapp").mockResolvedValue({ ok: true })

    const res = await POST(
      new Request("http://localhost/api/transmissao", {
        method: "POST",
        body: JSON.stringify({
          mensagem: "Confira nossa promoção de Natal!",
          telefones: ["27999993333"],
          imagem: "data:image/jpeg;base64,123456",
        }),
      })
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.enviados).toBe(1)
    expect(spy).toHaveBeenCalledWith("27999993333", "data:image/jpeg;base64,123456", "Confira nossa promoção de Natal!")
  })

  it("gera link wa.me correto para o disparo manual no WhatsApp", () => {
    const link = linkWhatsapp("(27) 99750-1517", "Feliz Natal!")
    expect(link).toBe("https://wa.me/5527997501517?text=Feliz%20Natal!")
  })
})
