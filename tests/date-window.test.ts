import { describe, expect, it } from "vitest"
import { estaNosProximosDias } from "@/lib/date-window"

describe("janela de vencimentos", () => {
  const hoje = new Date(2026, 9, 5, 12)

  it("inclui vencimentos de hoje até o fim do último dia da janela", () => {
    expect(estaNosProximosDias(new Date(2026, 9, 5, 0), hoje, 7)).toBe(true)
    expect(estaNosProximosDias(new Date(2026, 9, 12, 23, 59), hoje, 7)).toBe(
      true
    )
    expect(estaNosProximosDias(new Date(2026, 9, 13, 0), hoje, 7)).toBe(false)
  })

  it("exclui vencimentos passados e datas inválidas", () => {
    expect(estaNosProximosDias(new Date(2026, 9, 4, 23, 59), hoje, 7)).toBe(
      false
    )
    expect(estaNosProximosDias("data inválida", hoje, 7)).toBe(false)
    expect(estaNosProximosDias("2026-10-06", hoje, -1)).toBe(false)
  })

  it("preserva o dia de vencimentos legados em UTC à meia-noite", () => {
    expect(
      estaNosProximosDias("2026-10-05T00:00:00.000Z", hoje, 0)
    ).toBe(true)
  })
})
