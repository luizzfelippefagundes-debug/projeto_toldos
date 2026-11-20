import { timingSafeEqual, randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import { garantirColunasOrcamentos } from "@/lib/migracoes"
import { formatarNumeroOrcamento } from "@/lib/orcamento-pdf"
import {
  formatarTelefoneLoja,
  mesmoTelefone,
  montarOrcamentoLoja,
  validarPedidoLoja,
  type MaterialResumo,
} from "@/lib/loja-orcamento"

// Recebe o pedido de orçamento do site da loja e grava como orçamento ABERTO,
// com origem "loja". Só o servidor do site chama esta rota (cabeçalho
// x-loja-secret); o navegador do cliente nunca fala direto com o sistema.
function segredoValido(req: Request) {
  const esperado = process.env.LOJA_API_SECRET
  const recebido = req.headers.get("x-loja-secret")
  if (!esperado || !recebido) return false
  const a = Buffer.from(recebido)
  const b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: Request) {
  if (!process.env.LOJA_API_SECRET) {
    return NextResponse.json({ erro: "Integração da loja não configurada" }, { status: 503 })
  }
  if (!segredoValido(req)) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 })

  const bruto = await req.text()
  if (bruto.length > 30_000) return NextResponse.json({ erro: "Pedido grande demais" }, { status: 413 })
  let json: unknown
  try {
    json = JSON.parse(bruto)
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 })
  }
  const validado = validarPedidoLoja(json)
  if (!validado.ok) return NextResponse.json({ erro: validado.erro }, { status: 400 })
  const { pedido } = validado

  const sql = getSql()
  await garantirColunasOrcamentos()

  // Reenvio do mesmo pedido (cliente clicou duas vezes ou a rede falhou):
  // devolve o orçamento que já existe em vez de criar outro.
  const existente = await sql`
    SELECT numero, criado_em FROM orcamentos
    WHERE origem = 'loja' AND observacao LIKE ${`Pedido pelo site (${pedido.codigo})%`} LIMIT 1
  `
  if (existente.length > 0) {
    return NextResponse.json({
      ok: true,
      repetido: true,
      numero: existente[0].numero,
      numeroFormatado: formatarNumeroOrcamento(Number(existente[0].numero), String(existente[0].criado_em)),
    })
  }

  const clientes = await sql`SELECT id, telefone FROM clientes`
  let clienteId = clientes.find((c) => mesmoTelefone(String(c.telefone ?? ""), pedido.cliente.telefone))?.id as
    | string
    | undefined
  const clienteNovo = !clienteId
  if (!clienteId) {
    clienteId = `cli-${randomUUID().slice(0, 8)}`
    await sql`
      INSERT INTO clientes (id, nome, telefone, email, cpf, origem)
      VALUES (${clienteId}, ${pedido.cliente.nome}, ${formatarTelefoneLoja(pedido.cliente.telefone)}, null, null, 'loja')
    `
  }

  const materiaisRows = await sql`SELECT id, unidade FROM materiais`
  const materiais = new Map<string, MaterialResumo>(
    materiaisRows.map((m) => [String(m.id), { id: String(m.id), unidade: String(m.unidade) }])
  )
  const orc = montarOrcamentoLoja(
    pedido,
    { id: `orc-${randomUUID().slice(0, 8)}`, clienteId, agora: new Date().toISOString() },
    materiais
  )

  const gravado = await sql`
    INSERT INTO orcamentos (
      id, numero, cliente_id, item, ajuste_manual, anexo_nome, status, criado_em,
      fechado_em, validade_dias, observacao, origem
    ) VALUES (
      ${orc.id}, (SELECT COALESCE(MAX(numero), 10000) + 1 FROM orcamentos), ${orc.clienteId},
      ${JSON.stringify(orc.item)}, 0, null, 'aberto', ${orc.criadoEm}, null, ${orc.validadeDias ?? 7},
      ${orc.observacao ?? null}, 'loja'
    )
    RETURNING numero, criado_em
  `
  const numero = Number(gravado[0].numero)
  return NextResponse.json(
    {
      ok: true,
      numero,
      numeroFormatado: formatarNumeroOrcamento(numero, String(gravado[0].criado_em)),
      clienteNovo,
    },
    { status: 201 }
  )
}
