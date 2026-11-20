"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useData } from "@/context/data-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  AlertTriangle,
  Check,
  Factory,
  FilePlus2,
  PartyPopper,
  Wallet,
  X,
  Trash2,
  RotateCcw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { resumirFinanceiro } from "@/lib/financeiro"
import { pedidoRapidoEstaAtrasado } from "@/lib/pedidos-rapidos"
import { usePapelAtivo } from "@/context/papel-ativo-context"
import { formatarMoeda } from "@/lib/format"
import { useAlertas, type CategoriaAlerta } from "@/hooks/use-alertas"
import { toast } from "sonner"

export default function DashboardPage() {
  const { materiais, servicos, orcamentos, pedidosRapidos, produtosRapidos, lancamentos } =
    useData()
  const { papel } = usePapelAtivo()

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
      const produto = produtosRapidos.find((prod) => prod.id === p.produtoId)
      return pedidoRapidoEstaAtrasado(p, produto?.prazoDias, hoje)
    }).length
  }, [pedidosRapidos, produtosRapidos, hoje])

  const resumoFinanceiro = useMemo(
    () => resumirFinanceiro(lancamentos, hoje ?? new Date(0)),
    [lancamentos, hoje]
  )

  const pedidosEmProducao = pedidosRapidos.filter((p) =>
    ["aprovado", "arte", "impressao", "acabamento"].includes(p.status)
  ).length
  const pedidosProntos = pedidosRapidos.filter(
    (p) => p.status === "pronto"
  ).length

  const { alertas, secoes, apagarAlerta, limparTodos, restaurarTodos, total, temDispensados } = useAlertas()
  const [abaAlertaAtiva, setAbaAlertaAtiva] = useState<"todas" | CategoriaAlerta>("todas")

  const secoesVisiveis =
    abaAlertaAtiva === "todas"
      ? secoes
      : secoes.filter((s) => s.categoria === abaAlertaAtiva)

  const [saudacao, setSaudacao] = useState("Olá")
  useEffect(() => {
    const hora = new Date().getHours()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaudacao(hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite")
  }, [])

  const tituloDashboard =
    papel === "producao"
      ? "Painel da produção"
      : papel === "financeiro"
        ? "Painel financeiro"
        : saudacao
  const destinoAcao =
    papel === "producao"
      ? { href: "/producao", label: "Acompanhar produção", Icon: Factory }
      : papel === "financeiro"
        ? { href: "/financeiro", label: "Abrir financeiro", Icon: Wallet }
        : { href: "/orcamentos/novo", label: "Novo Orçamento", Icon: FilePlus2 }

  return (
    <div className="flex flex-col gap-6">
      {papel === "dono" && progresso < 100 && (
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
        <div className="flex items-center gap-3">
          <Image
            src="/brand/logo-simbolo.png"
            alt="Símbolo da Toldos Print"
            width={650}
            height={155}
            className="h-auto w-[88px] shrink-0"
          />
          <h1 className="text-2xl font-semibold">{tituloDashboard}</h1>
        </div>
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href={destinoAcao.href} />}
        >
          <destinoAcao.Icon className="mr-2 h-4 w-4" />
          {destinoAcao.label}
        </Button>
      </div>

      {hoje && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="flex items-center gap-2 text-base font-bold flex-wrap">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  <span>Alertas e Notificações</span>
                </span>
                {total > 0 && (
                  <span className="rounded-full bg-destructive/15 text-destructive font-bold text-xs px-2 py-0.5">
                    {total} {total === 1 ? "alerta" : "alertas"}
                  </span>
                )}
              </CardTitle>

              {total > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    limparTodos()
                    toast.success("Todas as notificações foram apagadas.")
                  }}
                  className="text-xs font-semibold text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors cursor-pointer"
                  title="Apagar todas as notificações visíveis"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Limpar todas</span>
                </button>
              )}
            </div>

            {/* Abas de Categorias / Seções */}
            {secoes.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pt-2 text-xs [scrollbar-width:none]">
                <button
                  type="button"
                  onClick={() => setAbaAlertaAtiva("todas")}
                  className={cn(
                    "rounded-lg px-2.5 py-1 font-semibold text-xs transition-colors shrink-0 cursor-pointer",
                    abaAlertaAtiva === "todas"
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "bg-muted/70 text-muted-foreground hover:text-foreground"
                  )}
                >
                  Todas ({total})
                </button>
                {secoes.map((s) => (
                  <button
                    key={s.categoria}
                    type="button"
                    onClick={() => setAbaAlertaAtiva(s.categoria)}
                    className={cn(
                      "rounded-lg px-2.5 py-1 font-semibold text-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer",
                      abaAlertaAtiva === s.categoria
                        ? "bg-primary text-primary-foreground shadow-2xs"
                        : "bg-muted/70 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <s.icone className="h-3.5 w-3.5" />
                    <span>{s.titulo}</span>
                    <span className="rounded-full bg-black/20 dark:bg-white/20 px-1 text-[10px]">
                      {s.alertas.length}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardHeader>

          <CardContent className="pt-3">
            {total === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center text-sm text-muted-foreground gap-2">
                <p className="flex items-center gap-2">
                  <PartyPopper className="h-4 w-4 text-emerald-500" />
                  <span>Tudo certo por aqui, nenhum alerta no momento.</span>
                </p>
                {temDispensados && (
                  <button
                    type="button"
                    onClick={() => {
                      restaurarTodos()
                      toast.success("Notificações restauradas!")
                    }}
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Restaurar notificações apagadas</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-4 max-h-72 sm:max-h-80 overflow-y-auto pr-1.5 [scrollbar-width:thin]">
                {secoesVisiveis.map((secao) => (
                  <div key={secao.categoria} className="flex flex-col gap-1.5">
                    {/* Cabeçalho da Seção */}
                    <div className="flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <secao.icone className={cn("h-3.5 w-3.5", secao.corTexto)} />
                        <span>{secao.titulo}</span>
                      </span>
                      <span className={cn("rounded-md border px-1.5 py-0.2 text-[10px]", secao.corBadge)}>
                        {secao.alertas.length}
                      </span>
                    </div>

                    {/* Lista de Alertas da Seção */}
                    <div className="flex flex-col gap-1.5">
                      {secao.alertas.map((alerta) => (
                        <div
                          key={alerta.id}
                          className={cn(
                            "group relative flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-xs sm:text-sm transition-all hover:shadow-xs",
                            alerta.categoria === "problema"
                              ? "border-red-500/60 bg-red-500/10 hover:bg-red-500/20 text-red-700 dark:text-red-300 font-bold shadow-2xs"
                              : "border-border/80 bg-accent/20 hover:bg-accent/40 text-foreground"
                          )}
                        >
                          <Link
                            href={alerta.href}
                            className="flex items-center gap-2.5 min-w-0 flex-1 pr-2"
                          >
                            <alerta.Icon
                              className={cn(
                                "h-4 w-4 shrink-0",
                                alerta.categoria === "problema"
                                  ? "text-red-600 dark:text-red-400 animate-pulse"
                                  : "text-destructive"
                              )}
                            />
                            <span className="leading-snug break-words">{alerta.texto}</span>
                          </Link>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <Link
                              href={alerta.href}
                              className="text-xs shrink-0 font-bold opacity-80 hover:opacity-100 underline hover:no-underline"
                            >
                              Ver →
                            </Link>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                apagarAlerta(alerta.id)
                                toast.info("Notificação apagada.")
                              }}
                              className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/15 transition-colors cursor-pointer"
                              title="Apagar notificação"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {temDispensados && (
                  <div className="pt-1 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        restaurarTodos()
                        toast.success("Notificações restauradas!")
                      }}
                      className="text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Restaurar notificações apagadas</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}


      {papel === "dono" && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Indicador titulo="Orçamentos abertos" valor={String(abertos)} />
          <Indicador
            titulo="Fechados no mês"
            valor={String(fechadosNoMes ?? "—")}
          />
          <Indicador titulo="Estoque com alerta baixo" valor={String(estoqueBaixo)} />
        </div>
      )}

      {papel === "producao" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Indicador titulo="Pedidos em produção" valor={String(pedidosEmProducao)} />
          <Indicador titulo="Pedidos atrasados" valor={hoje ? String(pedidosAtrasados) : "—"} />
          <Indicador titulo="Pedidos prontos" valor={String(pedidosProntos)} />
          <Indicador titulo="Materiais com estoque baixo" valor={String(estoqueBaixo)} />
        </div>
      )}

      {papel === "financeiro" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Indicador titulo="A receber" valor={formatarMoeda(resumoFinanceiro.aReceber)} />
          <Indicador titulo="A pagar" valor={formatarMoeda(resumoFinanceiro.aPagar)} />
          <Indicador
            titulo="Vencido"
            valor={hoje ? formatarMoeda(resumoFinanceiro.vencidoAReceber + resumoFinanceiro.vencidoAPagar) : "—"}
          />
          <Indicador
            titulo="Saldo recebido − pago"
            valor={formatarMoeda(resumoFinanceiro.recebido - resumoFinanceiro.pago)}
          />
        </div>
      )}
    </div>
  )
}

function Indicador({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-3xl font-bold">{valor}</CardContent>
    </Card>
  )
}
