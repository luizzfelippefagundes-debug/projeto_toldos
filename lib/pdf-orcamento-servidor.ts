import { readFile } from "node:fs/promises"
import path from "node:path"
import { jsPDF } from "jspdf"
import { formatarData, formatarMoeda } from "./format"
import { EMPRESA_ORCAMENTO, formatarNumeroOrcamento } from "./orcamento-pdf"
import { textoCondicoesPagamento } from "./parcelas"
import type { Orcamento } from "./types"

// Gera o PDF do orçamento sem precisar de navegador (usado pelo bot do
// WhatsApp, que roda no servidor). Diferente de lib/pdf-orcamento.ts (que
// captura a tela com html2canvas), aqui o layout é desenhado direto com o
// jsPDF a partir dos dados já travados em orcamento.materialFechado /
// totalFechado — só funciona pra orçamento fechado, e não inclui as fotos
// (o PDF da tela continua sendo o oficial/completo).
async function imagemBase64(caminhoPublico: string): Promise<string | null> {
  try {
    const arquivo = await readFile(path.join(process.cwd(), "public", caminhoPublico))
    return `data:image/png;base64,${arquivo.toString("base64")}`
  } catch {
    return null
  }
}

export async function gerarPdfOrcamentoServidor(orcamento: Orcamento, clienteNome: string): Promise<Buffer> {
  const numero = formatarNumeroOrcamento(orcamento.numero, orcamento.criadoEm)
  const total = orcamento.totalFechado ?? 0
  const nomeMaterial = orcamento.materialFechado?.nome ?? "Material"
  const condicoes = orcamento.item.condicoesPagamento?.trim() || textoCondicoesPagamento(orcamento.item.entradaPercent)

  const unidade = orcamento.materialFechado?.unidade
  const medida =
    unidade === "m2" && orcamento.item.largura > 0 && orcamento.item.altura > 0
      ? ` ${orcamento.item.largura.toLocaleString("pt-BR")} x ${orcamento.item.altura.toLocaleString("pt-BR")} m`
      : ""
  const linhas = [
    {
      nome: `${nomeMaterial}${medida}`,
      quantidade: orcamento.item.quantidadeUnidades > 1 ? orcamento.item.quantidadeUnidades : 1,
      unidade: unidade === "m2" ? "m²" : "un",
      valor: total,
    },
    ...(orcamento.item.itensAdicionais ?? []).map((extra) => ({
      nome: extra.materialFechado?.nome ?? "Item adicional",
      quantidade: extra.quantidadeUnidades > 1 ? extra.quantidadeUnidades : 1,
      unidade: "un",
      valor: 0,
    })),
  ]

  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const esquerda = 42
  const direita = 553
  let y = 40

  const [logo, assinatura] = await Promise.all([
    imagemBase64("brand/logo-orcamento.png"),
    imagemBase64("brand/assinatura-kaio.png"),
  ])

  if (logo) doc.addImage(logo, "PNG", esquerda, y, 108, 60)
  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(0)
  doc.text(EMPRESA_ORCAMENTO.nome, esquerda + 122, y + 16)
  doc.setFont("helvetica", "normal").setFontSize(8.5)
  doc.text(EMPRESA_ORCAMENTO.cnpj, esquerda + 122, y + 30)
  EMPRESA_ORCAMENTO.endereco.forEach((linha, i) => doc.text(linha, esquerda + 122, y + 42 + i * 11))
  doc.text(EMPRESA_ORCAMENTO.email, direita, y + 10, { align: "right" })
  doc.text(`Contato: ${EMPRESA_ORCAMENTO.contato}`, direita, y + 22, { align: "right" })

  y += 82
  doc.setDrawColor(217, 217, 217).line(esquerda, y, direita, y)

  y += 20
  doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(0)
  doc.text(clienteNome, esquerda, y)
  doc.text(`Data: ${formatarData(orcamento.criadoEm)}`, direita, y, { align: "right" })

  y += 16
  doc.setFillColor(138, 138, 138)
  doc.rect(esquerda, y, direita - esquerda, 20, "F")
  doc.setFont("helvetica", "normal").setFontSize(13).setTextColor(255, 255, 255)
  doc.text(`ORÇAMENTO Nº ${numero}`, (esquerda + direita) / 2, y + 14, { align: "center" })

  y += 40
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(100)
  doc.text("Serviços", esquerda, y)
  y += 14
  doc.setFillColor(221, 221, 221)
  doc.rect(esquerda, y - 10, direita - esquerda, 14, "F")
  doc.setTextColor(0)
  doc.text("Nome", esquerda + 2, y)
  doc.text("Qtd.", 400, y, { align: "right" })
  doc.text("Unid.", 440, y, { align: "right" })
  doc.text("Valor", direita - 2, y, { align: "right" })

  y += 16
  for (const linha of linhas) {
    doc.text(linha.nome, esquerda + 2, y, { maxWidth: 330 })
    doc.text(String(linha.quantidade), 400, y, { align: "right" })
    doc.text(linha.unidade, 440, y, { align: "right" })
    doc.text(formatarMoeda(linha.valor), direita - 2, y, { align: "right" })
    y += 16
  }

  y += 20
  doc.setFont("helvetica", "bold").setFontSize(10)
  doc.text("Total Orçamento", 440, y, { align: "right" })
  doc.text(formatarMoeda(total), direita, y, { align: "right" })

  y += 32
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(100)
  doc.text("Observações", esquerda, y)
  y += 16
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(0)
  doc.text("Condições de Pagamento:", esquerda, y)
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(68)
  doc.text(condicoes, esquerda + 118, y)

  y += 60
  if (assinatura) doc.addImage(assinatura, "PNG", (esquerda + direita) / 2 - 33, y, 66, 25)
  y += 34
  doc.setDrawColor(153, 153, 153).line((esquerda + direita) / 2 - 65, y, (esquerda + direita) / 2 + 65, y)
  y += 16
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(0)
  doc.text(EMPRESA_ORCAMENTO.nome, (esquerda + direita) / 2, y, { align: "center" })
  doc.setFont("helvetica", "normal")
  doc.text(EMPRESA_ORCAMENTO.contato, (esquerda + direita) / 2, y + 12, { align: "center" })

  return Buffer.from(doc.output("arraybuffer"))
}
