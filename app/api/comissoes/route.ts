import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const statusFiltro = searchParams.get("status") // 'pendente' | 'pago' | 'todos'
    const colaboradorFiltro = searchParams.get("colaborador")
    const inicio = searchParams.get("inicio") // YYYY-MM-DD
    const fim = searchParams.get("fim") // YYYY-MM-DD

    const sql = getSql()

    let rows: any[] = []

    if (statusFiltro && statusFiltro !== "todos" && colaboradorFiltro) {
      rows = await sql`
        SELECT * FROM comissoes_producao
        WHERE status = ${statusFiltro} AND colaborador_nome = ${colaboradorFiltro}
        ORDER BY criado_em DESC
      `
    } else if (statusFiltro && statusFiltro !== "todos") {
      rows = await sql`
        SELECT * FROM comissoes_producao
        WHERE status = ${statusFiltro}
        ORDER BY criado_em DESC
      `
    } else if (colaboradorFiltro) {
      rows = await sql`
        SELECT * FROM comissoes_producao
        WHERE colaborador_nome = ${colaboradorFiltro}
        ORDER BY criado_em DESC
      `
    } else {
      rows = await sql`
        SELECT * FROM comissoes_producao
        ORDER BY criado_em DESC
        LIMIT 500
      `
    }

    // Calcular resumo agrupado por colaborador para a semana / fechamento
    const resumoMap = new Map<string, {
      colaborador_nome: string
      total_pendente: number
      total_pago: number
      quantidade_pecas: number
      quantidade_pendente: number
      comissoes_pendentes_ids: string[]
    }>()

    let totalGeralPendente = 0
    let totalGeralPago = 0

    for (const row of rows) {
      const nome = row.colaborador_nome
      const val = Number(row.valor_comissao) || 0
      const isPendente = row.status === "pendente"

      if (isPendente) {
        totalGeralPendente += val
      } else {
        totalGeralPago += val
      }

      if (!resumoMap.has(nome)) {
        resumoMap.set(nome, {
          colaborador_nome: nome,
          total_pendente: 0,
          total_pago: 0,
          quantidade_pecas: 0,
          quantidade_pendente: 0,
          comissoes_pendentes_ids: [],
        })
      }

      const item = resumoMap.get(nome)!
      item.quantidade_pecas += 1
      if (isPendente) {
        item.total_pendente += val
        item.quantidade_pendente += 1
        item.comissoes_pendentes_ids.push(row.id)
      } else {
        item.total_pago += val
      }
    }

    const resumo = Array.from(resumoMap.values()).sort((a, b) => b.total_pendente - a.total_pendente)

    return NextResponse.json({
      comissoes: rows,
      resumo,
      totalGeralPendente,
      totalGeralPago,
      totalRegistros: rows.length,
    }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("Erro ao listar comissões:", error)
    return NextResponse.json({ error: "Erro interno ao buscar comissões" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      colaboradores, // string[]
      origem_tipo, // 'pedido' | 'orcamento'
      origem_id,
      numero,
      cliente_nome,
      produto_nome,
      valor_pedido,
      comissao_percent,
      valor_comissao,
    } = body

    if (!Array.isArray(colaboradores) || colaboradores.length === 0) {
      return NextResponse.json({ error: "Nenhum colaborador informado" }, { status: 400 })
    }

    const sql = getSql()

    // 1. Verificar elegibilidade dos colaboradores no banco
    const configs = await sql`
      SELECT colaborador_nome, recebe_bonus
      FROM configuracao_bonus_colaboradores
    `
    const mapaInaptos = new Set<string>()
    configs.forEach((c: any) => {
      if (c.recebe_bonus === false) {
        mapaInaptos.add(c.colaborador_nome.toLowerCase().trim())
      }
    })

    // Regra do Kaio / Fábrica: integral para cada um (não dividido) que for elegível
    const registrosCriados: any[] = []

    for (const colabNome of colaboradores) {
      // Se o colaborador foi desmarcado pelo dono nas regras de bônus, pula a geração de comissão
      if (mapaInaptos.has(colabNome.toLowerCase().trim())) {
        continue
      }

      const id = `com-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      await sql`
        INSERT INTO comissoes_producao (
          id,
          colaborador_id,
          colaborador_nome,
          origem_tipo,
          origem_id,
          numero,
          cliente_nome,
          produto_nome,
          valor_pedido,
          comissao_percent,
          valor_comissao,
          status,
          criado_em
        ) VALUES (
          ${id},
          ${colabNome},
          ${colabNome},
          ${origem_tipo || "pedido"},
          ${origem_id || id},
          ${Number(numero) || 0},
          ${cliente_nome || "Cliente"},
          ${produto_nome || "Produção"},
          ${Number(valor_pedido) || 0},
          ${Number(comissao_percent) || 0},
          ${Number(valor_comissao) || 0},
          'pendente',
          NOW()
        )
      `
      registrosCriados.push({ id, colaborador: colabNome, valor: valor_comissao })
    }

    return NextResponse.json({ ok: true, inseridos: registrosCriados.length }, { status: 201 })
  } catch (error) {
    console.error("Erro ao registrar comissões da produção:", error)
    return NextResponse.json({ error: "Erro ao gravar comissão" }, { status: 500 })
  }
}
