import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"

const DEFAULT_STATUS_VISIVEIS = [
  "aguardando",
  "aprovado",
  "ag_confirmacao",
  "impressao",
  "acabamento",
  "pronto",
]

interface PedidoItemRaw {
  largura?: number | string
  altura?: number | string
  quantidadeUnidades?: number | string
  observacoes?: string
}

interface OrcamentoRaw {
  id: string
  numero: number
  cliente_nome: string
  material_fechado: { nome?: string } | null
  servico_fechado: { nome?: string } | null
  item: PedidoItemRaw | null
  observacao?: string | null
  status: string
  criado_em: string
  total: number | string
}

export async function GET() {
  const hoje = new Date().toISOString().slice(0, 10)
  const sql = getSql()

  // Ler configuração da TV
  let config = {
    statusVisiveis: DEFAULT_STATUS_VISIVEIS,
    tiposVisiveis: ["rapido", "orcamento"],
    mostrarAtrasados: true,
    somAlarme: true,
    tema: "dark",
    apenasRecentes: false,
    densidade: "normal",
    tamanhoFonte: "grande",
    ocultarVazias: true,
  }

  try {
    const confRows = await sql`SELECT valor FROM configuracoes WHERE chave = 'tv_config'`
    if (confRows[0]?.valor) {
      config = { ...config, ...JSON.parse(confRows[0].valor) }
    }
  } catch {
    // usa padrão se não houver tabela ou falhar
  }

  const statusVisiveis =
    Array.isArray(config.statusVisiveis) && config.statusVisiveis.length > 0
      ? config.statusVisiveis
      : DEFAULT_STATUS_VISIVEIS

  // Se "aprovado" está selecionado, também inclui "arte" que é estágio equivalente
  const statusComArte = statusVisiveis.includes("aprovado")
    ? [...statusVisiveis, "arte"]
    : statusVisiveis

  const podeBuscarRapidos = config.tiposVisiveis.includes("rapido")
  const podeBuscarOrcamentos = config.tiposVisiveis.includes("orcamento")

  const [pedidosRapidosRaw, orcamentosRaw, avisos] = await Promise.all([
    podeBuscarRapidos
      ? sql`
          SELECT id, numero, cliente_nome, produto_nome, variante_nome,
                 acabamento, observacao, status, criado_em, prazo_entrega_em, total
          FROM pedidos_rapidos
          WHERE status = ANY(${statusComArte})
        `
      : Promise.resolve([]),
    podeBuscarOrcamentos
      ? (sql`
          SELECT 
            o.id,
            o.numero,
            COALESCE(c.nome, 'Cliente') as cliente_nome,
            o.material_fechado,
            o.servico_fechado,
            o.item,
            o.observacao,
            o.status_producao as status,
            o.criado_em,
            COALESCE(o.total_fechado, 0) as total
          FROM orcamentos o
          LEFT JOIN clientes c ON c.id = o.cliente_id
          WHERE o.status_producao = ANY(${statusComArte})
        ` as unknown as Promise<OrcamentoRaw[]>)
      : Promise.resolve([]),
    sql`
      SELECT id, mensagem, cor, icone, som, COALESCE(ativo, true) as ativo 
      FROM avisos_tv 
      WHERE COALESCE(ativo, true) = true 
      ORDER BY criado_em DESC
    `,
  ])

  const pedidosRapidos = (pedidosRapidosRaw as Array<{
    id: string
    numero: number
    cliente_nome: string
    produto_nome: string | null
    variante_nome: string | null
    acabamento: string | null
    observacao: string
    status: string
    criado_em: string
    prazo_entrega_em: string | null
    total: number | string
  }>).map((p) => ({
    id: p.id,
    numero: p.numero,
    cliente_nome: p.cliente_nome,
    produto_nome: p.produto_nome,
    variante_nome: p.variante_nome,
    acabamento: p.acabamento,
    observacao: p.observacao || "",
    status: p.status === "arte" ? "aprovado" : p.status,
    criado_em: p.criado_em,
    prazo_entrega_em: p.prazo_entrega_em,
    total: Number(p.total) || 0,
    tipo: "rapido" as const,
  }))

  const orcamentos = orcamentosRaw.map((o) => {
    const item = typeof o.item === "object" && o.item !== null ? o.item : {}
    const mat = typeof o.material_fechado === "object" && o.material_fechado !== null ? o.material_fechado : null
    const serv = typeof o.servico_fechado === "object" && o.servico_fechado !== null ? o.servico_fechado : null

    let variante_nome = ""
    if (item.largura && item.altura) {
      variante_nome = `${item.largura} × ${item.altura} m`
    } else if (item.quantidadeUnidades) {
      variante_nome = `${item.quantidadeUnidades} un`
    }

    return {
      id: o.id,
      numero: o.numero,
      cliente_nome: o.cliente_nome,
      produto_nome: mat?.nome || "Orçamento de Comunicação Visual",
      variante_nome: variante_nome || null,
      acabamento: serv?.nome || null,
      observacao: o.observacao || item.observacoes || "",
      status: o.status === "arte" ? "aprovado" : o.status,
      criado_em: o.criado_em,
      prazo_entrega_em: null,
      total: Number(o.total) || 0,
      tipo: "orcamento" as const,
    }
  })

  let todos = [...pedidosRapidos, ...orcamentos]

  if (config.apenasRecentes) {
    todos.sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())
    todos = todos.slice(0, 5)
  } else {
    todos.sort((a, b) => {
      const atrasadoA = a.status !== "pronto" && a.prazo_entrega_em && a.prazo_entrega_em < hoje
      const atrasadoB = b.status !== "pronto" && b.prazo_entrega_em && b.prazo_entrega_em < hoje
      if (atrasadoA && !atrasadoB) return -1
      if (!atrasadoA && atrasadoB) return 1

      // Fila de Produção FIFO: o pedido que entrou primeiro fica no topo da fila, novos entram por baixo
      const tempoA = a.criado_em ? new Date(a.criado_em).getTime() : 0
      const tempoB = b.criado_em ? new Date(b.criado_em).getTime() : 0
      if (tempoA !== tempoB) return tempoA - tempoB

      return a.numero - b.numero
    })
  }

  return NextResponse.json(
    { pedidos: todos, avisos, config },
    { headers: { "Cache-Control": "no-store" } }
  )
}
