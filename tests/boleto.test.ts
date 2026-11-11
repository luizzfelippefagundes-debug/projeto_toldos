import { describe, expect, it } from "vitest"
import { _internos, interpretarBoleto, vencimentoPeloFator } from "@/lib/boleto"

function montarLinhaBancaria(
  banco: string,
  fator: string,
  centavos: string,
  campoLivre: string
) {
  const { modulo10, modulo11Bancario } = _internos
  const semDv = banco + "9" + fator + centavos + campoLivre
  const dv = modulo11Bancario(semDv)
  const barras = banco + "9" + dv + fator + centavos + campoLivre
  const c1 = barras.slice(0, 4) + campoLivre.slice(0, 5)
  const c2 = campoLivre.slice(5, 15)
  const c3 = campoLivre.slice(15, 25)
  return (
    c1 + modulo10(c1) + c2 + modulo10(c2) + c3 + modulo10(c3) + dv + fator + centavos
  )
}

describe("interpretarBoleto", () => {
  const hoje = new Date(2026, 9, 23)
  const livre = "1234567890123456789012345"

  it("lê valor e vencimento de uma linha bancária válida", () => {
    // fator 1000 = 22/02/2025
    const linha = montarLinhaBancaria("341", "1000", "0000012345", livre)
    const r = interpretarBoleto(linha, hoje)
    expect(r?.valido).toBe(true)
    expect(r?.valor).toBe(123.45)
    expect(r?.vencimento).toBe("2025-02-22")
    expect(r?.banco).toBe("341")
  })

  it("aceita a linha com pontos e espaços", () => {
    const linha = montarLinhaBancaria("001", "1500", "0000100000", livre)
    const formatada = `${linha.slice(0, 5)}.${linha.slice(5, 10)} ${linha.slice(10)}`
    expect(interpretarBoleto(formatada, hoje)?.valido).toBe(true)
  })

  it("marca como inválida quando um dígito foi lido errado", () => {
    const linha = montarLinhaBancaria("341", "1000", "0000012345", livre)
    const errada = linha.slice(0, 12) + (linha[12] === "1" ? "2" : "1") + linha.slice(13)
    expect(interpretarBoleto(errada, hoje)?.valido).toBe(false)
  })

  it("lê pelo código de barras de 44 dígitos", () => {
    const linha = montarLinhaBancaria("341", "1000", "0000012345", livre)
    const barras = interpretarBoleto(linha, hoje)!.codigoBarras
    const r = interpretarBoleto(barras, hoje)
    expect(r?.valido).toBe(true)
    expect(r?.valor).toBe(123.45)
  })

  it("devolve null pra tamanhos que não são boleto", () => {
    expect(interpretarBoleto("12345", hoje)).toBeNull()
  })

  it("lê boleto de concessionária (mod 10)", () => {
    const { modulo10 } = _internos
    const corpo = "8" + "1" + "6" + "0" + "00000012345" + "0".repeat(29)
    // corpo tem 44 posições; posição 3 é o DV geral
    const semDv = corpo.slice(0, 3) + corpo.slice(4)
    const barras = corpo.slice(0, 3) + modulo10(semDv) + corpo.slice(4)
    const blocos = [0, 11, 22, 33].map((i) => barras.slice(i, i + 11))
    const linha = blocos.map((b) => b + modulo10(b)).join("")
    const r = interpretarBoleto(linha, hoje)
    expect(r?.tipo).toBe("concessionaria")
    expect(r?.valido).toBe(true)
    expect(r?.valor).toBe(123.45)
  })
})

describe("vencimentoPeloFator", () => {
  it("usa o ciclo antigo para datas antes de 2025", () => {
    expect(vencimentoPeloFator(4000, new Date(2008, 8, 1))).toBe("2008-09-19")
  })
  it("ignora fator zero", () => {
    expect(vencimentoPeloFator(0)).toBeUndefined()
  })
})
