import { describe, expect, it } from "vitest"
import {
  normalizarDataBoleto,
  normalizarValorBoleto,
  reconciliarBoleto,
} from "@/lib/boleto-reconciliar"
import { datasMensaisAncoradas, deslocarMeses } from "@/lib/parcelas"

describe("Boleto Reconciliação & Robustez", () => {
  const hoje = new Date(2026, 10, 16) // 16 de Novembro de 2026

  describe("1. Normalização de Datas em Qualquer Formato Brasileiro", () => {
    it("deve aceitar DD/MM/AAAA", () => {
      expect(normalizarDataBoleto("13/11/2026")).toBe("2026-11-13")
      expect(normalizarDataBoleto("28/11/2026")).toBe("2026-11-28")
    })

    it("deve aceitar DD.MM.AAAA e DD-MM-AAAA", () => {
      expect(normalizarDataBoleto("13.11.2026")).toBe("2026-11-13")
      expect(normalizarDataBoleto("28-11-2026")).toBe("2026-11-28")
    })

    it("deve aceitar YYYY-MM-DD (ISO)", () => {
      expect(normalizarDataBoleto("2026-11-13")).toBe("2026-11-13")
      expect(normalizarDataBoleto("2026-11-28T03:00:00.000Z")).toBe("2026-11-28")
    })

    it("deve aceitar ano de 2 dígitos DD/MM/AA", () => {
      expect(normalizarDataBoleto("13/11/26")).toBe("2026-11-13")
      expect(normalizarDataBoleto("28/11/26")).toBe("2026-11-28")
    })

    it("deve aceitar texto por extenso como '13 de novembro de 2026' ou 'Vencimento: 13 nov 2026'", () => {
      expect(normalizarDataBoleto("13 de novembro de 2026")).toBe("2026-11-13")
      expect(normalizarDataBoleto("28 de nov de 2026")).toBe("2026-11-28")
      expect(normalizarDataBoleto("Vencimento: 13/11/2026")).toBe("2026-11-13")
    })
  })

  describe("2. Normalização de Valores em Qualquer Formato", () => {
    it("deve aceitar number puro", () => {
      expect(normalizarValorBoleto(1598.18)).toBe(1598.18)
      expect(normalizarValorBoleto(303.75)).toBe(303.75)
    })

    it("deve aceitar string com R$, ponto e vírgula", () => {
      expect(normalizarValorBoleto("R$ 1.598,18")).toBe(1598.18)
      expect(normalizarValorBoleto("1598,18")).toBe(1598.18)
      expect(normalizarValorBoleto("R$ 303,75")).toBe(303.75)
      expect(normalizarValorBoleto("303.75")).toBe(303.75)
      expect(normalizarValorBoleto("502,00")).toBe(502.0)
    })
  })

  describe("3. Reconciliação Soberana (Caso SICOOB - Vencimento 13/11 e não Julho)", () => {
    it("mantém a data impressa de 13/11/2026 mesmo se o código tiver fator que daria julho", () => {
      const rec = reconciliarBoleto(
        [
          {
            vencimento: "13/11/2026",
            valor: 303.75,
            linhaDigitavel: "75691300780133730000000000000000000000000000000",
          },
        ],
        hoje
      )
      expect(rec.vencimento).toBe("2026-11-13")
      expect(rec.valor).toBe(303.75)
    })
  })

  describe("4. Reconciliação Soberana (Caso Saveiro - Aymoré Financiamentos R$ 1.598,18 em 28/11/2026)", () => {
    it("mantém o valor de R$ 1.598,18 e vencimento 28/11/2026 impressos com precisão", () => {
      const rec = reconciliarBoleto(
        [
          {
            vencimento: "28/11/2026",
            valor: "R$ 1.598,18",
            linhaDigitavel: "03399004099153100000000000000000000000000000000",
          },
        ],
        hoje
      )
      expect(rec.vencimento).toBe("2026-11-28")
      expect(rec.valor).toBe(1598.18)
    })
  })

  describe("5. Cálculo de Parcelas Ancoradas (Aymoré / Saveiro)", () => {
    it("ancora exatamente a parcela seguinte (28ª) na data do boleto (28/11/2026)", () => {
      const totalParcelas = 31
      const jaPagas = 27 // Parcela 28 é a próxima
      const dataProxima = "2026-11-28"

      const datas = datasMensaisAncoradas(dataProxima, totalParcelas, jaPagas)
      expect(datas.length).toBe(31)

      // Parcela 28 (índice 27) DEVE ser exatamente 28/11/2026
      expect(datas[27]).toBe("2026-11-28")

      // Parcela 29 (índice 28) DEVE ser 28/12/2026
      expect(datas[28]).toBe("2026-12-28")

      // Parcela 30 (índice 29) DEVE ser 28/01/2027
      expect(datas[29]).toBe("2027-01-28")

      // Parcela 31 (índice 30) DEVE ser 28/02/2027
      expect(datas[30]).toBe("2027-02-28")

      // E a primeira parcela lá no passado (índice 0)
      expect(datas[0]).toBe("2024-08-28")
    })

    it("desloca meses corretamente sem perder o dia fixo do mês", () => {
      expect(deslocarMeses("2026-11-28", 1)).toBe("2026-12-28")
      expect(deslocarMeses("2026-11-28", 2)).toBe("2027-01-28")
      expect(deslocarMeses("2026-11-28", -1)).toBe("2026-10-28")
      expect(deslocarMeses("2026-11-28", -27)).toBe("2024-08-28")
    })
  })
})
