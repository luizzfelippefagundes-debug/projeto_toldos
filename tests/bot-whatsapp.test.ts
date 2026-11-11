import { describe, expect, it } from "vitest"
import { formatarTelefoneBrasil, normalizarTelefone } from "@/lib/bot-whatsapp"

describe("normalizarTelefone", () => {
  it("tira tudo que não é dígito", () => {
    expect(normalizarTelefone("(27) 99750-1517")).toBe("27997501517")
  })

  it("mantém o DDI quando já vem com ele", () => {
    expect(normalizarTelefone("+55 27 99750-1517")).toBe("5527997501517")
  })

  it("string só com dígitos permanece igual", () => {
    expect(normalizarTelefone("27997501517")).toBe("27997501517")
  })
})

describe("formatarTelefoneBrasil", () => {
  it("formata celular com DDD e DDI 55", () => {
    expect(formatarTelefoneBrasil("5511999998888")).toBe("(11) 99999-8888")
    expect(formatarTelefoneBrasil("5527997501517")).toBe("(27) 99750-1517")
  })

  it("formata celular sem DDI", () => {
    expect(formatarTelefoneBrasil("11999998888")).toBe("(11) 99999-8888")
  })

  it("formata telefone fixo", () => {
    expect(formatarTelefoneBrasil("552733221100")).toBe("(27) 3322-1100")
  })
})
