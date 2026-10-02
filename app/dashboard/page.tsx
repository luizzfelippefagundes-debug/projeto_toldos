"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useData } from "@/context/data-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  AlertTriangle,
  Check,
  Factory,
  FileClock,
  FilePlus2,
  PartyPopper,
  Warehouse,
  Wallet,
} from "lucide-react"
import { cn } from "@/lib/utils"

const UM_DIA_MS = 24 * 60 * 60 * 1000

export default function DashboardPage() {
  const { materiais, servicos, orcamentos, pedidosRapidos, produtosRapidos, lancamentos } =
    useData()

  const passos = [
    { label: "Cadastrar materiais", feito: materiais.length > 0 },
    { label: "Cadastrar mão de obra", feito: servicos.length > 0 },
    { label: "Fazer o primeiro orçamento", feito: orcamentos.length > 0 },
  ]
  const concluidos = passos.filter((p) => p.feito).length
  const progresso = Math.round((concluidos / passos.length) * 100)

  const abertos = orcamentos.filter((o) => o.status === "aberto").length
  const estoqueBaixo = materiais.filter(
    (m) => m.quantidadeEstoque < m.estoqueMinimo
  ).length

  // `new Date()` ("hoje") não pode entrar no primeiro render: essa tela pode
  // ser pré-renderizada estaticamente em build (Next.js otimiza páginas
  // client sem dependências dinâmicas), então a build travaria "hoje" na
  // data do build para sempre — o mesmo problema de hydration mismatch que o
  // DataProvider evita para o localStorage (ver context/data-context.tsx),
  // só que aqui o relógio é a "fonte externa". Começa nulo (igual no
  // servidor e no primeiro render do cliente) e só calcula depois de montar.
  const [hoje, setHoje] = useState<Date | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHoje(new Date())
  }, [])

  const fechadosNoMes = useMemo(() => {
    if (!hoje) return null
    return orcamentos.filter(
      (o) =>
        o.status === "fechado" &&
        o.fechadoEm &&
        new Date(o.fechadoEm).getMonth() === hoje.getMonth() &&
        new Date(o.fechadoEm).getFullYear() === hoje.getFullYear()
    ).length
  }, [orcamentos, hoje])

  const pedidosAtrasados = useMemo(() => {
    if (!hoje) return 0
    return pedidosRapidos.filter((p) => {
      if (p.status === "entregue") return false
      const produto = produtosRapidos.find((prod) => prod.id === p.produtoId)
      if (!produto) return false
      const diasCorridos =
        (hoje.getTime() - new Date(p.criadoEm).getTime()) / UM_DIA_MS
      return diasCorridos > produto.prazoDias
    }).length
  }, [pedidosRapidos, produtosRapidos, hoje])

  const lancamentosVencendo = useMemo(() => {
    if (!hoje) return []
    const limite = new Date(hoje.getTime() + 3 * UM_DIA_MS)
    return lancamentos.filter(
      (l) => l.status === "pendente" && new Date(l.vencimento) <= limite
    )
  }, [lancamentos, hoje])
  const boletosVencendo = lancamentosVencendo.filter(
    (l) => l.formaPagamento === "boleto"
  )

  const orcamentosValidadeVencendo = useMemo(() => {
    if (!hoje) return 0
    const limite = new Date(hoje.getTime() + 3 * UM_DIA_MS)
    return orcamentos.filter((o) => {
      if (o.status !== "fechado") return false
      const validoAte = new Date(
        new Date(o.criadoEm).getTime() + (o.validadeDias ?? 7) * UM_DIA_MS
      )
      return validoAte <= limite
    }).length
  }, [orcamentos, hoje])

  const alertas = [
    {
      id: "estoque",
      texto: `${estoqueBaixo} material${estoqueBaixo === 1 ? "" : "is"} com estoque baixo`,
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
      texto: `${boletosVencendo.length} boleto${boletosVencendo.length === 1 ? "" : "s"} vencendo em 3 dias`,
      href: "/financeiro",
      quantidade: boletosVencendo.length,
      Icon: Wallet,
    },
    {
      id: "validade",
      texto: `${orcamentosValidadeVencendo} orçamento${orcamentosValidadeVencendo === 1 ? "" : "s"} com validade vencendo em 3 dias`,
      href: "/orcamentos",
      quantidade: orcamentosValidadeVencendo,
      Icon: FileClock,
    },
  ].filter((a) => a.quantidade > 0)

  return (
    <div className="flex flex-col gap-6">
      {progresso < 100 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configure seu sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress
              value={progresso}
              aria-label="Progresso da configuração"
              className="mb-4"
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
              {passos.map((passo) => (
                <div
                  key={passo.label}
                  className="flex items-center gap-2 text-sm"
                  aria-label={`${passo.label}: ${passo.feito ? "concluído" : "pendente"}`}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full border",
                      passo.feito
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/40 text-transparent"
                    )}
                  >
                    <Check className="h-3 w-3" />
                  </span>
                  <span
                    className={
                      passo.feito ? "text-foreground" : "text-muted-foreground"
                    }
                  >
                    {passo.label}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Bom dia 👋</h1>
        <Button size="lg" render={<Link href="/orcamentos/novo" />}>
          <FilePlus2 className="mr-2 h-4 w-4" />
          Novo Orçamento
        </Button>
      </div>

      {hoje && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Alertas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alertas.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <PartyPopper className="h-4 w-4" />
                Tudo certo por aqui, nenhum alerta no momento.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {alertas.map((alerta) => (
                  <Link
                    key={alerta.id}
                    href={alerta.href}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
                  >
                    <span>{alerta.texto}</span>
                    <alerta.Icon className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Orçamentos abertos
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{abertos}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Fechados no mês
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">
            {fechadosNoMes ?? "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Estoque com alerta baixo
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">
            {estoqueBaixo}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
