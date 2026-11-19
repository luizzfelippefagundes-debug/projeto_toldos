import { readFile } from "node:fs/promises"
import path from "node:path"
import { jsPDF } from "jspdf"
import { formatarData, formatarMoeda } from "./format"
import { valorPorExtenso } from "./extenso"
import { EMPRESA_ORCAMENTO } from "./orcamento-pdf"

export interface DadosReciboServidor {
  numero: string
  clienteNome: string
  valor: number
  referente: string
  formaPagamento?: string
  pagoEm: string
  resumo?: {
    totalOrcamento: number
    totalPago: number
    saldo: number
    vencimentoSaldo?: string
  }
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]

function dataPorExtenso(data: Date) {
  return `${data.getDate()} de ${MESES[data.getMonth()]} de ${data.getFullYear()}`
}

async function imagemBase64(caminhoPublico: string): Promise<string | null> {
  try {
    const arquivo = await readFile(path.join(process.cwd(), "public", caminhoPublico))
    return `data:image/png;base64,${arquivo.toString("base64")}`
  } catch {
    return null
  }
}

export async function gerarPdfReciboServidor(
  dados: DadosReciboServidor,
  dataEmissao: Date = new Date()
): Promise<Buffer> {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const esquerda = 42
  const direita = 553
  const larguraTotal = direita - esquerda
  let y = 40

  const [logo, assinatura] = await Promise.all([
    imagemBase64("brand/logo-orcamento.png"),
    imagemBase64("brand/assinatura-kaio.png"),
  ])

  // 1. Cabeçalho
  if (logo) {
    try {
      doc.addImage(logo, "PNG", esquerda, y, 108, 60)
    } catch {
      // continua sem imagem se falhar
    }
  }

  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(0)
  doc.text(EMPRESA_ORCAMENTO.nome, esquerda + 122, y + 16)
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(60)
  doc.text(EMPRESA_ORCAMENTO.cnpj, esquerda + 122, y + 30)
  EMPRESA_ORCAMENTO.endereco.forEach((linha, i) =>
    doc.text(linha, esquerda + 122, y + 42 + i * 11)
  )
  doc.text(EMPRESA_ORCAMENTO.email, direita, y + 10, { align: "right" })
  doc.text(`Contato: ${EMPRESA_ORCAMENTO.contato}`, direita, y + 22, { align: "right" })

  y += 75
  doc.setDrawColor(217, 217, 217).line(esquerda, y, direita, y)

  // 2. Faixa do Título do Recibo
  y += 18
  doc.setFillColor(138, 138, 138)
  doc.rect(esquerda, y, larguraTotal, 22, "F")
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(255, 255, 255)
  doc.text(`RECIBO Nº ${dados.numero}`, (esquerda + direita) / 2, y + 15, { align: "center" })

  // 3. Quadro de Valor Recebido
  y += 36
  doc.setDrawColor(217, 217, 217)
  doc.setFillColor(250, 250, 250)
  doc.rect(esquerda, y, larguraTotal, 42, "FD")
  doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(100)
  doc.text("Valor recebido:", esquerda + 16, y + 26)
  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(0)
  doc.text(formatarMoeda(dados.valor), direita - 16, y + 27, { align: "right" })

  // 4. Parágrafo Principal do Recibo
  y += 60
  doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(20)
  const textoCorpo =
    `Recebemos de ${dados.clienteNome} a quantia de ${formatarMoeda(dados.valor)} ` +
    `(${valorPorExtenso(dados.valor)}), referente a ${dados.referente}` +
    `${dados.formaPagamento ? `, pago via ${dados.formaPagamento}` : ""}, ` +
    `em ${formatarData(dados.pagoEm)}.`

  const linhasCorpo = doc.splitTextToSize(textoCorpo, larguraTotal)
  doc.text(linhasCorpo, esquerda, y, { lineHeightFactor: 1.5 })
  y += linhasCorpo.length * 17

  // 5. Resumo da Situação do Pagamento (se houver)
  if (dados.resumo) {
    y += 16
    doc.setDrawColor(217, 217, 217).line(esquerda, y, direita, y)
    y += 18
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(100)
    doc.text("Situação do pagamento", esquerda, y)

    y += 18
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(50)
    doc.text("Valor do orçamento:", esquerda + 4, y)
    doc.text(formatarMoeda(dados.resumo.totalOrcamento), direita - 4, y, { align: "right" })

    y += 16
    doc.text("Total pago até agora:", esquerda + 4, y)
    doc.text(formatarMoeda(dados.resumo.totalPago), direita - 4, y, { align: "right" })

    y += 16
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(0)
    if (dados.resumo.saldo > 0) {
      doc.text("Saldo restante:", esquerda + 4, y)
      doc.text(formatarMoeda(dados.resumo.saldo), direita - 4, y, { align: "right" })
      if (dados.resumo.vencimentoSaldo) {
        y += 14
        doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(100)
        doc.text(`Saldo com vencimento em ${formatarData(dados.resumo.vencimentoSaldo)}.`, esquerda + 4, y)
      }
    } else {
      doc.text("Situação:", esquerda + 4, y)
      doc.text("Orçamento Quitado", direita - 4, y, { align: "right" })
    }
  }

  // 6. Data por extenso
  y += 40
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(60)
  doc.text(`Águia Branca/ES, ${dataPorExtenso(dataEmissao)}.`, esquerda, y)

  // 7. Bloco de Assinatura
  y += 50
  const centroX = (esquerda + direita) / 2
  if (assinatura) {
    try {
      doc.addImage(assinatura, "PNG", centroX - 60, y - 28, 120, 30)
    } catch {
      // segue sem imagem se falhar
    }
  }

  doc.setDrawColor(160, 160, 160).line(centroX - 90, y + 4, centroX + 90, y + 4)
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(0)
  doc.text(EMPRESA_ORCAMENTO.nome, centroX, y + 16, { align: "center" })
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(80)
  doc.text(EMPRESA_ORCAMENTO.contato, centroX, y + 27, { align: "center" })

  return Buffer.from(doc.output("arraybuffer"))
}
