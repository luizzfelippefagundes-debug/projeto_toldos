import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import { valorPorExtenso } from "@/lib/extenso"

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const {
      comissao_ids,
      colaborador_id,
      colaborador_nome,
      forma_pagamento = "pix",
      tipo_assinatura = "fisica",
      assinatura_digital = null,
      criar_lancamento_financeiro = true,
      observacao = "",
      pago_por = "Gestor / Dono",
    } = body

    const sql = getSql()

    // Identificar comissões a serem pagas: ou pelos IDs informados ou pelas comissões pendentes do colaborador
    let idsParaBuscar: string[] = Array.isArray(comissao_ids) ? comissao_ids.filter(Boolean) : []
    if (idsParaBuscar.length === 0 && colaborador_nome) {
      const pendentes = await sql`
        SELECT id FROM comissoes_producao
        WHERE colaborador_nome = ${colaborador_nome} AND status = 'pendente'
      `
      idsParaBuscar = pendentes.map((p: any) => p.id)
    }

    if (idsParaBuscar.length === 0) {
      return NextResponse.json({ error: "Nenhuma comissão pendente encontrada para pagamento" }, { status: 400 })
    }

    // Buscar as comissões pendentes a serem pagas
    const itens = await sql`
      SELECT id, valor_comissao, numero, criado_em, produto_nome, cliente_nome
      FROM comissoes_producao
      WHERE id = ANY(${idsParaBuscar}) AND status = 'pendente'
      ORDER BY criado_em ASC
    `

    if (itens.length === 0) {
      // Se já foram pagas anteriormente e têm recibo, retorna o recibo existente (idempotência)
      const jaPagas = await sql`
        SELECT recibo_id FROM comissoes_producao
        WHERE id = ANY(${idsParaBuscar}) AND status = 'pago' AND recibo_id IS NOT NULL
        LIMIT 1
      `
      if (jaPagas.length > 0 && jaPagas[0].recibo_id) {
        const rec = await sql`SELECT numero_recibo, valor_total FROM recibos_comissao WHERE id = ${jaPagas[0].recibo_id}`
        return NextResponse.json({
          ok: true,
          reciboId: jaPagas[0].recibo_id,
          numeroRecibo: rec[0]?.numero_recibo || "",
          totalPago: Number(rec[0]?.valor_total) || 0,
          jaEstavaPago: true,
        })
      }
      return NextResponse.json({ error: "Nenhuma comissão pendente encontrada" }, { status: 400 })
    }

    const idsValidos = itens.map((i: any) => i.id)
    const totalPago = itens.reduce((acc: number, curr: any) => acc + (Number(curr.valor_comissao) || 0), 0)

    // Período de apuração do lote
    const agora = new Date()
    const periodoInicio = itens[0]?.criado_em ? new Date(itens[0].criado_em).toISOString() : agora.toISOString()
    const periodoFim = itens[itens.length - 1]?.criado_em ? new Date(itens[itens.length - 1].criado_em).toISOString() : agora.toISOString()

    // Gerar identificador e número sequencial amigável do recibo (à prova de colisões)
    const ano = agora.getFullYear()
    const reciboId = `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`

    // Buscar maior numeração já existente do ano corrente
    const prefixo = `REC-${ano}-`
    const recibosDoAno = await sql`
      SELECT numero_recibo FROM recibos_comissao
      WHERE numero_recibo LIKE ${prefixo + '%'}
      ORDER BY id DESC
      LIMIT 100
    `
    let maxSeq = 0
    for (const r of recibosDoAno) {
      const match = (r.numero_recibo || "").match(/REC-\d{4}-(\d+)/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (!isNaN(num) && num > maxSeq) maxSeq = num
      }
    }
    const sequencia = maxSeq + 1
    const numeroRecibo = `REC-${ano}-${String(sequencia).padStart(4, "0")}`

    const extenso = valorPorExtenso(totalPago)

    // Inserir registro oficial do Recibo
    await sql`
      INSERT INTO recibos_comissao (
        id,
        numero_recibo,
        colaborador_id,
        colaborador_nome,
        periodo_inicio,
        periodo_fim,
        valor_total,
        valor_extenso,
        forma_pagamento,
        tipo_assinatura,
        assinatura_digital,
        assinado_em,
        observacoes,
        pago_por,
        criado_em
      ) VALUES (
        ${reciboId},
        ${numeroRecibo},
        ${colaborador_id || null},
        ${colaborador_nome || "Colaborador"},
        ${periodoInicio},
        ${periodoFim},
        ${totalPago},
        ${extenso},
        ${forma_pagamento},
        ${tipo_assinatura},
        ${assinatura_digital || null},
        ${assinatura_digital ? agora.toISOString() : null},
        ${observacao || null},
        ${pago_por},
        ${agora.toISOString()}
      )
    `

    // Atualizar as comissões individuais com status 'pago' e vincular ao recibo gerado
    await sql`
      UPDATE comissoes_producao
      SET status = 'pago',
          pago_em = ${agora.toISOString()},
          pago_por = ${pago_por},
          recibo_id = ${reciboId}
      WHERE id = ANY(${idsValidos})
    `

    // Lançamento opcional no Financeiro da empresa (com try/catch isolado para não falhar a emissão do recibo)
    let lancamentoId: string | null = null
    if (criar_lancamento_financeiro && totalPago > 0) {
      try {
        lancamentoId = `fin-com-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
        const hoje = agora.toISOString().slice(0, 10)
        const desc = `Comissão Produção ${numeroRecibo} — ${colaborador_nome || "Colaborador"} (${itens.length} peças)`

        const rotuloFormaPagamento =
          forma_pagamento === "pix" ? "Pix" :
          forma_pagamento === "dinheiro" ? "Dinheiro" :
          forma_pagamento === "deposito" ? "Boleto/Depósito" : "Outro"

        await sql`
          INSERT INTO lancamentos_financeiros (
            id,
            tipo,
            descricao,
            valor,
            categoria,
            vencimento,
            status,
            pago_em,
            origem,
            origem_id,
            forma_pagamento,
            pessoal,
            despesa_fixa,
            observacoes,
            criado_em
          ) VALUES (
            ${lancamentoId},
            'despesa',
            ${desc},
            ${totalPago},
            'Comissão / RH',
            ${hoje},
            'pago',
            ${hoje},
            'manual',
            ${reciboId},
            ${rotuloFormaPagamento},
            false,
            false,
            ${observacao || `Recibo ${numeroRecibo} para ${colaborador_nome}`},
            ${agora.toISOString()}
          )
        `
      } catch (finError) {
        console.error("Aviso: falha ao espelhar despesa de comissão no financeiro:", finError)
      }
    }

    return NextResponse.json({
      ok: true,
      reciboId,
      numeroRecibo,
      totalPago,
      quantidadePaga: idsValidos.length,
      lancamentoId,
    })
  } catch (error: any) {
    console.error("Erro ao pagar comissões e gerar recibo:", error)
    const mensagemErro = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: mensagemErro || "Erro ao processar pagamento e gerar recibo" }, { status: 500 })
  }
}
