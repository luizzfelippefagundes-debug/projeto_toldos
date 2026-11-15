import { describe, expect, it } from "vitest"
import { formatarLinhaDigitavel, interpretarBoleto } from "@/lib/boleto"

describe("Boleto Suite - Validação de Bancos Brasileiros e Concessionárias", () => {
  const hoje = new Date(2026, 4, 15) // Maio de 2026

  it("1. SICOOB (Banco 756) - Caso real do usuário (Link Internet)", () => {
    // Boleto do usuário Luiz Paulo Pandolfi Caprini / Marineth Silva
    const linha = "75691300780123727200838035480011214420000007000"
    const r = interpretarBoleto(linha, hoje)
    expect(r).not.toBeNull()
    expect(r?.valido).toBe(true)
    expect(r?.tipo).toBe("bancario")
    expect(r?.banco).toBe("756")
    expect(r?.valor).toBe(70.00)
    expect(r?.vencimento).toBe("2026-05-10")
    expect(r?.codigoBarras).toBe("75692144200000070001300701237272003803548001")
    expect(formatarLinhaDigitavel(r!.linhaDigitavel)).toBe(
      "75691.30078 01237.272008 38035.480011 2 14420000007000"
    )
  })

  it("2. SICOOB - Auto-reparo quando OCR come um zero no valor (46 dígitos)", () => {
    // Faltou um zero: '000007000' em vez de '0000007000'
    const linhaComZeroFaltando = "7569130078012372720083803548001121442000007000"
    const r = interpretarBoleto(linhaComZeroFaltando, hoje)
    expect(r?.valido).toBe(true)
    expect(r?.valor).toBe(70.00)
    expect(r?.vencimento).toBe("2026-05-10")
    expect(r?.linhaDigitavel.length).toBe(47)
  })

  it("3. SICOOB - Auto-reparo quando OCR duplica um zero no valor (48 dígitos)", () => {
    // Um zero extra
    const linhaComZeroExtra = "756913007801237272008380354800112144200000007000"
    const r = interpretarBoleto(linhaComZeroExtra, hoje)
    expect(r?.valido).toBe(true)
    expect(r?.valor).toBe(70.00)
    expect(r?.vencimento).toBe("2026-05-10")
    expect(r?.linhaDigitavel.length).toBe(47)
  })

  it("4. BRADESCO (Banco 237) - Boleto com 5 blocos pontuados", () => {
    const linha = "23793.38128 60083.013528 56006.333308 8 89760000015000"
    const r = interpretarBoleto(linha, new Date(2022, 4, 1))
    expect(r?.valido).toBe(true)
    expect(r?.tipo).toBe("bancario")
    expect(r?.banco).toBe("237")
    expect(r?.valor).toBe(150.00)
    expect(r?.vencimento).toBe("2022-05-05")
  })

  it("5. ITAÚ (Banco 341) - Boleto comercial de fornecedor", () => {
    // 34191.09008 00000.123456 78901.234567 8 98760000035025
    // Banco 341, valor 350.25
    const r = interpretarBoleto("34191090080000012345678901234567898760000035025", hoje)
    // Mesmo se os campos livres tiverem DVs recalculados
    expect(r?.tipo).toBe("bancario")
    expect(r?.banco).toBe("341")
    expect(r?.valor).toBe(350.25)
  })

  it("6. Concessionária de Energia Elétrica (Começa com 84, 48 dígitos)", () => {
    // Exemplo padrão ANEEL / Concessionárias de Energia (EDP, Enel, Cemig, CPFL)
    // 4 blocos de 12 dígitos, segmento 4 (energia elétrica / gás), valor R$ 154,38
    // Bloco 1: 84670000001 8
    // Bloco 2: 54380109011 3
    // Bloco 3: 00412015010 6
    // Bloco 4: 14201020260 4
    const linhaEnergia = "846700000018543801090113004120150106142010202604"
    const r = interpretarBoleto(linhaEnergia, hoje)
    expect(r?.tipo).toBe("concessionaria")
    expect(r?.valido).toBe(true)
    expect(r?.valor).toBe(154.38)
    expect(formatarLinhaDigitavel(linhaEnergia)).toBe(
      "846700000018 543801090113 004120150106 142010202604"
    )
  })

  it("7. Concessionária de Água e Esgoto (Começa com 82, 48 dígitos)", () => {
    // Exemplo saneamento / água (Sabesp, Copasa, Cesan, etc.), valor R$ 70,20
    const linhaAgua = "826400000004702000123456789012345678901234567890"
    const r = interpretarBoleto(linhaAgua, hoje)
    expect(r?.tipo).toBe("concessionaria")
    expect(r?.valido).toBe(true)
    expect(r?.valor).toBe(70.20)
    expect(formatarLinhaDigitavel(linhaAgua)).toBe(
      "826400000004 702000123456 789012345678 901234567890"
    )
  })
})
