import { describe, expect, it } from "vitest"
import { formatarDataInput, interpretarDataLocal } from "@/lib/date"
import { formatarData } from "@/lib/format"

describe("datas locais", () => {
  it("mantém o dia de vencimento legado guardado em UTC à meia-noite", () => {
    const data = interpretarDataLocal("2026-10-05T00:00:00.000Z")
    expect(formatarData(data.toISOString())).toBe("05/10/2026")
  })

  it("não retrocede dia 10 ou dia 25 de vencimento com qualquer timestamp UTC", () => {
    const d10 = interpretarDataLocal("2026-11-10T00:00:00.000Z")
    expect(d10.getDate()).toBe(10)
    expect(formatarDataInput(d10)).toBe("2026-11-10")

    const d25 = interpretarDataLocal("2026-11-25T00:00:00.000Z")
    expect(d25.getDate()).toBe(25)
    expect(formatarDataInput(d25)).toBe("2026-11-25")

    const dIsoSimples = interpretarDataLocal("2026-11-25")
    expect(dIsoSimples.getDate()).toBe(25)
    expect(formatarDataInput(dIsoSimples)).toBe("2026-11-25")
  })

  it("formata a data local corretamente para campos date", () => {
    expect(formatarDataInput(new Date(2026, 9, 5))).toBe("2026-10-05")
  })
})
