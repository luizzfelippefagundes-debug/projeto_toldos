"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import {
  Factory,
  FileClock,
  PhoneCall,
  Wallet,
  Warehouse,
  Tv2,
  AlertTriangle,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { useData } from "@/context/data-context"
import { usePapelAtivo } from "@/context/papel-ativo-context"
import { estaNosProximosDias } from "@/lib/date-window"
import { estaLancamentoVencido } from "@/lib/financeiro"
import { pedidoRapidoEstaAtrasado } from "@/lib/pedidos-rapidos"
import { entraNoQuadro, retornoDoOrcamento, situacaoContato } from "@/lib/retornos"

export type CategoriaAlerta =
  | "problema"
  | "telao"
  | "producao"
  | "retorno"
  | "financeiro"
  | "estoque"

export interface Alerta {
  id: string
  texto: string
  href: string
  quantidade: number
  Icon: LucideIcon
  categoria: CategoriaAlerta
}

export interface SecaoAlertas {
  categoria: CategoriaAlerta
  titulo: string
  icone: LucideIcon
  corTexto: string
  corBadge: string
  alertas: Alerta[]
}

export const ORDEM_CATEGORIAS: CategoriaAlerta[] = [
  "problema",
  "telao",
  "producao",
  "retorno",
  "financeiro",
  "estoque",
]

export const SECOES_CONFIG: Record<
  CategoriaAlerta,
  { titulo: string; icone: LucideIcon; corTexto: string; corBadge: string }
