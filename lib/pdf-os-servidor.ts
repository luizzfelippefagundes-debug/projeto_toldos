import { readFile } from "node:fs/promises"
import path from "node:path"
import { jsPDF } from "jspdf"
import { formatarData, formatarMoeda } from "./format"
import { EMPRESA_ORCAMENTO, gerarLinhasOrcamento } from "./orcamento-pdf"
import { calcularOrcamentoSalvo } from "./orcamento-itens"
import { materiaisSeed, servicosSeed, acabamentosSeed } from "./seed-data"
import { getSql } from "./db"
import type { Acabamento, Material, Orcamento, Servico } from "./types"

async function imagemBase64(caminhoPublico: string): Promise<string | null> {
  try {
    const arquivo = await readFile(path.join(process.cwd(), "public", caminhoPublico))
    const ext = caminhoPublico.endsWith(".png") ? "PNG" : "JPEG"
    const mime = ext === "PNG" ? "image/png" : "image/jpeg"
    return `data:${mime};base64,${arquivo.toString("base64")}`
  } catch {
    return null
  }
}

async function buscarAcabamentosDb(): Promise<Acabamento[]> {
  try {
    const sql = getSql()
    const rows = await sql`SELECT id, nome, preco_unitario as "precoUnitario", unidade FROM acabamentos ORDER BY nome`
    if (rows.length === 0) return acabamentosSeed
    return rows.map((r) => ({
      id: r.id as string,
      nome: r.nome as string,
      precoUnitario: Number(r.precoUnitario),
      unidade: r.unidade as string,
    }))
  } catch {
    return acabamentosSeed
  }
}

async function buscarMateriaisDb(): Promise<Material[]> {
  try {
    const sql = getSql()
    const rows = await sql`SELECT id, nome, tipo, preco_unitario as "precoUnitario", unidade, estoque_minimo as "estoqueMinimo", quantidade_estoque as "quantidadeEstoque" FROM materiais ORDER BY nome`
    if (rows.length === 0) return materiaisSeed
    return rows.map((r) => ({
      id: r.id as string,
      nome: r.nome as string,
      tipo: r.tipo as any,
      precoUnitario: Number(r.precoUnitario),
      unidade: r.unidade as any,
      estoqueMinimo: Number(r.estoqueMinimo || 0),
      quantidadeEstoque: Number(r.quantidadeEstoque || 0),
    }))
  } catch {
    return materiaisSeed
  }
}

async function buscarServicosDb(): Promise<Servico[]> {
  try {
    const sql = getSql()
    const rows = await sql`SELECT id, nome, forma_cobranca as "formaCobranca", valor, ferramentas FROM servicos ORDER BY nome`
    if (rows.length === 0) return servicosSeed
    return rows.map((r) => ({
      id: r.id as string,
      nome: r.nome as string,
      formaCobranca: (r.formaCobranca as any) || "hora",
      valor: Number(r.valor || 0),
      ferramentas: r.ferramentas as string,
    }))
  } catch {
    return servicosSeed
  }
}

