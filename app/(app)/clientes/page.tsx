"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useData } from "@/context/data-context"
import { formatarData, formatarMoeda } from "@/lib/format"
import { calcularOrcamentoSalvo } from "@/lib/orcamento-itens"
import { ClienteFormDialog } from "@/components/clientes/cliente-form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Users,
  Search,
  Phone,
  Mail,
  MessageCircle,
  ChevronRight,
  TrendingUp,
  DollarSign,
  LayoutGrid,
  List,
  UserCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"

function totalOrcamento(
  o: ReturnType<typeof useData>["orcamentos"][number],
  materiais: ReturnType<typeof useData>["materiais"],
  servicos: ReturnType<typeof useData>["servicos"]
) {
  if (o.totalFechado !== undefined) return o.totalFechado
  return calcularOrcamentoSalvo(o, materiais, servicos)?.total ?? 0
}

function formatarTelefone(tel?: string) {
  if (!tel) return ""
  const limpo = tel.replace(/\D/g, "")
  if (limpo.length === 11) {
    return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`
  }
  if (limpo.length === 10) {
    return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`
  }
  return tel
}

function linkWhatsappCliente(tel?: string) {
  if (!tel) return null
  const limpo = tel.replace(/\D/g, "")
  if (!limpo) return null
  const ddi = limpo.startsWith("55") ? limpo : `55${limpo}`
  return `https://wa.me/${ddi}`
}

function iniciaisCliente(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return "?"
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[1][0]).toUpperCase()
}

type CriterioOrdenacao = "orcamentos" | "faturamento" | "nome" | "recente"
type FiltroRapido = "todos" | "com_compras" | "recentes" | "sem_orcamentos"
type ModoVisualizacao = "tabela" | "grade"

