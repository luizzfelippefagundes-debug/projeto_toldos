import { describe, expect, it } from "vitest"
import {
  linkWhatsapp,
  mensagemOrcamentoWhatsapp,
  telefoneParaWhatsapp,
} from "@/lib/whatsapp"

describe("telefoneParaWhatsapp", () => {
  it("coloca o 55 do Brasil quando falta", () => {
    expect(telefoneParaWhatsapp("27997501517")).toBe("5527997501517")
    expect(telefoneParaWhatsapp("(27) 99750-1517")).toBe("5527997501517")
    expect(telefoneParaWhatsapp("27 997501517")).toBe("5527997501517")
  })

  it("não repete o 55 quando já tem", () => {
    expect(telefoneParaWhatsapp("+55 27 99750-1517")).toBe("5527997501517")
    expect(telefoneParaWhatsapp("5527997501517")).toBe("5527997501517")
  })

  it("aceita fixo (10 dígitos)", () => {
    expect(telefoneParaWhatsapp("(27) 3722-1234")).toBe("552737221234")
  })

  it("devolve null quando não dá pra usar", () => {
    expect(telefoneParaWhatsapp("")).toBeNull()
    expect(telefoneParaWhatsapp("   ")).toBeNull()
    expect(telefoneParaWhatsapp("12345")).toBeNull()
    expect(telefoneParaWhatsapp("abc")).toBeNull()
  })
})

describe("linkWhatsapp", () => {
  it("monta o link do WhatsApp com o texto codificado", () => {
    expect(linkWhatsapp("27997501517", "Olá, tudo bem?")).toBe(
      "https://wa.me/5527997501517?text=Ol%C3%A1%2C%20tudo%20bem%3F"
    )
  })

  it("sem telefone válido não tem link", () => {
    expect(linkWhatsapp("", "oi")).toBeNull()
  })
})

describe("mensagemOrcamentoWhatsapp", () => {
  it("cita o cliente, o número, o valor e a validade", () => {
    const texto = mensagemOrcamentoWhatsapp({
      clienteNome: "FOKUS",
      numero: "1002-26",
      total: "R$ 1.020,00",
      validoAte: "05/11/2026",
    })
    expect(texto).toContain("FOKUS")
    expect(texto).toContain("1002-26")
    expect(texto).toContain("R$ 1.020,00")
    expect(texto).toContain("05/11/2026")
  })
})
