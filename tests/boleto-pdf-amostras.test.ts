import { describe, it, expect } from "vitest"
import { jsPDF } from "jspdf"
import { extrairDadosBoletoPdf } from "@/lib/boleto-pdf"
import { interpretarBoleto } from "@/lib/boleto"

function criarPdfBoleto(params: {
  banco: string
  linhaDigitavel: string
  beneficiario: string
  cnpjBeneficiario: string
  valor: string
  vencimento: string
  numeroDocumento: string
  pagador: string
  pix?: string
}): Uint8Array {
  const doc = new jsPDF()
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.text(params.banco, 15, 20)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.text(`Linha Digitável: ${params.linhaDigitavel}`, 15, 30)
  doc.text(`Beneficiário: ${params.beneficiario} - CNPJ: ${params.cnpjBeneficiario}`, 15, 40)
  doc.text(`Nº do Documento: ${params.numeroDocumento}`, 15, 50)
  doc.text(`Vencimento: ${params.vencimento}`, 15, 60)
  doc.text(`Valor do Documento: R$ ${params.valor}`, 15, 70)
  doc.text(`Pagador: ${params.pagador}`, 15, 80)
  doc.text("Instruções: Não receber após 30 dias do vencimento. Multa de 2% após vencimento.", 15, 90)

  if (params.pix) {
    doc.text(`PIX Copia e Cola: ${params.pix}`, 15, 100)
  }

  const arrayBuffer = doc.output("arraybuffer")
  return new Uint8Array(arrayBuffer)
}

