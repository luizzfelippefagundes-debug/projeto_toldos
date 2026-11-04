import { describe, expect, it } from "vitest"
import { normalizarTelefone } from "@/lib/bot-whatsapp"

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
