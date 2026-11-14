"use client"

import { useMemo, useState } from "react"
import { useData } from "@/context/data-context"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatarMoeda } from "@/lib/format"
import { AcabamentoFormDialog } from "@/components/acabamentos/acabamento-form-dialog"
import { Sparkles, Search, X, Pencil, Tag, Layers } from "lucide-react"

const UNIDADES_FILTRO = ["un", "m", "m²", "peça"]

export default function AcabamentosPage() {
  const { acabamentos } = useData()
  const [busca, setBusca] = useState("")
  const [filtroUnidade, setFiltroUnidade] = useState<string>("todas")

  const totalAcabamentos = acabamentos.length

  const mediaPreco = useMemo(() => {
    if (totalAcabamentos === 0) return 0
    const soma = acabamentos.reduce((acc, a) => acc + (a.precoUnitario || 0), 0)
    return soma / totalAcabamentos
  }, [acabamentos, totalAcabamentos])

  const acabamentosFiltrados = useMemo(() => {
    return acabamentos.filter((a) => {
      if (filtroUnidade !== "todas" && a.unidade !== filtroUnidade) {
        return false
      }
      if (busca.trim()) {
        const termo = busca.trim().toLowerCase()
        const nomeMatch = a.nome.toLowerCase().includes(termo)
        const unidadeMatch = a.unidade.toLowerCase().includes(termo)
        return nomeMatch || unidadeMatch
      }
      return true
    })
  }, [acabamentos, busca, filtroUnidade])

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-black tracking-tight">Acabamentos</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie os acabamentos e valores unitários disponíveis para os orçamentos.
          </p>
        </div>
        <div className="shrink-0">
          <AcabamentoFormDialog />
        </div>
      </div>

      {/* Cards de Métricas (Responsivos) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={() => setFiltroUnidade("todas")}
          className={`flex flex-col rounded-2xl border p-3 sm:p-4 text-left transition-all ${
            filtroUnidade === "todas"
              ? "border-primary bg-primary/5 shadow-xs"
              : "border-border/80 bg-card hover:bg-muted/40 shadow-2xs"
          }`}
        >
          <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground">
            Total Cadastrado
          </span>
          <span className="mt-1 text-xl sm:text-2xl font-black text-foreground">
            {totalAcabamentos}
          </span>
          <span className="text-[10px] sm:text-[11px] text-muted-foreground/80 mt-0.5">
            tipos de acabamento
          </span>
        </button>

        <div className="flex flex-col rounded-2xl border border-border/80 bg-card p-3 sm:p-4 shadow-2xs">
          <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground">
            Preço Médio
          </span>
          <span className="mt-1 text-xl sm:text-2xl font-black text-foreground">
            {formatarMoeda(mediaPreco)}
          </span>
          <span className="text-[10px] sm:text-[11px] text-muted-foreground/80 mt-0.5">
            por unidade cadastrada
          </span>
        </div>

        <div className="col-span-2 sm:col-span-1 flex flex-col rounded-2xl border border-border/80 bg-card p-3 sm:p-4 shadow-2xs">
          <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground">
            Unidades de Medida
          </span>
          <span className="mt-1 text-xl sm:text-2xl font-black text-foreground">
            {UNIDADES_FILTRO.length}
          </span>
          <span className="text-[10px] sm:text-[11px] text-muted-foreground/80 mt-0.5">
            un, m, m², peça
          </span>
        </div>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar acabamento por nome ou unidade..."
            className="pl-9 pr-9 h-11 rounded-xl bg-card border-border/80 text-sm focus-visible:ring-primary/30"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full"
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Chips de Filtro por Unidade */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          <span className="text-xs font-semibold text-muted-foreground mr-1 shrink-0 flex items-center gap-1">
            <Tag className="h-3 w-3" /> Unidade:
          </span>
          <button
            type="button"
            onClick={() => setFiltroUnidade("todas")}
            className={`px-3 py-1.5 rounded-full font-medium transition-colors shrink-0 ${
              filtroUnidade === "todas"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "bg-muted/70 hover:bg-muted text-muted-foreground"
            }`}
          >
            Todas ({totalAcabamentos})
          </button>
          {UNIDADES_FILTRO.map((unidade) => {
            const qtd = acabamentos.filter((a) => a.unidade === unidade).length
            return (
              <button
                key={unidade}
                type="button"
                onClick={() => setFiltroUnidade(filtroUnidade === unidade ? "todas" : unidade)}
                className={`px-3 py-1.5 rounded-full font-medium transition-colors shrink-0 ${
                  filtroUnidade === unidade
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "bg-muted/70 hover:bg-muted text-muted-foreground"
                }`}
              >
                {unidade} ({qtd})
              </button>
            )
          })}
        </div>
      </div>

      {/* FEED MOBILE (Cards individuais - block md:hidden) */}
      <div className="block md:hidden">
        {acabamentosFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 p-8 text-center bg-card/50">
            <Layers className="h-10 w-10 text-muted-foreground/50 mb-2" />
            <p className="font-semibold text-foreground">Nenhum acabamento encontrado</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Tente ajustar sua busca ou limpar os filtros para visualizar outros acabamentos.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {acabamentosFiltrados.map((acabamento) => (
              <div
                key={acabamento.id}
                className="flex flex-col rounded-2xl border border-border/80 bg-card p-3.5 shadow-2xs hover:border-primary/40 transition-colors"
              >
                {/* Linha superior: Nome e Unidade */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-sm sm:text-base text-foreground leading-snug break-words">
                      {acabamento.nome}
                    </h3>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-[10px] font-semibold uppercase tracking-wider">
                    {acabamento.unidade}
                  </Badge>
                </div>

                {/* Preço Unitário */}
                <div className="mt-3 flex items-baseline justify-between border-t border-border/50 pt-2.5">
                  <span className="text-xs font-medium text-muted-foreground">Preço unitário:</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-black text-foreground">
                      {formatarMoeda(acabamento.precoUnitario)}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">
                      / {acabamento.unidade}
                    </span>
                  </div>
                </div>

                {/* Botão de Ação */}
                <div className="mt-3 pt-2.5 border-t border-border/50 flex justify-end">
                  <AcabamentoFormDialog
                    acabamento={acabamento}
                    trigger={
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 text-xs font-semibold gap-1.5 rounded-lg border-border/80 hover:bg-muted"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* TABELA DESKTOP (hidden md:block) */}
      <div className="hidden md:block rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="font-bold text-foreground">Nome</TableHead>
              <TableHead className="font-bold text-foreground">Preço Unitário</TableHead>
              <TableHead className="font-bold text-foreground">Unidade</TableHead>
              <TableHead className="w-16 text-right font-bold text-foreground">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {acabamentosFiltrados.map((acabamento) => (
              <TableRow key={acabamento.id} className="hover:bg-muted/30">
                <TableCell className="font-semibold text-foreground">
                  {acabamento.nome}
                </TableCell>
                <TableCell className="font-medium">
                  {formatarMoeda(acabamento.precoUnitario)}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="font-semibold text-xs">
                    {acabamento.unidade}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <AcabamentoFormDialog
                    acabamento={acabamento}
                    trigger={
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
            {acabamentosFiltrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-28 text-center text-sm text-muted-foreground">
                  Nenhum acabamento encontrado para os filtros atuais.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
