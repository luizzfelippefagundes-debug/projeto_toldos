"use client"

import { useEffect, useMemo, useState } from "react"
import { Factory, FileClock, Wallet, Warehouse, type LucideIcon } from "lucide-react"
import { useData } from "@/context/data-context"
import { usePapelAtivo } from "@/context/papel-ativo-context"
import { estaNosProximosDias } from "@/lib/date-window"
import { estaLancamentoVencido } from "@/lib/financeiro"
import { pedidoRapidoEstaAtrasado } from "@/lib/pedidos-rapidos"

export interface Alerta {
  id: string
  texto: string
  href: string
  quantidade: number
  Icon: LucideIcon
}

// Lista de alertas usada no card "Alertas" do dashboard e no sininho de
// notificação — um único lugar pra não desalinhar contagem e conteúdo.
export function useAlertas(): Alerta[] {
  const { materiais, pedidosRapidos, produtosRapidos, lancamentos, orcamentos } = useData()
  const { papel } = usePapelAtivo()

  // `new Date()` não pode entrar no primeiro render (ver dashboard/page.tsx
  // para a explicação completa do hydration mismatch); começa nulo e só
  // calcula depois de montar.
  const [hoje, setHoje] = useState<Date | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHoje(new Date())
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

  return useMemo(() => {
    const todos: Alerta[] = [
      {
        id: "estoque",
        texto: `${estoqueBaixo} ${estoqueBaixo === 1 ? "material" : "materiais"} com estoque baixo`,
        href: "/estoque",
        quantidade: estoqueBaixo,
        Icon: Warehouse,
      },
      {
        id: "producao",
        texto: `${pedidosAtrasados} pedido${pedidosAtrasados === 1 ? "" : "s"} atrasado${pedidosAtrasados === 1 ? "" : "s"} na produção`,
        href: "/producao",
        quantidade: pedidosAtrasados,
        Icon: Factory,
      },
      {
        id: "boletos",
        texto: `${boletosVencendo} boleto${boletosVencendo === 1 ? "" : "s"} vencendo em 3 dias`,
        href: "/financeiro",
        quantidade: boletosVencendo,
        Icon: Wallet,
      },
      {
        id: "financeiro-vencido",
        texto: `${lancamentosVencidos} conta${lancamentosVencidos === 1 ? "" : "s"} financeira${lancamentosVencidos === 1 ? " vencida" : "s vencidas"}`,
        href: "/financeiro",
        quantidade: lancamentosVencidos,
        Icon: Wallet,
      },
      {
        id: "validade",
        texto: `${orcamentosValidadeVencendo} orçamento${orcamentosValidadeVencendo === 1 ? "" : "s"} com validade vencendo em 3 dias`,
        href: "/orcamentos",
        quantidade: orcamentosValidadeVencendo,
        Icon: FileClock,
      },
    ]

    return todos.filter((a) => a.quantidade > 0).filter((a) => {
      if (papel === "dono") return true
      if (papel === "financeiro") return a.id === "boletos" || a.id === "financeiro-vencido"
      return a.id === "estoque" || a.id === "producao"
    })
  }, [estoqueBaixo, pedidosAtrasados, boletosVencendo, lancamentosVencidos, orcamentosValidadeVencendo, papel])
}