export async function gerarPdfOsServidor(
  orcamento: Orcamento,
  clienteNome: string,
  clienteTelefone?: string,
  assinaturaClienteBase64?: string
): Promise<Buffer> {
  const [acabamentosDb, materiaisDb, servicosDb] = await Promise.all([
    buscarAcabamentosDb(),
    buscarMateriaisDb(),
    buscarServicosDb(),
  ])

  const numero = String(orcamento.numero).padStart(4, "0")
  const totalFinal = orcamento.totalFechado ?? 0
  const hoje = new Date()

  const material = materiaisDb.find((m) => m.id === orcamento.item.materialId)
  const nomeMaterial = orcamento.materialFechado?.nome ?? material?.nome ?? "Material"
  const unidadeMaterial = orcamento.materialFechado?.unidade ?? material?.unidade ?? "un"

  const resultado = calcularOrcamentoSalvo(orcamento, materiaisDb, servicosDb)

  const adicionaisParaPdf = (orcamento.item.itensAdicionais ?? []).map((extra) => {
    const materialExtra = materiaisDb.find((m) => m.id === extra.materialId)
    return {
      item: extra,
      nomeMaterial: extra.materialFechado?.nome ?? materialExtra?.nome ?? "Material",
      unidadeMaterial: (extra.materialFechado?.unidade ?? materialExtra?.unidade ?? "un") as any,
    }
  })

  const linhas = resultado
    ? gerarLinhasOrcamento({
        item: orcamento.item,
        nomeMaterial,
        unidadeMaterial: unidadeMaterial as any,
        acabamentosDisponiveis: acabamentosDb,
        resultado,
        total: totalFinal,
        adicionais: adicionaisParaPdf,
      })
    : []

  if (linhas.length === 0) {
    linhas.push({
      nome: nomeMaterial,
      quantidade: orcamento.item.quantidadeUnidades || 1,
      unidade: unidadeMaterial === "m2" ? "m²" : "un",
      valorUnitario: totalFinal,
      valorTotal: totalFinal,
    })
  }

  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const esq = 42
  const dir = 553
  let y = 40

  const [logo, assinatura] = await Promise.all([
    imagemBase64("brand/logo-orcamento.png"),
    imagemBase64("brand/assinatura-kaio.png"),
  ])

  // Cabeçalho
  if (logo) doc.addImage(logo, "PNG", esq, y, 108, 60)

  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(30)
  doc.text("ORDEM DE SERVIÇO", dir, y + 14, { align: "right" })
  doc.setFont("helvetica", "normal").setFontSize(12).setTextColor(80)
  doc.text(`Nº ${numero}`, dir, y + 32, { align: "right" })
  doc.setFontSize(9).setTextColor(120)
  doc.text(`Emitida em ${formatarData(hoje.toISOString())}`, dir, y + 46, { align: "right" })

  y += 72
  doc.setDrawColor(30).setLineWidth(1.5).line(esq, y, dir, y)

  // Dados do cliente
  y += 18
  doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(120)
  doc.text("DADOS DO CLIENTE", esq, y)

  y += 14
  doc.setFillColor(248, 249, 250)
  doc.roundedRect(esq, y - 10, dir - esq, clienteTelefone ? 42 : 30, 4, 4, "F")
  doc.setDrawColor(220).setLineWidth(0.5)
  doc.roundedRect(esq, y - 10, dir - esq, clienteTelefone ? 42 : 30, 4, 4, "S")

  doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(80)
  doc.text("Nome:", esq + 8, y + 2)
  doc.setFont("helvetica", "bold").setTextColor(0)
  doc.text(clienteNome, esq + 42, y + 2)

  doc.setFont("helvetica", "normal").setTextColor(80)
  doc.text(`Orçamento criado em:`, esq + 8, y + 16)
  doc.setFont("helvetica", "bold").setTextColor(0)
  doc.text(formatarData(orcamento.criadoEm), esq + 110, y + 16)

  if (clienteTelefone) {
    doc.setFont("helvetica", "normal").setTextColor(80)
    doc.text("Telefone:", esq + 8, y + 30)
    doc.setFont("helvetica", "bold").setTextColor(0)
    doc.text(clienteTelefone, esq + 50, y + 30)
  }

  y += (clienteTelefone ? 42 : 30) + 16

  // Descrição do serviço
  doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(120)
  doc.text("DESCRIÇÃO DO SERVIÇO", esq, y)
  y += 10

  // Cabeçalho da tabela
  doc.setFillColor(31, 41, 55)
  doc.rect(esq, y, dir - esq, 20, "F")
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(255)
  doc.text("Item / Descrição", esq + 8, y + 13)
  doc.text("Qtd", dir - 150, y + 13, { align: "right" })
  doc.text("Vl. Unit.", dir - 80, y + 13, { align: "right" })
  doc.text("Vl. Total", dir - 8, y + 13, { align: "right" })
  y += 20

  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(0)
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i]
    const bg = i % 2 === 0 ? [255, 255, 255] : [249, 250, 251]
    doc.setFillColor(bg[0], bg[1], bg[2])
    doc.rect(esq, y, dir - esq, 18, "F")
    doc.setDrawColor(229).setLineWidth(0.4).line(esq, y + 18, dir, y + 18)
    doc.setTextColor(30)
    doc.text(l.nome, esq + 8, y + 12, { maxWidth: dir - esq - 210 })
    doc.setTextColor(80)
    doc.text(`${l.quantidade} ${l.unidade}`, dir - 150, y + 12, { align: "right" })
    doc.text(formatarMoeda(l.valorUnitario), dir - 80, y + 12, { align: "right" })
    doc.setFont("helvetica", "bold").setTextColor(0)
    doc.text(formatarMoeda(l.valorTotal), dir - 8, y + 12, { align: "right" })
    doc.setFont("helvetica", "normal")
    y += 18
  }

  // Rodapé da tabela com total
  doc.setFillColor(31, 41, 55)
  doc.rect(esq, y, dir - esq, 24, "F")
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(255)
  doc.text("TOTAL", esq + 8, y + 16)
  doc.text(formatarMoeda(totalFinal), dir - 8, y + 16, { align: "right" })
  y += 24

  // Assinaturas
  y += 50
  const meioEsq = esq + (dir - esq) / 4
  const meioDir = esq + (3 * (dir - esq)) / 4

  // Assinatura do Kaio já inserida no lado da empresa
  if (assinatura) {
    doc.addImage(assinatura, "PNG", meioDir - 33, y - 28, 66, 25)
  }

  // Assinatura do cliente (se fornecida)
  if (assinaturaClienteBase64) {
    try {
      doc.addImage(assinaturaClienteBase64, "PNG", meioEsq - 33, y - 28, 66, 25)
    } catch {
      // Ignora erro de imagem inválida
    }
  }

  doc.setDrawColor(80).setLineWidth(1)
  doc.line(meioEsq - 65, y, meioEsq + 65, y)
  doc.line(meioDir - 65, y, meioDir + 65, y)

  y += 10
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(100)
  doc.text("Assinatura do cliente", meioEsq, y, { align: "center" })
  doc.text("Responsável pela empresa", meioDir, y, { align: "center" })

  y += 11
  doc.setTextColor(140)
  doc.text(clienteNome, meioEsq, y, { align: "center" })
  doc.text(EMPRESA_ORCAMENTO.nome, meioDir, y, { align: "center" })

  // Garantia
  y += 18
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(80)
  doc.text("Garantia:", esq, y)
  doc.setFont("helvetica", "normal").setTextColor(100)
  doc.text(
    "Este serviço possui garantia de 3 (três) meses contra defeitos de fabricação, contados a partir da data de entrega.",
    esq + 42,
    y,
    { maxWidth: dir - esq - 42 }
  )

  // Rodapé
  y += 22
  doc.setDrawColor(200).setLineWidth(0.5).line(esq, y, dir, y)
  y += 12
  doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(60)
  doc.text(`${EMPRESA_ORCAMENTO.nome} · Toldos e Comunicação Visual`, (esq + dir) / 2, y, { align: "center" })
  y += 11
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(130)
  doc.text(`${EMPRESA_ORCAMENTO.contato}  ·  @toldosprint`, (esq + dir) / 2, y, { align: "center" })
  y += 10
  doc.text(`Documento gerado em ${formatarData(hoje.toISOString())}`, (esq + dir) / 2, y, { align: "center" })

  return Buffer.from(doc.output("arraybuffer"))
}

