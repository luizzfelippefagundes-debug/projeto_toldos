import { describe, expect, it } from "vitest"
import { gerarPayloadPixEstatico, criarPixMercadoPago } from "@/lib/mercadopago"

describe("Mercado Pago e Pix", () => {
  it("gera payload Pix estático compatível com padrão BACEN (000201...)", () => {
    const payload = gerarPayloadPixEstatico({
      chave: "27997489714",
      nome: "TOLDOS PRINT",
      cidade: "COLATINA",
      valor: 150.5,
      identificador: "ORC10025",
    })

    expect(payload).toMatch(/^000201/)
    expect(payload).toContain("BR.GOV.BCB.PIX")
    expect(payload).toContain("27997489714")
    expect(payload).toContain("150.50")
    expect(payload).toContain("TOLDOS PRINT")
    expect(payload).toContain("COLATINA")
    expect(payload).toContain("ORC10025")
    expect(payload.length).toBeGreaterThan(60)
  })

  it("criarPixMercadoPago retorna QR code e Copia e Cola em modo contingência/demonstração quando sem token", async () => {
    const res = await criarPixMercadoPago({
      valor: 350.0,
      descricao: "Entrada Orçamento Toldos Print",
      clienteNome: "João da Silva",
      externalReference: "orc-12345",
    })

    expect(res.sucesso).toBe(true)
    expect(res.qrCode).toBeDefined()
    expect(res.qrCode).toMatch(/^000201/)
    expect(res.qrCodeBase64).toBeDefined()
    expect(res.qrCodeBase64?.length).toBeGreaterThan(100)
  })
})
