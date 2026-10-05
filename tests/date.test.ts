import { describe, expect, it } from "vitest"
import { formatarDataInput, interpretarDataLocal } from "@/lib/date"
import { formatarData } from "@/lib/format"

describe("datas locais", () => {
  it("mantém o dia de vencimento legado guardado em UTC à meia-noite", () => {
    const data = interpretarDataLocal("2026-10-05T00:00:00.000Z")
    expect(formatarData(data.toISOString())).toBe("05/10/2026")
  })

  it("formata a data local corretamente para campos date", () => {
    expect(formatarDataInput(new Date(2026, 9, 5))).toBe("2026-10-05")
  })
})
