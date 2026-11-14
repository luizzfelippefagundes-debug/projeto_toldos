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
import { ServicoFormDialog } from "@/components/mao-de-obra/servico-form-dialog"
import type { FormaCobranca } from "@/lib/types"
import { Wrench, Search, X, Pencil, Hammer, Tag, Clock, Layers } from "lucide-react"

const rotulos: Record<FormaCobranca, string> = {
  fixo: "Valor fixo",
  hora: "Por hora",
  m2: "Por m²",
  percentual: "% sobre material",
}

const FORMAS_FILTRO: FormaCobranca[] = ["m2", "hora", "fixo", "percentual"]

function formatarValor(formaCobranca: FormaCobranca, valor: number) {
  if (formaCobranca === "percentual") return `${valor}%`
  const base = formatarMoeda(valor)
  if (formaCobranca === "hora") return `${base} / hora`
  if (formaCobranca === "m2") return `${base} / m²`
  return base
}

export default function MaoDeObraPage() {
  const { servicos } = useData()
  const [busca, setBusca] = useState("")
  const [filtroForma, setFiltroForma] = useState<string>("todas")

  const totalServicos = servicos.length

  const totalM2 = useMemo(
    () => servicos.filter((s) => s.formaCobranca === "m2").length,
    [servicos]
  )
  const totalHora = useMemo(
    () => servicos.filter((s) => s.formaCobranca === "hora").length,
    [servicos]
  )
  const totalFixoOuPerc = totalServicos - totalM2 - totalHora

  const servicosFiltrados = useMemo(() => {
    return servicos.filter((s) => {
      if (filtroForma !== "todas" && s.formaCobranca !== filtroForma) {
        return false
      }
      if (busca.trim()) {
        const termo = busca.trim().toLowerCase()
        const nomeMatch = s.nome.toLowerCase().includes(termo)
        const cobrancaMatch = rotulos[s.formaCobranca].toLowerCase().includes(termo)
        const ferrMatch = s.ferramentas?.toLowerCase().includes(termo) ?? false
        return nomeMatch || cobrancaMatch || ferrMatch
      }
      return true
    })
  }, [servicos, busca, filtroForma])

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Wrench className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-black tracking-tight">Mão de Obra e Serviços</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre os tipos de serviço e como cada um é cobrado nos orçamentos.
          </p>
        </div>
        <div className="shrink-0">
          <ServicoFormDialog />
        </div>
      </div>

      {/* Cards de Métricas (Responsivos) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={() => setFiltroForma("todas")}
          className={`flex flex-col rounded-2xl border p-3 sm:p-4 text-left transition-all ${
            filtroForma === "todas"
              ? "border-primary bg-primary/5 shadow-xs"
              : "border-border/80 bg-card hover:bg-muted/40 shadow-2xs"
          }`}
        >
          <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground">
            Total Cadastrado
          </span>
          <span className="mt-1 text-xl sm:text-2xl font-black text-foreground">
            {totalServicos}
          </span>
          <span className="text-[10px] sm:text-[11px] text-muted-foreground/80 mt-0.5">
            serviços e operações
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFiltroForma(filtroForma === "m2" ? "todas" : "m2")}
          className={`flex flex-col rounded-2xl border p-3 sm:p-4 text-left transition-all ${
            filtroForma === "m2"
              ? "border-primary bg-primary/5 shadow-xs"
              : "border-border/80 bg-card hover:bg-muted/40 shadow-2xs"
          }`}
        >
          <div className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-muted-foreground">
            <Layers className="h-3.5 w-3.5 text-primary" />
            <span>Por Metro²</span>
          </div>
          <span className="mt-1 text-xl sm:text-2xl font-black text-foreground">
            {totalM2}
          </span>
          <span className="text-[10px] sm:text-[11px] text-muted-foreground/80 mt-0.5">
            cobrados por área
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFiltroForma(filtroForma === "hora" ? "todas" : "hora")}
          className={`col-span-2 sm:col-span-1 flex flex-col rounded-2xl border p-3 sm:p-4 text-left transition-all ${
            filtroForma === "hora"
              ? "border-primary bg-primary/5 shadow-xs"
              : "border-border/80 bg-card hover:bg-muted/40 shadow-2xs"
          }`}
        >
          <div className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-muted-foreground">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span>Por Hora / Fixo</span>
          </div>
          <span className="mt-1 text-xl sm:text-2xl font-black text-foreground">
            {totalHora + totalFixoOuPerc}
          </span>
          <span className="text-[10px] sm:text-[11px] text-muted-foreground/80 mt-0.5">
            tempo ou valor pré-fixado
          </span>
        </button>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar serviço por nome, forma de cobrança ou ferramentas..."
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

        {/* Chips de Filtro por Forma de Cobrança */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          <span className="text-xs font-semibold text-muted-foreground mr-1 shrink-0 flex items-center gap-1">
            <Tag className="h-3 w-3" /> Cobrança:
          </span>
          <button
            type="button"
            onClick={() => setFiltroForma("todas")}
            className={`px-3 py-1.5 rounded-full font-medium transition-colors shrink-0 ${
              filtroForma === "todas"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "bg-muted/70 hover:bg-muted text-muted-foreground"
            }`}
          >
            Todas ({totalServicos})
          </button>
          {FORMAS_FILTRO.map((forma) => {
            const qtd = servicos.filter((s) => s.formaCobranca === forma).length
            return (
              <button
                key={forma}
                type="button"
                onClick={() => setFiltroForma(filtroForma === forma ? "todas" : forma)}
                className={`px-3 py-1.5 rounded-full font-medium transition-colors shrink-0 ${
                  filtroForma === forma
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "bg-muted/70 hover:bg-muted text-muted-foreground"
                }`}
              >
                {rotulos[forma]} ({qtd})
              </button>
            )
          })}
        </div>
      </div>

      {/* FEED MOBILE (Cards individuais - block md:hidden) */}
      <div className="block md:hidden">
        {servicosFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 p-8 text-center bg-card/50">
            <Wrench className="h-10 w-10 text-muted-foreground/50 mb-2" />
            <p className="font-semibold text-foreground">Nenhum serviço encontrado</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Tente pesquisar com outro termo ou redefinir os filtros de cobrança.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {servicosFiltrados.map((servico) => (
              <div
                key={servico.id}
                className="flex flex-col rounded-2xl border border-border/80 bg-card p-3.5 shadow-2xs hover:border-primary/40 transition-colors"
              >
                {/* Linha superior: Nome e Forma de Cobrança */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-sm sm:text-base text-foreground leading-snug break-words">
                      {servico.nome}
                    </h3>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-[10px] font-semibold">
                    {rotulos[servico.formaCobranca]}
                  </Badge>
                </div>

                {/* Valor Formatado */}
                <div className="mt-3 flex items-baseline justify-between border-t border-border/50 pt-2.5">
                  <span className="text-xs font-medium text-muted-foreground">Valor cobrado:</span>
                  <span className="text-lg font-black text-foreground">
                    {formatarValor(servico.formaCobranca, servico.valor)}
                  </span>
                </div>

                {/* Ferramentas necessárias (se houver) */}
                {servico.ferramentas && (
                  <div className="mt-2.5 flex items-start gap-1.5 rounded-xl bg-muted/50 p-2 text-xs text-muted-foreground">
                    <Hammer className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary/80" />
                    <span className="leading-relaxed break-words font-medium">
                      {servico.ferramentas}
                    </span>
                  </div>
                )}

                {/* Botão de Ação */}
                <div className="mt-3 pt-2.5 border-t border-border/50 flex justify-end">
                  <ServicoFormDialog
                    servico={servico}
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
              <TableHead className="font-bold text-foreground">Serviço</TableHead>
              <TableHead className="font-bold text-foreground">Forma de Cobrança</TableHead>
              <TableHead className="font-bold text-foreground">Valor</TableHead>
              <TableHead className="font-bold text-foreground">Ferramentas Necessárias</TableHead>
              <TableHead className="w-16 text-right font-bold text-foreground">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {servicosFiltrados.map((servico) => (
              <TableRow key={servico.id} className="hover:bg-muted/30">
                <TableCell className="font-semibold text-foreground">
                  {servico.nome}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="font-medium text-xs">
                    {rotulos[servico.formaCobranca]}
                  </Badge>
                </TableCell>
                <TableCell className="font-bold text-foreground">
                  {formatarValor(servico.formaCobranca, servico.valor)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                  {servico.ferramentas || "—"}
                </TableCell>
                <TableCell className="text-right">
                  <ServicoFormDialog
                    servico={servico}
                    trigger={
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
            {servicosFiltrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-28 text-center text-sm text-muted-foreground">
                  Nenhum serviço encontrado para os filtros atuais.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