export default function ClientesPage() {
  const { clientes, orcamentos, materiais, servicos } = useData()

  const [busca, setBusca] = useState("")
  const [filtroRapido, setFiltroRapido] = useState<FiltroRapido>("todos")
  const [ordenacao, setOrdenacao] = useState<CriterioOrdenacao>("orcamentos")
  const [modo, setModo] = useState<ModoVisualizacao>("tabela")

  const fichas = useMemo(() => {
    return clientes.map((cliente) => {
      const ocs = orcamentos
        .filter((o) => o.clienteId === cliente.id)
        .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
      const totalFaturado = ocs
        .filter((o) => o.status === "fechado")
        .reduce((acc, o) => acc + totalOrcamento(o, materiais, servicos), 0)
      const ultimoOrcamento = ocs[0]?.criadoEm ?? null
      return { cliente, totalOrcamentos: ocs.length, totalFaturado, ultimoOrcamento }
    })
  }, [clientes, orcamentos, materiais, servicos])

  // Métricas do topo
  const stats = useMemo(() => {
    const totalClientes = clientes.length
    const ativos = fichas.filter((f) => f.totalFaturado > 0).length
    const faturamentoGeral = fichas.reduce((acc, f) => acc + f.totalFaturado, 0)
    const ticketMedio = ativos > 0 ? faturamentoGeral / ativos : 0

    return { totalClientes, ativos, faturamentoGeral, ticketMedio }
  }, [clientes.length, fichas])

  // Filtragem e ordenação
  const fichasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const agora = new Date()
    const sessentaDiasAtras = new Date(agora.getTime() - 60 * 24 * 60 * 60 * 1000)

    return fichas
      .filter(({ cliente, totalOrcamentos, totalFaturado, ultimoOrcamento }) => {
        // Filtro rápido
        if (filtroRapido === "com_compras" && totalFaturado === 0) return false
        if (filtroRapido === "sem_orcamentos" && totalOrcamentos > 0) return false
        if (filtroRapido === "recentes") {
          if (!ultimoOrcamento) return false
          if (new Date(ultimoOrcamento) < sessentaDiasAtras) return false
        }

        // Busca
        if (termo) {
          const nome = cliente.nome.toLowerCase()
          const tel = (cliente.telefone ?? "").replace(/\D/g, "")
          const email = (cliente.email ?? "").toLowerCase()
          const cpf = (cliente.cpf ?? "").replace(/\D/g, "")
          const termoLimpo = termo.replace(/\D/g, "")

          const matchNome = nome.includes(termo)
          const matchEmail = email.includes(termo)
          const matchTel = termoLimpo ? tel.includes(termoLimpo) : false
          const matchCpf = termoLimpo ? cpf.includes(termoLimpo) : false

          if (!matchNome && !matchEmail && !matchTel && !matchCpf) return false
        }

        return true
      })
      .sort((a, b) => {
        if (ordenacao === "faturamento") return b.totalFaturado - a.totalFaturado
        if (ordenacao === "nome") return a.cliente.nome.localeCompare(b.cliente.nome, "pt-BR")
        if (ordenacao === "recente") {
          const dataA = a.ultimoOrcamento ? new Date(a.ultimoOrcamento).getTime() : 0
          const dataB = b.ultimoOrcamento ? new Date(b.ultimoOrcamento).getTime() : 0
          return dataB - dataA
        }
        // padrão "orcamentos"
        return b.totalOrcamentos - a.totalOrcamentos
      })
  }, [fichas, busca, filtroRapido, ordenacao])

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Gerenciamento da carteira de clientes e histórico de pedidos.
          </p>
        </div>
        <ClienteFormDialog />
      </div>

      {/* Cards de Métricas da Carteira */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 sm:p-4 shadow-2xs">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/15">
            <Users className="h-4 w-4 text-blue-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">Total de Clientes</p>
            <p className="text-lg sm:text-2xl font-bold">{stats.totalClientes}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 sm:p-4 shadow-2xs">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
            <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">Com Compras</p>
            <p className="text-lg sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.ativos}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 sm:p-4 shadow-2xs">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/15">
            <DollarSign className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">Faturamento Total</p>
            <p className="text-lg sm:text-2xl font-bold">{formatarMoeda(stats.faturamentoGeral)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 sm:p-4 shadow-2xs">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
            <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">Ticket Médio</p>
            <p className="text-lg sm:text-2xl font-bold">{formatarMoeda(stats.ticketMedio)}</p>
          </div>
        </div>
      </div>

      {/* Toolbar: Busca + Filtros + Ordenação + Alternador de Visualização */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Campo de Busca com Lupa */}
        <div className="relative flex-1 min-w-[240px] max-w-lg">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone, email ou CPF..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 pr-7 h-9 text-sm bg-background"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              title="Limpar busca"
            >
              ✕
            </button>
          )}
        </div>

        {/* Controles: Filtros rápidos, Ordenação e Modo Tabela/Grade */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented control de filtros rápidos */}
          <div className="inline-flex rounded-lg bg-muted/60 p-1 border border-border/60 gap-1 text-xs">
            {(
              [
                { valor: "todos", label: "Todos" },
                { valor: "com_compras", label: "Com compras" },
                { valor: "recentes", label: "Recentes" },
                { valor: "sem_orcamentos", label: "Sem pedidos" },
              ] as const
            ).map((opcao) => (
              <button
                key={opcao.valor}
                type="button"
                onClick={() => setFiltroRapido(opcao.valor)}
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-all",
                  filtroRapido === opcao.valor
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {opcao.label}
              </button>
            ))}
          </div>

          {/* Ordenação */}
          <Select
            value={ordenacao}
            onValueChange={(v) => setOrdenacao(v as CriterioOrdenacao)}
          >
            <SelectTrigger className="h-9 text-xs w-[145px] bg-background">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="orcamentos" className="text-xs">Mais orçamentos</SelectItem>
              <SelectItem value="faturamento" className="text-xs">Maior faturamento</SelectItem>
              <SelectItem value="nome" className="text-xs">Nome (A - Z)</SelectItem>
              <SelectItem value="recente" className="text-xs">Mais recente</SelectItem>
            </SelectContent>
          </Select>

          {/* Alternador de Visão (Tabela vs Grade) */}
          <div className="hidden sm:inline-flex rounded-lg bg-muted/60 p-1 border border-border/60 gap-0.5">
            <button
              type="button"
              onClick={() => setModo("tabela")}
              className={cn(
                "p-1.5 rounded-md transition-all",
                modo === "tabela"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Visualizar em Tabela"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setModo("grade")}
              className={cn(
                "p-1.5 rounded-md transition-all",
                modo === "grade"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Visualizar em Grade de Cards"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Resumo de resultados */}
      <div className="flex items-center justify-between text-xs text-muted-foreground -mt-2">
        <span>
          Mostrando <strong className="text-foreground">{fichasFiltradas.length}</strong> de{" "}
          {clientes.length} clientes
        </span>
        {(busca || filtroRapido !== "todos") && (
          <button
            type="button"
            onClick={() => {
              setBusca("")
              setFiltroRapido("todos")
            }}
            className="underline underline-offset-2 hover:text-foreground"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Estado vazio */}
      {fichasFiltradas.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          <Users className="h-10 w-10 opacity-30" />
          <p className="font-medium">Nenhum cliente encontrado.</p>
          <p className="text-xs max-w-xs">
            {busca
              ? "Tente buscar por outro termo ou limpe a busca para ver todos os clientes."
              : "Cadastre novos clientes clicando no botão acima."}
          </p>
        </div>
      )}

      {/* Modo Tabela (visível no desktop quando modo === 'tabela') */}
      {fichasFiltradas.length > 0 && modo === "tabela" && (
        <div className="hidden sm:block rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-[300px]">Cliente</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead className="text-center">Orçamentos</TableHead>
                <TableHead className="text-right">Total Faturado</TableHead>
                <TableHead>Último Orçamento</TableHead>
                <TableHead className="text-right w-[110px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fichasFiltradas.map(({ cliente, totalOrcamentos, totalFaturado, ultimoOrcamento }) => (
                <TableRow key={cliente.id} className="hover:bg-accent/40 group">
                  <TableCell>
                    <Link href={`/clientes/${cliente.id}`} className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary group-hover:scale-105 transition-transform">
                        {iniciaisCliente(cliente.nome)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground group-hover:text-primary transition-colors leading-tight">
                          {cliente.nome}
                        </p>
                        {cliente.cpf && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {cliente.cpf}
                          </p>
                        )}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5 text-xs">
                      {cliente.telefone ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-foreground">{formatarTelefone(cliente.telefone)}</span>
                          <a
                            href={linkWhatsappCliente(cliente.telefone) ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 p-0.5 rounded hover:bg-emerald-500/10"
                            title="Chamar no WhatsApp"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic text-[11px]">Sem telefone</span>
                      )}
                      {cliente.email && (
                        <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                          {cliente.email}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={totalOrcamentos > 0 ? "secondary" : "outline"} className="text-xs font-medium">
                      {totalOrcamentos} {totalOrcamentos === 1 ? "pedido" : "pedidos"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={cn("text-xs font-bold", totalFaturado > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                      {formatarMoeda(totalFaturado)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {ultimoOrcamento ? formatarData(ultimoOrcamento) : "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        nativeButton={false}
                        render={<Link href={`/clientes/${cliente.id}`} title="Ver ficha completa" />}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <ClienteFormDialog cliente={cliente} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modo Grade / Mobile (sempre cards no mobile, ou quando modo === 'grade' no desktop) */}
      {fichasFiltradas.length > 0 && (modo === "grade" || true) && (
        <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", modo === "tabela" && "sm:hidden")}>
          {fichasFiltradas.map(({ cliente, totalOrcamentos, totalFaturado, ultimoOrcamento }) => (
            <div
              key={cliente.id}
              className="flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 shadow-2xs hover:shadow-md transition-all gap-3"
            >
              {/* Topo do card */}
              <div className="flex items-start justify-between gap-2">
                <Link href={`/clientes/${cliente.id}`} className="flex items-center gap-3 min-w-0 flex-1 group">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary group-hover:scale-105 transition-transform">
                    {iniciaisCliente(cliente.nome)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground group-hover:text-primary transition-colors leading-tight truncate text-sm">
                      {cliente.nome}
                    </p>
                    {cliente.cpf && (
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{cliente.cpf}</p>
                    )}
                  </div>
                </Link>
                <div className="flex items-center gap-0.5 shrink-0">
                  <ClienteFormDialog cliente={cliente} />
                </div>
              </div>

              {/* Informações de contato */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {cliente.telefone ? (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3 text-muted-foreground/80 shrink-0" />
                    <span>{formatarTelefone(cliente.telefone)}</span>
                    <a
                      href={linkWhatsappCliente(cliente.telefone) ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 p-0.5"
                      title="Chamar no WhatsApp"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </a>
                  </div>
                ) : (
                  <span className="italic text-[11px]">Sem telefone</span>
                )}
                {cliente.email && (
                  <div className="flex items-center gap-1 truncate max-w-[200px]">
                    <Mail className="h-3 w-3 text-muted-foreground/80 shrink-0" />
                    <span className="truncate">{cliente.email}</span>
                  </div>
                )}
              </div>

              {/* Métricas do cliente */}
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2.5 text-xs border border-border/40">
                <div>
                  <p className="text-[11px] text-muted-foreground">Orçamentos</p>
                  <p className="font-bold text-foreground text-sm">
                    {totalOrcamentos}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground">Total Faturado</p>
                  <p className={cn("font-bold text-sm", totalFaturado > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                    {formatarMoeda(totalFaturado)}
                  </p>
                </div>
                {ultimoOrcamento && (
                  <div className="col-span-2 pt-1 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Último pedido:</span>
                    <span className="font-medium text-foreground">{formatarData(ultimoOrcamento)}</span>
                  </div>
                )}
              </div>

              {/* Ação: Ver Ficha Completa */}
              <Link
                href={`/clientes/${cliente.id}`}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-background/80 hover:bg-accent py-1.5 text-xs font-semibold text-foreground transition-colors"
              >
                <span>Ver Ficha Completa</span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
