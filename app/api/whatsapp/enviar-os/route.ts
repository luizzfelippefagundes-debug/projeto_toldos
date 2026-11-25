import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { getSql } from "@/lib/db"
import { enviarDocumentoWhatsapp, enviarMensagemWhatsapp } from "@/lib/evolution-api"
import { gerarPdfOsServidor } from "@/lib/pdf-os-servidor"
import { formatarNumeroOrcamento } from "@/lib/orcamento-pdf"
import { formatarMoeda } from "@/lib/format"
import { gerarPayloadPixEstatico, criarLinkPagamentoMercadoPago } from "@/lib/mercadopago"
import { registrarMensagemBot } from "@/lib/bot-registro"
import { garantirTabelaAssinaturasOs, garantirColunasOrcamentos } from "@/lib/migracoes"
import type { Orcamento } from "@/lib/types"

export async function POST(req: Request) {
  const { orcamentoId, telefone } = await req.json()

  if (!orcamentoId || !telefone) {
    return NextResponse.json({ erro: "orcamentoId e telefone obrigatórios" }, { status: 400 })
  }

  await garantirColunasOrcamentos()
  await garantirTabelaAssinaturasOs()

  const sql = getSql()
  const semPrefixo = orcamentoId.startsWith("orc-") ? orcamentoId.slice(4) : orcamentoId
  const comPrefixo = orcamentoId.startsWith("orc-") ? orcamentoId : `orc-${orcamentoId}`

  const rows = await sql`
    SELECT * FROM orcamentos 
    WHERE id = ${orcamentoId} OR id = ${comPrefixo} OR id = ${semPrefixo} 
    LIMIT 1
  `
  if (rows.length === 0) {
    return NextResponse.json({ erro: "Orçamento não encontrado" }, { status: 404 })
  }

  const r = rows[0]
  const orcamento = {
    id: r.id,
    numero: r.numero,
    clienteId: r.cliente_id,
    item: r.item,
    materialFechado: r.material_fechado,
    servicoFechado: r.servico_fechado,
    totalFechado: r.total_fechado ? Number(r.total_fechado) : undefined,
    ajusteManual: Number(r.ajuste_manual ?? 0),
    anexoNome: r.anexo_nome,
    anexoUrl: r.anexo_url,
    status: r.status,
    criadoEm: r.criado_em,
    fechadoEm: r.fechado_em,
    validadeDias: r.validade_dias ?? undefined,
  } as Orcamento

  const totalFinal = orcamento.totalFechado ?? 0
  const numeroOS = formatarNumeroOrcamento(orcamento.numero, orcamento.criadoEm)

  const clienteRows = await sql`SELECT nome, telefone FROM clientes WHERE id = ${orcamento.clienteId} LIMIT 1`
  const clienteNome = (clienteRows[0]?.nome as string) ?? "Cliente"
  const clienteTelefone = (clienteRows[0]?.telefone as string) ?? undefined

  // 1. Gera PDF da OS no servidor (com QR Code do Pix embutido)
  const pdf = await gerarPdfOsServidor(orcamento, clienteNome, clienteTelefone)
  const nomeArquivo = `OS-${numeroOS}.pdf`

  // 2. Busca ou gera Token de Assinatura Digital
  const assinRows = await sql`SELECT id FROM assinaturas_os WHERE orcamento_id = ${orcamento.id} ORDER BY criado_em DESC LIMIT 1`
  let tokenAssinatura = assinRows[0]?.id as string | undefined
  if (!tokenAssinatura) {
    tokenAssinatura = randomUUID()
    const agora = new Date()
    const expira = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000)
    await sql`
      INSERT INTO assinaturas_os (id, orcamento_id, criado_em, expira_em)
      VALUES (${tokenAssinatura}, ${orcamento.id}, ${agora.toISOString()}, ${expira.toISOString()})
    `
  }
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://sistema.toldosprint.com.br")
  const linkAssinatura = `${baseUrl}/assinar/${tokenAssinatura}`

  // 3. Busca ou gera Link de Pagamento com Cartão no Mercado Pago
  let linkPagamento = (r.link_pagamento as string | null) ?? null
  if (!linkPagamento && totalFinal > 0) {
    try {
      const resMp = await criarLinkPagamentoMercadoPago({
        valor: totalFinal,
        descricao: `Ordem de Serviço #${numeroOS} - Toldos Print`,
        externalReference: `orc-${orcamento.id}`,
        clienteNome,
        clienteTelefone,
      })
      if (resMp.linkPagamento) {
        linkPagamento = resMp.linkPagamento
        await sql`UPDATE orcamentos SET link_pagamento = ${linkPagamento}, mp_preference_id = ${resMp.preferenciaId || null} WHERE id = ${orcamento.id}`
      }
    } catch (e) {
      console.warn("[enviar-os] Falha ao gerar link Mercado Pago antecipado:", e)
    }
  }

  // 4. Gera código Pix estático copia e cola oficial
  const chavePix = "63.177.134/0001-00"
  const chaveNumeros = "63177134000100"
  const pixCopiaCola = totalFinal > 0
    ? gerarPayloadPixEstatico({
        chave: chaveNumeros || chavePix,
        nome: process.env.PIX_NOME_BENEFICIARIO || "TOLDOS PRINT",
        cidade: process.env.PIX_CIDADE_BENEFICIARIO || "COLATINA",
        valor: totalFinal,
        identificador: String(orcamento.numero || "TOLDOS"),
      })
    : ""

  const legenda = `📋 Segue a Ordem de Serviço nº ${numeroOS} da Toldos Print!\n\n💰 *Valor Total:* ${formatarMoeda(totalFinal)}\n\n💳 *Chave Pix (CNPJ):* ${chavePix}\nFavorecido: Toldos Print & Comunicação Visual`

  // 5. Envia o documento PDF
  const envio = await enviarDocumentoWhatsapp(
    telefone,
    pdf.toString("base64"),
    nomeArquivo,
    legenda
  )

  if (!envio.ok) {
    throw new Error(envio.erro || "Falha ao enviar documento PDF da OS pelo WhatsApp")
  }

  // 6. Envia mensagem interativa com opções de pagamento (Pix vs Cartão) e assinatura
  const textoOpcoes =
    `Olá, ${clienteNome.split(" ")[0]}! Segue a sua *Ordem de Serviço nº ${numeroOS}* em anexo. 📄✨\n\n` +
    `💰 *Valor Total:* ${formatarMoeda(totalFinal)}\n\n` +
    `*Qual forma de pagamento você prefere?*\n\n` +
    `1️⃣ *Pix (à vista):*\n` +
    `👉 Chave Pix (CNPJ): *${chavePix}*\n` +
    `👉 Chave para copiar: *${chaveNumeros}*\n` +
    `👤 Favorecido: Toldos Print & Comunicação Visual\n` +
    (pixCopiaCola ? `\n📋 *Pix Copia e Cola:*\n\`\`\`${pixCopiaCola}\`\`\`\n` : "") +
    (linkPagamento ? `\n2️⃣ *Cartão de Crédito (em até 12x):*\n👉 ${linkPagamento}\n` : "") +
    `\n✍️ *Assinatura Digital da OS:*\n👉 ${linkAssinatura}\n\n` +
    `Assim que realizar o pagamento ou assinar, envie por aqui mesmo que já daremos andamento imediato na produção! 🤝✨`

  await enviarMensagemWhatsapp(telefone, textoOpcoes).catch((err) =>
    console.warn("[enviar-os] Falha ao enviar texto de opções de pagamento:", err)
  )

  await registrarMensagemBot({
    clienteId: orcamento.clienteId ?? null,
    clienteNome,
    telefone,
    texto: `📋 Ordem de Serviço em PDF enviada com dados de pagamento (Pix e Cartão): ${nomeArquivo}`,
    origem: "automatica",
    autor: "bot",
  })

  return NextResponse.json({ ok: true, linkPagamento, linkAssinatura })
}
