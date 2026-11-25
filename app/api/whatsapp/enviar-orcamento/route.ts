import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import { enviarDocumentoWhatsapp } from "@/lib/evolution-api"
import { gerarPdfOrcamentoServidor } from "@/lib/pdf-orcamento-servidor"
import { formatarNumeroOrcamento } from "@/lib/orcamento-pdf"
import { registrarMensagemBot } from "@/lib/bot-registro"
import type { Orcamento } from "@/lib/types"

export async function POST(req: Request) {
  try {
    const { orcamentoId, telefone, mensagem } = await req.json()
    if (!orcamentoId) {
      return NextResponse.json({ erro: "orcamentoId obrigatório" }, { status: 400 })
    }

    const sql = getSql()
    const rows = await sql`SELECT * FROM orcamentos WHERE id = ${orcamentoId} LIMIT 1`
    if (rows.length === 0) {
      return NextResponse.json({ erro: "Orçamento não encontrado" }, { status: 404 })
    }

    const r = rows[0]
    const orcamento: Orcamento = {
      id: r.id,
      numero: r.numero,
      clienteId: r.cliente_id,
      item: r.item,
      materialFechado: r.material_fechado,
      servicoFechado: r.servico_fechado,
      totalFechado: r.total_fechado ? Number(r.total_fechado) : undefined,
      ajusteManual: Number(r.ajuste_manual ?? 0),
      anexoNome: r.anexo_nome,
      status: r.status,
      criadoEm: r.criado_em,
      fechadoEm: r.fechado_em,
      validadeDias: r.validade_dias ?? undefined,
    }

    const clienteRows = await sql`SELECT nome, telefone FROM clientes WHERE id = ${r.cliente_id} LIMIT 1`
    const clienteNome = (clienteRows[0]?.nome as string) ?? "Cliente"
    const destinoTelefone = telefone || (clienteRows[0]?.telefone as string)

    if (!destinoTelefone) {
      return NextResponse.json({ erro: "Telefone do destinatário não informado" }, { status: 400 })
    }

    const numeroFormatado = formatarNumeroOrcamento(orcamento.numero, orcamento.criadoEm)
    const nomeArquivo = `Orcamento-${numeroFormatado}.pdf`
    const pdfBuffer = await gerarPdfOrcamentoServidor(orcamento, clienteNome)

    const legenda =
      mensagem ||
      `📄 Segue em anexo o seu Orçamento nº ${numeroFormatado} da Toldos Print!\n\n💳 *Chave Pix (CNPJ):* 63.177.134/0001-00\nFavorecido: Luis Carlos Loterio (Toldos Print & Comunicação Visual)\n\nQualquer dúvida estamos à disposição.`

    const envio = await enviarDocumentoWhatsapp(
      destinoTelefone,
      pdfBuffer.toString("base64"),
      nomeArquivo,
      legenda
    )

    if (!envio.ok) {
      throw new Error(envio.erro || "Falha ao enviar documento PDF do orçamento pelo WhatsApp")
    }

    await registrarMensagemBot({
      clienteId: r.cliente_id ?? null,
      clienteNome,
      telefone: destinoTelefone,
      texto: `📄 Orçamento em PDF enviado ao cliente: ${nomeArquivo}`,
      origem: "automatica",
      autor: "bot",
    })

    return NextResponse.json({
      ok: true,
      enviadoPara: destinoTelefone,
      cliente: clienteNome,
      nomeArquivo,
    })
  } catch (err: any) {
    console.error("[enviar-orcamento] erro:", err)
    return NextResponse.json({ erro: err?.message || String(err) }, { status: 500 })
  }
}
