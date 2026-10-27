import { describe, expect, it } from "vitest"
import { linkWhatsApp, retornoDoOrcamento, situacaoContato, somarDias } from "@/lib/retornos"
import type { Orcamento } from "@/lib/types"

const orcamento = {
  id: "o1",
  numero: 1001,
  clienteId: "c1",
  item: {} as Orcamento["item"],
  ajusteManual: 0,
  anexoNome: null,
  status: "fechado",
  criadoEm: "2026-10-20T15:00:00.000Z",
  fechadoEm: "2026-10-20T15:00:00.000Z",
} as Orcamento

describe("retornos", () => {
  it("sugere o primeiro contato 2 dias depois de emitido", () => {
    expect(retornoDoOrcamento(orcamento)).toMatchObject({
      etapa: "aguardando",
      proximoContato: "2026-10-22",
    })
  })

  it("classifica o contato em atrasado, hoje ou futuro", () => {
    const hoje = new Date(2026, 9, 22)
    const base = { etapa: "aguardando" as const, atualizadoEm: "" }
    expect(situacaoContato({ ...base, proximoContato: "2026-10-21" }, hoje)).toBe("atrasado")
    expect(situacaoContato({ ...base, proximoContato: "2026-10-22" }, hoje)).toBe("hoje")
    expect(situacaoContato({ ...base, proximoContato: "2026-10-23" }, hoje)).toBe("futuro")
  })

  it("não lembra de orçamento aprovado ou perdido", () => {
    const hoje = new Date(2026, 9, 22)
    expect(
      situacaoContato({ etapa: "aprovado", proximoContato: "2026-10-01", atualizadoEm: "" }, hoje)
    ).toBeNull()
  })

  it("soma dias a partir da data marcada ou de hoje", () => {
    const hoje = new Date(2026, 9, 30)
    expect(somarDias(undefined, 3, hoje)).toBe("2026-11-02")
    expect(somarDias("2026-10-22", 7, hoje)).toBe("2026-10-29")
  })

  it("monta o link do WhatsApp com DDI", () => {
    expect(linkWhatsApp("(27) 99748-9714", "oi")).toBe("https://wa.me/5527997489714?text=oi")
    expect(linkWhatsApp("123", "oi")).toBeNull()
  })
})