describe("Extração Digital de Boletos de Fornecedores em PDF", () => {
  it("extrai dados de boleto SICOOB (Lonas & Ferragens) com perfeição", async () => {
    const pdfBytes = criarPdfBoleto({
      banco: "SICOOB - 756",
      linhaDigitavel: "75691.30078 01337.356001 27200.838035 1 21440000030375",
      beneficiario: "DISTRIBUIDORA DE LONAS BRASIL LTDA",
      cnpjBeneficiario: "12.345.678/0001-90",
      valor: "303,75",
      vencimento: "13/11/2026",
      numeroDocumento: "3371302",
      pagador: "TOLDOS PRINT LTDA",
    })

    const extraido = await extrairDadosBoletoPdf(pdfBytes)

    expect(extraido.textoCompleto).toContain("SICOOB")
    expect(extraido.beneficiario).toContain("DISTRIBUIDORA DE LONAS BRASIL LTDA")
    expect(extraido.cnpjCpfBeneficiario).toBe("12.345.678/0001-90")
    expect(extraido.vencimento).toBe("2026-11-13")
    expect(extraido.valor).toBe(303.75)
    expect(extraido.numeroDocumento).toBe("3371302")
    expect(extraido.linhaDigitavel).toBe("75691.30078 01337.356001 27200.838035 1 21440000030375")
  })

  it("extrai dados de boleto BRADESCO (Perfis de Alumínio)", async () => {
    const pdfBytes = criarPdfBoleto({
      banco: "BRADESCO - 237",
      linhaDigitavel: "23793.38128 60083.013528 56006.333308 8 89760000015000",
      beneficiario: "ALUMÍNIOS E TUBOS SUL S/A",
      cnpjBeneficiario: "98.765.432/0001-11",
      valor: "1.598,18",
      vencimento: "28/11/2026",
      numeroDocumento: "NF-89210",
      pagador: "TOLDOS PRINT LTDA",
    })

    const extraido = await extrairDadosBoletoPdf(pdfBytes)

    expect(extraido.vencimento).toBe("2026-11-28")
    expect(extraido.valor).toBe(1598.18)
    expect(extraido.beneficiario).toContain("ALUMÍNIOS E TUBOS SUL S/A")
    expect(extraido.numeroDocumento).toBe("NF-89210")
    expect(extraido.linhaDigitavel).toBe("23793.38128 60083.013528 56006.333308 8 89760000015000")
  })

  it("extrai dados de boleto SANTANDER / AYMORE (Financiamento)", async () => {
    const pdfBytes = criarPdfBoleto({
      banco: "SANTANDER - 033",
      linhaDigitavel: "03399.00409 91531.000000 00000.000000 1 9500000159818",
      beneficiario: "AYMORE FINANCIAMENTOS",
      cnpjBeneficiario: "07.707.650/0001-10",
      valor: "1.598,18",
      vencimento: "28/11/2026",
      numeroDocumento: "0040991531",
      pagador: "KAIO DOS S LOTEIRO",
    })

    const extraido = await extrairDadosBoletoPdf(pdfBytes)

    expect(extraido.vencimento).toBe("2026-11-28")
    expect(extraido.valor).toBe(1598.18)
    expect(extraido.beneficiario).toContain("AYMORE FINANCIAMENTOS")
    expect(extraido.numeroDocumento).toBe("0040991531")
  })

  it("extrai dados de boleto ITAÚ (Tintas e Solventes) com Pix Copia e Cola", async () => {
    const pdfBytes = criarPdfBoleto({
      banco: "ITAÚ - 341",
      linhaDigitavel: "34191.09008 00000.123456 78901.234567 8 98760000045000",
      beneficiario: "TINTAS E QUÍMICOS BRASIL LTDA",
      cnpjBeneficiario: "33.222.111/0001-55",
      valor: "450,00",
      vencimento: "05/12/2026",
      numeroDocumento: "FAT-7744",
      pagador: "TOLDOS PRINT LTDA",
      pix: "00020126580014BR.GOV.BCB.PIX0136123e4567-e89b-12d3-a456-4266141740005204000053039865405450.005802BR5925TINTAS E QUIMICOS BRASIL6009SAO PAULO62070503***6304ABCD",
    })

    const extraido = await extrairDadosBoletoPdf(pdfBytes)

    expect(extraido.vencimento).toBe("2026-12-05")
    expect(extraido.valor).toBe(450)
    expect(extraido.numeroDocumento).toBe("FAT-7744")
    expect(extraido.beneficiario).toContain("TINTAS E QUÍMICOS BRASIL LTDA")
    expect(extraido.pixCopiaECola).toContain("0002012658")
  })

  it("extrai dados de boleto BANCO DO BRASIL (Bobinas de Policarbonato)", async () => {
    const pdfBytes = criarPdfBoleto({
      banco: "BANCO DO BRASIL - 001",
      linhaDigitavel: "00190.00009 01234.567809 12345.678901 1 99990000234050",
      beneficiario: "POLICARBONATOS E CHAPAS DO BRASIL LTDA",
      cnpjBeneficiario: "44.555.666/0001-77",
      valor: "2.340,50",
      vencimento: "15/12/2026",
      numeroDocumento: "DOC-5501",
      pagador: "TOLDOS PRINT LTDA",
    })

    const extraido = await extrairDadosBoletoPdf(pdfBytes)

    expect(extraido.vencimento).toBe("2026-12-15")
    expect(extraido.valor).toBe(2340.5)
    expect(extraido.numeroDocumento).toBe("DOC-5501")
    expect(extraido.beneficiario).toContain("POLICARBONATOS E CHAPAS DO BRASIL LTDA")
  })

  it("extrai dados de boleto SICREDI (Acessórios de Toldos)", async () => {
    const pdfBytes = criarPdfBoleto({
      banco: "SICREDI - 748",
      linhaDigitavel: "74891.12344 56789.012345 67890.123456 1 8900000085000",
      beneficiario: "ACESSORIOS E MANIVELAS SUL LTDA",
      cnpjBeneficiario: "55.666.777/0001-88",
      valor: "85,00",
      vencimento: "22/12/2026",
      numeroDocumento: "FAT-339",
      pagador: "TOLDOS PRINT LTDA",
    })

    const extraido = await extrairDadosBoletoPdf(pdfBytes)

    expect(extraido.vencimento).toBe("2026-12-22")
    expect(extraido.valor).toBe(85)
    expect(extraido.numeroDocumento).toBe("FAT-339")
    expect(extraido.beneficiario).toContain("ACESSORIOS E MANIVELAS SUL LTDA")
  })

  it("extrai conta de concessionária de 48 dígitos (Energia EDP / Água Cesan)", async () => {
    const pdfBytes = criarPdfBoleto({
      banco: "EDP ESPÍRITO SANTO DISTRIBUIÇÃO DE ENERGIA",
      linhaDigitavel: "846700000068 423001090113 004120150106 142010202604",
      beneficiario: "EDP ESPIRITO SANTO",
      cnpjBeneficiario: "28.152.650/0001-71",
      valor: "642,30",
      vencimento: "20/11/2026",
      numeroDocumento: "FAT-990012",
      pagador: "TOLDOS PRINT LTDA",
    })

    const extraido = await extrairDadosBoletoPdf(pdfBytes)

    expect(extraido.vencimento).toBe("2026-11-20")
    expect(extraido.valor).toBe(642.3)
    expect(extraido.beneficiario).toContain("EDP ESPIRITO SANTO")
    expect(extraido.linhaDigitavel).toContain("846700000068")
  })
})
