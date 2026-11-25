import { readFile } from "node:fs/promises"
import path from "node:path"
import { jsPDF } from "jspdf"
import { formatarData, formatarMoeda } from "./format"
import { formatarNumeroOrcamento, EMPRESA_ORCAMENTO } from "./orcamento-pdf"
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

function formatarDataExtenso(dataIso: string | Date): string {
  const data = typeof dataIso === "string" ? new Date(dataIso) : dataIso
  const meses = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ]
  const dia = data.getDate()
  const mes = meses[data.getMonth()]
  const ano = data.getFullYear()
  return `${dia} de ${mes} de ${ano}`
}

export async function gerarPdfContratoServidor(
  orcamento: Orcamento,
  clienteNome: string,
  clienteTelefone?: string,
  clienteCpf?: string,
  clienteEmail?: string,
  assinaturaClienteBase64?: string,
  dataAssinatura?: string
): Promise<Buffer> {
  const [acabamentosDb, materiaisDb, servicosDb] = await Promise.all([
    buscarAcabamentosDb(),
    buscarMateriaisDb(),
    buscarServicosDb(),
  ])

  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const esq = 40
  const dir = 555
  const larguraUtil = dir - esq
  let y = 35

  const [logo, assinaturaKaio] = await Promise.all([
    imagemBase64("brand/logo-orcamento.png"),
    imagemBase64("brand/assinatura-kaio.png"),
  ])

  const numeroFormatado = formatarNumeroOrcamento(orcamento.numero, orcamento.criadoEm)
  const dataRef = orcamento.fechadoEm || orcamento.criadoEm || new Date().toISOString()
  const dataExtenso = formatarDataExtenso(dataRef)

  const resultado = calcularOrcamentoSalvo(orcamento, materiaisDb, servicosDb)
  const totalFinal = orcamento.totalFechado ?? resultado?.total ?? 0
  const valorMateriais = resultado?.subtotalMaterial ?? totalFinal * 0.55
  const valorMaoDeObra = (resultado?.subtotalMaoDeObra ?? 0) + (resultado?.subtotalInstalacao ?? 0) || (totalFinal - valorMateriais)
  const valorEntrada = totalFinal * 0.5
  const valorSaldo = totalFinal * 0.5

  const material = materiaisDb.find((m) => m.id === orcamento.item.materialId)
  const nomeMaterial = orcamento.materialFechado?.nome ?? material?.nome ?? "Material sob especificação"

  // Cabeçalho Oficial
  if (logo) {
    doc.addImage(logo, "PNG", esq, y, 105, 50)
  }

  doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(15, 23, 42)
  doc.text("CONTRATO DE PRESTAÇÃO DE SERVIÇOS", dir, y + 16, { align: "right" })

  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(71, 85, 105)
  doc.text(`Contrato nº CTR-${numeroFormatado}   •   Orçamento nº ${numeroFormatado}`, dir, y + 30, { align: "right" })
  doc.text(`Data de Emissão: ${formatarData(dataRef)}`, dir, y + 42, { align: "right" })

  y += 58
  doc.setDrawColor(15, 23, 42).setLineWidth(1.5).line(esq, y, dir, y)
  y += 14

  // Função auxiliar para quebra de página inteligente
  function checarQuebraPagina(alturaEstimada: number) {
    if (y + alturaEstimada > 800) {
      doc.addPage()
      y = 40
      // Mini cabeçalho em páginas seguintes
      doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(140)
      doc.text(`TOLDOS PRINT & COMUNICAÇÃO VISUAL — Contrato CTR-${numeroFormatado}`, esq, y)
      doc.text(`Página ${doc.getNumberOfPages()}`, dir, y, { align: "right" })
      y += 12
      doc.setDrawColor(200).setLineWidth(0.5).line(esq, y, dir, y)
      y += 15
    }
  }

  function tituloClausula(num: string, titulo: string) {
    checarQuebraPagina(35)
    doc.setFillColor(241, 245, 249)
    doc.rect(esq, y, larguraUtil, 15, "F")
    doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(15, 23, 42)
    doc.text(`${num}. ${titulo.toUpperCase()}`, esq + 6, y + 11)
    y += 20
  }

  // 1. Identificação das Partes
  tituloClausula("1", "Identificação das Partes")
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(30)
  const textoContratada = `CONTRATADA: TOLDOS PRINT & COMUNICAÇÃO VISUAL LTDA, nome fantasia TOLDOSPRINT, CNPJ: 63.177.134/0001-00, com sede na Av. João Quiuqui, Centro, Águia Branca – ES, CEP 29795-000, representada por Kaio (Administrador). Contatos: (27) 99748-9714 / (27) 99612-5835.`
  const linhasContratada = doc.splitTextToSize(textoContratada, larguraUtil - 8)
  checarQuebraPagina(linhasContratada.length * 10 + 20)
  doc.text(linhasContratada, esq + 4, y)
  y += linhasContratada.length * 10 + 4

  const textoContratante = `CONTRATANTE: ${clienteNome}${clienteCpf ? `, CPF/CNPJ: ${clienteCpf}` : ""}${clienteTelefone ? `, Telefone: ${clienteTelefone}` : ""}${clienteEmail ? `, E-mail: ${clienteEmail}` : ""}.`
  const linhasContratante = doc.splitTextToSize(textoContratante, larguraUtil - 8)
  doc.text(linhasContratante, esq + 4, y)
  y += linhasContratante.length * 10 + 10

  // 2. Serviço Contratado
  tituloClausula("2", "Serviço Contratado")
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(30)
  const itensDesc = [
    `Serviço e etapas: Arte, fabricação especializada, fornecimento e ${orcamento.item.instalacao?.incluida ? "instalação no local" : "entrega conforme discriminado"}.`,
    `Item Principal: ${nomeMaterial} — ${orcamento.item.largura.toFixed(2)}m x ${orcamento.item.altura.toFixed(2)}m (Qtd: ${orcamento.item.quantidadeUnidades} un, Área: ${(orcamento.item.largura * orcamento.item.altura * orcamento.item.quantidadeUnidades).toFixed(2)} m²).`,
    `Local de entrega/instalação: No endereço do cliente ou obra indicada. Itens fora do orçamento: Nenhum, salvo ajuste prévio por escrito.`,
    `O orçamento nº ${numeroFormatado} e a arte/projeto aprovado integram este contrato para todos os efeitos de direito.`
  ]
  for (const item of itensDesc) {
    const l = doc.splitTextToSize(item, larguraUtil - 8)
    checarQuebraPagina(l.length * 10 + 4)
    doc.text(l, esq + 4, y)
    y += l.length * 10 + 2
  }
  y += 6

  // 3. Valor e Pagamento
  tituloClausula("3", "Valor e Pagamento")
  checarQuebraPagina(40)
  doc.setFillColor(248, 250, 252)
  doc.rect(esq, y, larguraUtil, 22, "F")
  doc.setDrawColor(226, 232, 240).setLineWidth(0.5).rect(esq, y, larguraUtil, 22, "S")
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(50)
  doc.text(`Materiais: ${formatarMoeda(valorMateriais)}`, esq + 8, y + 14)
  doc.text(`Mão de Obra/Serviços: ${formatarMoeda(valorMaoDeObra)}`, esq + 150, y + 14)
  doc.setFontSize(9).setTextColor(15, 23, 42)
  doc.text(`TOTAL DO CONTRATO: ${formatarMoeda(totalFinal)}`, dir - 8, y + 14, { align: "right" })
  y += 28

  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(30)
  const condPag = `Condição sugerida: Entrada de 50% (${formatarMoeda(valorEntrada)}) no ato do fechamento deste contrato e saldo de 50% (${formatarMoeda(valorSaldo)}) na entrega ou conclusão da instalação. Formas aceitas: PIX, Transferência, Boleto Bancário ou Cartão de Crédito.`
  const linhasPag = doc.splitTextToSize(condPag, larguraUtil - 8)
  doc.text(linhasPag, esq + 4, y)
  y += linhasPag.length * 10 + 8

  // 4. Prazo e Condições
  tituloClausula("4", "Prazo e Condições de Execução")
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(30)
  const textoPrazo = `Início previsto: após confirmação da entrada e aprovação da arte. Prazo estimado: 10 a 15 dias úteis. Condições para início: medição no local, aprovação formal da arte e liberação de acesso seguro. A CONTRATADA responde pela fixação; adaptações prévias de alvenaria e energia elétrica ficam a cargo do CONTRATANTE.`
  const linhasPrazo = doc.splitTextToSize(textoPrazo, larguraUtil - 8)
  checarQuebraPagina(linhasPrazo.length * 10 + 10)
  doc.text(linhasPrazo, esq + 4, y)
  y += linhasPrazo.length * 10 + 8

  // 5. Entrega e Conferência
  tituloClausula("5", "Entrega e Conferência")
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(30)
  const textoEntrega = `Na entrega ou conclusão da instalação, as partes conferem o serviço com base no orçamento e registram eventuais pendências e prazos de correção. A conferência não afasta os direitos previstos em lei.`
  const linhasEntrega = doc.splitTextToSize(textoEntrega, larguraUtil - 8)
  doc.text(linhasEntrega, esq + 4, y)
  y += linhasEntrega.length * 10 + 8

  // 6. Garantia e Atendimento
  tituloClausula("6", "Garantia e Atendimento")
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(30)
  const textoGarantia = `Aplicam-se as garantias do CDC (art. 26). A TOLDOSPRINT oferece garantia contratual de 3 (três) meses, contados da entrega ou da conclusão da instalação, cobrindo defeitos de fabricação ou fixação atribuíveis à contratada. Defeitos preexistentes na parede ou estrutura de apoio (trincas, infiltrações ou fragilidade do reboco) ficam fora da cobertura.`
  const linhasGarantia = doc.splitTextToSize(textoGarantia, larguraUtil - 8)
  checarQuebraPagina(linhasGarantia.length * 10 + 10)
  doc.text(linhasGarantia, esq + 4, y)
  y += linhasGarantia.length * 10 + 8

  // 7. Cancelamento
  tituloClausula("7", "Cancelamento e Direito de Arrependimento")
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(30)
  const textoCanc = `O cancelamento deve ser por escrito, apurando-se valores proporcionais aos custos comprovados. Nas contratações fora do estabelecimento, aplica-se o prazo de arrependimento de 7 dias (art. 49 do CDC).`
  const linhasCanc = doc.splitTextToSize(textoCanc, larguraUtil - 8)
  doc.text(linhasCanc, esq + 4, y)
  y += linhasCanc.length * 10 + 12

  // 8. Assinaturas
  checarQuebraPagina(140)
  tituloClausula("8", "Assinaturas e Foro")
  doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(15, 23, 42)
  doc.text(`Águia Branca – ES, ${dataExtenso}.`, (esq + dir) / 2, y, { align: "center" })
  y += 25

  const meioEsq = esq + larguraUtil / 4
  const meioDir = esq + (3 * larguraUtil) / 4

  // Assinatura Kaio
  if (assinaturaKaio) {
    doc.addImage(assinaturaKaio, "PNG", meioEsq - 36, y - 22, 72, 24)
  }

  // Assinatura Cliente
  if (assinaturaClienteBase64) {
    try {
      doc.addImage(assinaturaClienteBase64, "PNG", meioDir - 40, y - 22, 80, 26)
    } catch {
      // Ignora erro de imagem
    }
  }

  doc.setDrawColor(30).setLineWidth(0.8)
  doc.line(meioEsq - 70, y + 6, meioEsq + 70, y + 6)
  doc.line(meioDir - 70, y + 6, meioDir + 70, y + 6)

  y += 16
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(15, 23, 42)
  doc.text("CONTRATADA", meioEsq, y, { align: "center" })
  doc.text("CONTRATANTE", meioDir, y, { align: "center" })

  y += 10
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(71, 85, 105)
  doc.text("TOLDOS PRINT & COMUNICAÇÃO VISUAL", meioEsq, y, { align: "center" })
  doc.text(clienteNome, meioDir, y, { align: "center" })

  y += 9
  doc.text("Kaio (Administrador)", meioEsq, y, { align: "center" })
  doc.text(clienteCpf ? `CPF/CNPJ: ${clienteCpf}` : "Assinatura Digital", meioDir, y, { align: "center" })

  if (dataAssinatura) {
    y += 9
    doc.setFontSize(7).setTextColor(16, 185, 129)
    doc.text(`Assinado digitalmente em ${formatarData(dataAssinatura)}`, meioDir, y, { align: "center" })
  }

  return Buffer.from(doc.output("arraybuffer"))
}
