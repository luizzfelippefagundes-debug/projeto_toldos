import { getSql } from "./db"
import { garantirColunasOrcamentos } from "./migracoes"
import { formatarNumeroOrcamento } from "./orcamento-pdf"
import { estimarTotalMaterial, resumirPedidoLoja, type PrecoMaterial, type ResumoPedidoLoja } from "./loja-orcamento"
import type { OrcamentoItem } from "./types"

export interface PedidoSite {
  id: string
  numero: number
  numeroFormatado: string
  criadoEm: string
  status: string
  novo: boolean
  totalFechado: number | null
  /** Valor estimado do material (área x preço do cadastro); não inclui instalação. */
  totalEstimado: number | null
  fechadoEm: string | null
  cliente: { id: string | null; nome: string; telefone: string }
  resumo: ResumoPedidoLoja
}

/**
 * Pedidos que chegaram pelo site (orçamentos com origem "loja"), do mais novo ao
 * mais antigo. Com `conta`, só os pedidos feitos por aquele login.
 */
export async function listarPedidosDoSite(opcoes: { conta?: string; limite?: number } = {}): Promise<PedidoSite[]> {
  await garantirColunasOrcamentos()
  const limite = opcoes.limite ?? 200
  // strpos (e não LIKE) porque o "_" do id da conta valeria como curinga no LIKE.
  const marcador = opcoes.conta ? `\nConta: ${opcoes.conta}\n` : ""
  const linhas = await getSql()`
    SELECT o.id, o.numero, o.criado_em, o.fechado_em, o.status, o.retorno, o.total_fechado, o.observacao, o.item,
           c.id AS cliente_id, c.nome AS cliente_nome, c.telefone AS cliente_telefone
    FROM orcamentos o
    LEFT JOIN clientes c ON c.id = o.cliente_id
    WHERE o.origem = 'loja'
      AND (${marcador}::text = '' OR strpos(o.observacao, ${marcador}::text) > 0)
    ORDER BY o.numero DESC
    LIMIT ${limite}
  `
  const materiaisRows = await getSql()`SELECT id, unidade, preco_unitario FROM materiais`
  const materiais = new Map<string, PrecoMaterial>(
    materiaisRows.map((m) => [String(m.id), { unidade: String(m.unidade), preco: Number(m.preco_unitario) }])
  )
  return linhas.map((r) => {
    const item = (typeof r.item === "string" ? JSON.parse(r.item) : r.item) as OrcamentoItem | null
    const numero = Number(r.numero)
    const status = String(r.status)
    return {
      id: String(r.id),
      numero,
      numeroFormatado: formatarNumeroOrcamento(numero, String(r.criado_em)),
      criadoEm: String(r.criado_em),
      status,
      // "Novo" = ninguém mexeu ainda: aberto e sem acompanhamento em Retornos.
      novo: status === "aberto" && !r.retorno,
      totalFechado: r.total_fechado != null ? Number(r.total_fechado) : null,
      totalEstimado: item ? estimarTotalMaterial(item, materiais) : null,
      fechadoEm: r.fechado_em ? String(r.fechado_em) : null,
      cliente: {
        id: r.cliente_id ? String(r.cliente_id) : null,
        nome: String(r.cliente_nome ?? "Cliente"),
        telefone: String(r.cliente_telefone ?? ""),
      },
      resumo: resumirPedidoLoja(r.observacao as string | null),
    }
  })
}