> = {
  problema: {
    titulo: "Problemas na Fábrica",
    icone: AlertTriangle,
    corTexto: "text-red-600 dark:text-red-400",
    corBadge: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  },
  telao: {
    titulo: "Comunicados do Telão",
    icone: Tv2,
    corTexto: "text-amber-600 dark:text-amber-400",
    corBadge: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  producao: {
    titulo: "Prazos & Produção",
    icone: Factory,
    corTexto: "text-blue-600 dark:text-blue-400",
    corBadge: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  },
  retorno: {
    titulo: "Retornos de Vendas",
    icone: PhoneCall,
    corTexto: "text-purple-600 dark:text-purple-400",
    corBadge: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
  },
  financeiro: {
    titulo: "Financeiro & Contas",
    icone: Wallet,
    corTexto: "text-emerald-600 dark:text-emerald-400",
    corBadge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  },
  estoque: {
    titulo: "Estoque de Materiais",
    icone: Warehouse,
    corTexto: "text-orange-600 dark:text-orange-400",
    corBadge: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
  },
}

const STORAGE_DISPENSADOS = "alertas_dispensados_v1"

export function useAlertas() {
  const { materiais, pedidosRapidos, produtosRapidos, lancamentos, orcamentos, clientes } = useData()
  const { papel } = usePapelAtivo()

  const [hoje, setHoje] = useState<Date | null>(null)
  const [avisosTv, setAvisosTv] = useState<{ id: string; mensagem: string; icone?: string; ativo?: boolean }[]>([])
  const [dispensados, setDispensados] = useState<string[]>([])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHoje(new Date())

    try {
      const salvo = localStorage.getItem(STORAGE_DISPENSADOS)
      if (salvo) {
        setDispensados(JSON.parse(salvo))
      }
    } catch {}

    fetch("/api/avisos-tv")
      .then((r) => (r.ok ? r.json() : []))
      .then((dados) => {
        if (Array.isArray(dados)) setAvisosTv(dados)
      })
      .catch(() => {})
  }, [])

  const apagarAlerta = useCallback(async (id: string) => {
    setDispensados((prev) => {
      const novo = prev.includes(id) ? prev : [...prev, id]
      try {
        localStorage.setItem(STORAGE_DISPENSADOS, JSON.stringify(novo))
      } catch {}
      return novo
    })

    // Se for aviso do telão da TV, remove também do banco de dados
    if (id.startsWith("aviso-")) {
      const avisoId = id.replace("aviso-", "")
      setAvisosTv((prev) => prev.filter((a) => a.id !== avisoId))
      try {
        await fetch(`/api/avisos-tv/${avisoId}`, { method: "DELETE" })
      } catch {}
    }
  }, [])

  const limparTodos = useCallback((idsParaLimpar: string[]) => {
    setDispensados((prev) => {
      const set = new Set([...prev, ...idsParaLimpar])
      const novo = Array.from(set)
      try {
        localStorage.setItem(STORAGE_DISPENSADOS, JSON.stringify(novo))
      } catch {}
      return novo
    })
  }, [])

  const restaurarTodos = useCallback(() => {
    setDispensados([])
    try {
      localStorage.removeItem(STORAGE_DISPENSADOS)
    } catch {}
  }, [])

  const estoqueBaixo = materiais.filter(
    (m) => m.quantidadeEstoque < m.estoqueMinimo
  ).length

  const pedidosAtrasados = useMemo(() => {
    if (!hoje) return 0
    return pedidosRapidos.filter((p) => {
      const produto = produtosRapidos.find((prod) => prod.id === p.produtoId)
      return pedidoRapidoEstaAtrasado(p, produto?.prazoDias, hoje)
    }).length
  }, [pedidosRapidos, produtosRapidos, hoje])

  const boletosVencendo = useMemo(() => {
    if (!hoje) return 0
    return lancamentos.filter(
      (l) =>
        l.status === "pendente" &&
        l.formaPagamento === "boleto" &&
        estaNosProximosDias(l.vencimento, hoje, 3)
    ).length
  }, [lancamentos, hoje])

  const lancamentosVencidos = useMemo(() => {
    if (!hoje) return 0
    return lancamentos.filter((l) => estaLancamentoVencido(l, hoje)).length
  }, [lancamentos, hoje])

  const orcamentosValidadeVencendo = useMemo(() => {
    if (!hoje) return 0
    return orcamentos.filter((o) => {
      if (o.status !== "fechado") return false
      const validoAte = new Date(o.criadoEm)
      validoAte.setDate(validoAte.getDate() + (o.validadeDias ?? 7))
      return estaNosProximosDias(validoAte, hoje, 3)
    }).length
  }, [orcamentos, hoje])

  const orcsAprovacaoPendente = useMemo(() => {
    return orcamentos.filter((o) => {
      const ret = o.retorno as unknown as Record<string, unknown> | null
      return Boolean(
        o.status === "aberto" &&
          (ret?.clienteSinalizouAprovacao ||
            (typeof ret?.anotacao === "string" && ret.anotacao.includes("Cliente confirmou no WhatsApp")))
      )
    })
  }, [orcamentos])

  const retornosPendentes = useMemo(() => {
    if (!hoje) return 0
    return orcamentos.filter((o) => {
      if (!entraNoQuadro(o)) return false
      const situacao = situacaoContato(retornoDoOrcamento(o), hoje)
      return situacao === "hoje" || situacao === "atrasado"
    }).length
  }, [orcamentos, hoje])

  const problemasProducao = useMemo(() => {
    const pedidos = pedidosRapidos
      .filter(
        (p) =>
          p.status !== "pronto" &&
          p.status !== "entregue" &&
          (p.observacao?.includes("ALERTA DA FÁBRICA") || p.observacao?.includes("PROBLEMA REPORTADO"))
      )
      .map((p) => ({
        id: `prob-ped-${p.id}`,
        numero: p.numero,
        cliente: p.clienteNome,
      }))

    const orcs = orcamentos
      .filter((o) => {
        const st = o.statusProducao || (o.status === "fechado" ? "aguardando" : null)
        return (
          st &&
          st !== "pronto" &&
          st !== "entregue" &&
          (o.observacao?.includes("ALERTA DA FÁBRICA") || o.observacao?.includes("PROBLEMA REPORTADO"))
        )
      })
      .map((o) => {
        const cli = clientes.find((c) => c.id === o.clienteId)
        return {
          id: `prob-orc-${o.id}`,
          numero: o.numero,
          cliente: cli?.nome || "Cliente",
        }
      })

    return [...pedidos, ...orcs]
  }, [pedidosRapidos, orcamentos, clientes])

  const { alertas, secoes } = useMemo(() => {
    const todos: Alerta[] = [
      ...(orcsAprovacaoPendente.length > 0
        ? [
            {
              id: "aprovacao-whatsapp",
              texto: `⚡ ${orcsAprovacaoPendente.length} ${
                orcsAprovacaoPendente.length === 1 ? "cliente confirmou" : "clientes confirmaram"
              } o orçamento no WhatsApp — clique para aprovar e emitir a OS!`,
              href: "/retornos",
              quantidade: orcsAprovacaoPendente.length,
              Icon: Zap,
              categoria: "problema" as CategoriaAlerta,
            },
          ]
        : []),
      ...problemasProducao.map((prob) => ({
        id: prob.id,
        texto: `⚠️ Problema na fábrica no #${prob.numero} (${prob.cliente})`,
        href: `/producao?busca=${encodeURIComponent(String(prob.numero))}`,
        quantidade: 1,
        Icon: AlertTriangle,
        categoria: "problema" as CategoriaAlerta,
      })),
      {
        id: "retornos",
        texto: `${retornosPendentes} cliente${retornosPendentes === 1 ? "" : "s"} pra retornar sobre orçamento (hoje ou atrasado)`,
        href: "/retornos",
        quantidade: retornosPendentes,
        Icon: PhoneCall,
        categoria: "retorno" as CategoriaAlerta,
      },
      {
        id: "estoque",
        texto: `${estoqueBaixo} ${estoqueBaixo === 1 ? "material" : "materiais"} com estoque baixo`,
        href: "/estoque",
        quantidade: estoqueBaixo,
        Icon: Warehouse,
        categoria: "estoque" as CategoriaAlerta,
      },
      {
        id: "producao",
        texto: `${pedidosAtrasados} pedido${pedidosAtrasados === 1 ? "" : "s"} atrasado${pedidosAtrasados === 1 ? "" : "s"} na produção`,
        href: "/producao",
        quantidade: pedidosAtrasados,
        Icon: Factory,
        categoria: "producao" as CategoriaAlerta,
      },
      {
        id: "boletos",
        texto: `${boletosVencendo} boleto${boletosVencendo === 1 ? "" : "s"} vencendo em 3 dias`,
        href: "/financeiro",
        quantidade: boletosVencendo,
        Icon: Wallet,
        categoria: "financeiro" as CategoriaAlerta,
      },
      {
        id: "financeiro-vencido",
        texto: `${lancamentosVencidos} conta${lancamentosVencidos === 1 ? "" : "s"} financeira${lancamentosVencidos === 1 ? " vencida" : "s vencidas"}`,
        href: "/financeiro",
        quantidade: lancamentosVencidos,
        Icon: Wallet,
        categoria: "financeiro" as CategoriaAlerta,
      },
      {
        id: "validade",
        texto: `${orcamentosValidadeVencendo} orçamento${orcamentosValidadeVencendo === 1 ? "" : "s"} com validade vencendo em 3 dias`,
        href: "/orcamentos",
        quantidade: orcamentosValidadeVencendo,
        Icon: FileClock,
        categoria: "producao" as CategoriaAlerta,
      },
      ...avisosTv
        .filter((a) => a.ativo !== false)
        .map((a) => ({
          id: `aviso-${a.id}`,
          texto: `${a.icone || "📢"} Telão: "${a.mensagem}"`,
          href: "/avisos-tv",
          quantidade: 1,
          Icon: Tv2,
          categoria: "telao" as CategoriaAlerta,
        })),
    ]

    const filtrados = todos
      .filter((a) => a.quantidade > 0)
      .filter((a) => !dispensados.includes(a.id))
      .filter((a) => {
        // Colaborador não deve ver alertas administrativos, de vendas ou financeiros
        if (papel === "operador") return false
        if (papel === "dono") return true
        if (a.id.startsWith("aviso-")) return true
        if (a.id.startsWith("prob-")) return true
        if (papel === "financeiro") return a.id === "boletos" || a.id === "financeiro-vencido"
        if (papel === "producao") return a.id === "estoque" || a.id === "producao" || a.id.startsWith("prob-")
        return a.id === "retornos"
      })

    // Monta seções categorizadas ordenadas por urgência
    const grupos: SecaoAlertas[] = []
    for (const cat of ORDEM_CATEGORIAS) {
      const itens = filtrados.filter((a) => a.categoria === cat)
      if (itens.length > 0) {
        const conf = SECOES_CONFIG[cat]
        grupos.push({
          categoria: cat,
          titulo: conf.titulo,
          icone: conf.icone,
          corTexto: conf.corTexto,
          corBadge: conf.corBadge,
          alertas: itens,
        })
      }
    }

    return { alertas: filtrados, secoes: grupos }
  }, [
    problemasProducao,
    orcsAprovacaoPendente,
    retornosPendentes,
    estoqueBaixo,
    pedidosAtrasados,
    boletosVencendo,
    lancamentosVencidos,
    orcamentosValidadeVencendo,
    avisosTv,
    dispensados,
    papel,
  ])

  return {
    alertas,
    secoes,
    apagarAlerta,
    limparTodos: () => limparTodos(alertas.map((a) => a.id)),
    restaurarTodos,
    total: alertas.length,
    temDispensados: dispensados.length > 0,
    hoje,
  }
}
