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
import { MaterialFormDialog } from "@/components/materiais/material-form-dialog"
import {
  Search,
  Package,
  AlertTriangle,
  CheckCircle2,
  X,
  Pencil,
} from "lucide-react"
import type { TipoMaterial } from "@/lib/types"

const TIPOS_FILTRO: TipoMaterial[] = [
  "Lona",
  "ACM",
  "PVC",
  "Adesivo Vinil",
  "Metalon",
  "Outro",
]

export default function MateriaisPage() {
  const { materiais } = useData()
  const [busca, setBusca] = useState("")
  const [filtroTipo, setFiltroTipo] = useState<string>("todos")

  const totalMateriais = materiais.length
  const totalBaixoEstoque = useMemo(
    () => materiais.filter((m) => m.quantidadeEstoque < m.estoqueMinimo).length,
    [materiais]
  )
  const totalNormal = totalMateriais - totalBaixoEstoque

  const materiaisFiltrados = useMemo(() => {
    return materiais.filter((m) => {
      // Filtro por tipo ou estoque baixo
      if (filtroTipo === "baixo") {
        if (m.quantidadeEstoque >= m.estoqueMinimo) return false
      } else if (filtroTipo !== "todos" && m.tipo !== filtroTipo) {
        return false
      }

      // Busca por nome ou tipo
      if (busca.trim()) {
        const termo = busca.trim().toLowerCase()
        const nomeMatch = m.nome.toLowerCase().includes(termo)
        const tipoMatch = m.tipo.toLowerCase().includes(termo)
        return nomeMatch || tipoMatch
      }

      return true
    })
  }, [materiais, busca, filtroTipo])

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-black tracking-tight">Materiais</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre os materiais usados nos orçamentos e no controle de estoque.
          </p>
        </div>
        <div className="shrink-0">
          <MaterialFormDialog />
        </div>
      </div>

      {/* Cards de Métricas de Estoque (Responsivos) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={() => setFiltroTipo("todos")}
          className={`flex flex-col rounded-2xl border p-3 sm:p-4 text-left transition-all ${
            filtroTipo === "todos"
              ? "border-primary bg-primary/5 shadow-xs"
              : "border-border/80 bg-card hover:bg-muted/40 shadow-2xs"
          }`}
        >
          <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground">
            Total Cadastrado
          </span>
          <span className="mt-1 text-xl sm:text-2xl font-black text-foreground">
            {totalMateriais}
          </span>
          <span className="text-[10px] sm:text-[11px] text-muted-foreground/80 mt-0.5">
            itens no catálogo
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFiltroTipo("todos")}
          className="flex flex-col rounded-2xl border border-border/80 bg-card p-3 sm:p-4 text-left shadow-2xs"
        >
          <div className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Estoque Normal</span>
          </div>
          <span className="mt-1 text-xl sm:text-2xl font-black text-foreground">
            {totalNormal}
          </span>
          <span className="text-[10px] sm:text-[11px] text-muted-foreground/80 mt-0.5">
            acima do mínimo
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFiltroTipo(filtroTipo === "baixo" ? "todos" : "baixo")}
          className={`col-span-2 sm:col-span-1 flex flex-col rounded-2xl border p-3 sm:p-4 text-left transition-all ${
            totalBaixoEstoque > 0
              ? filtroTipo === "baixo"
                ? "border-red-500 bg-red-50 dark:bg-red-950/40 shadow-xs"
                : "border-red-500/40 bg-red-50/50 dark:bg-red-950/20 hover:border-red-500/70 shadow-2xs"
              : "border-border/80 bg-card shadow-2xs"
          }`}
        >
          <div className="flex items-center gap-1 text-[11px] sm:text-xs font-bold text-red-600 dark:text-red-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Estoque Baixo</span>
          </div>
          <span className="mt-1 text-xl sm:text-2xl font-black text-red-600 dark:text-red-400">
            {totalBaixoEstoque}
          </span>
          <span className="text-[10px] sm:text-[11px] text-red-600/80 dark:text-red-400/80 mt-0.5 font-medium">
            {totalBaixoEstoque > 0 ? "precisam de reposição" : "nenhum item em falta"}
          </span>
        </button>
      </div>

      {/* Barra de Busca + Pílulas de Filtro por Categoria */}
      <div className="flex flex-col gap-2.5">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar material por nome ou tipo..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 pr-9 rounded-xl h-10 text-sm shadow-2xs bg-card"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Pílulas deslizantes horizontais no Mobile */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setFiltroTipo("todos")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 border transition-all ${
              filtroTipo === "todos"
                ? "bg-primary text-primary-foreground border-primary shadow-xs font-black"
                : "bg-card text-foreground border-border/80 hover:bg-muted"
            }`}
          >
            Todos ({totalMateriais})
          </button>

          {totalBaixoEstoque > 0 && (
            <button
              type="button"
              onClick={() => setFiltroTipo("baixo")}
              className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 border transition-all ${
                filtroTipo === "baixo"
                  ? "bg-red-600 text-white border-red-600 shadow-xs font-black"
                  : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/20"
              }`}
            >
              ⚠ Estoque Baixo ({totalBaixoEstoque})
            </button>
          )}

          {TIPOS_FILTRO.map((tipo) => {
            const count = materiais.filter((m) => m.tipo === tipo).length
            if (count === 0) return null
            const ativo = filtroTipo === tipo
            return (
              <button
                key={tipo}
                type="button"
                onClick={() => setFiltroTipo(ativo ? "todos" : tipo)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 border transition-all ${
                  ativo
                    ? "bg-primary text-primary-foreground border-primary shadow-xs font-black"
                    : "bg-card text-foreground border-border/80 hover:bg-muted"
                }`}
              >
                <span>{tipo}</span>
                <span className="ml-1 opacity-70 text-[10px]">({count})</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Visualização MOBILE: Cartões com layout 100% responsivo (SEM tabela cortada) */}
      <div className="block md:hidden flex flex-col gap-2.5">
        {materiaisFiltrados.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-card p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <Package className="h-8 w-8 text-muted-foreground/40" />
            <p className="font-semibold text-foreground">Nenhum material encontrado</p>
            <p className="text-xs">
              {busca ? `Nenhum resultado para "${busca}".` : "Nenhum material cadastrado nesta categoria."}
            </p>
            {(busca || filtroTipo !== "todos") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBusca("")
                  setFiltroTipo("todos")
                }}
                className="mt-2 text-xs rounded-xl"
              >
                Limpar filtros
              </Button>
            )}
          </div>
        ) : (
          materiaisFiltrados.map((material) => {
            const baixo = material.quantidadeEstoque < material.estoqueMinimo
            const unidadeLabel = material.unidade === "m2" ? "m²" : "un"

            return (
              <div
                key={material.id}
                className={`rounded-2xl border p-3.5 shadow-2xs transition-all flex flex-col gap-2.5 ${
                  baixo
                    ? "border-red-500/40 bg-red-50/30 dark:bg-red-950/20"
                    : "border-border/80 bg-card"
                }`}
              >
                {/* Linha 1: Nome do Material + Botão Editar */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-sm text-foreground leading-snug break-words">
                      {material.nome}
                    </h3>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0">
                        {material.tipo}
                      </Badge>
                      <span className="text-xs font-black text-foreground">
                        {formatarMoeda(material.precoUnitario)}
                        <span className="text-muted-foreground font-normal text-[11px]">
                          {" "}/ {unidadeLabel}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Botão de Edição Rápida */}
                  <div className="shrink-0">
                    <MaterialFormDialog
                      material={material}
                      trigger={
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 px-2.5 text-xs font-bold rounded-xl border-border/80 shadow-2xs active:scale-95"
                        >
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                          <span>Editar</span>
                        </Button>
                      }
                    />
                  </div>
                </div>

                {/* Linha 2: Indicador de Estoque Atual e Mínimo */}
                <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground text-[11px]">Estoque:</span>
                  {baixo ? (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-red-500/15 border border-red-500/30 px-2 py-0.5 text-xs font-bold text-red-600 dark:text-red-400">
                      <span>⚠</span>
                      <span>
                        {material.quantidadeEstoque} {unidadeLabel} (mín. {material.estoqueMinimo})
                      </span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-muted/60 border border-border/60 px-2 py-0.5 text-xs font-semibold text-foreground">
                      <span>✓</span>
                      <span>
                        {material.quantidadeEstoque} {unidadeLabel}
                        {material.estoqueMinimo > 0 && ` (mín. ${material.estoqueMinimo})`}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Visualização DESKTOP: Tabela tradicional completa */}
      <div className="hidden md:block rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Preço Unitário</TableHead>
              <TableHead>Estoque Atual</TableHead>
              <TableHead>Estoque Mínimo</TableHead>
              <TableHead className="w-12 text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {materiaisFiltrados.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  Nenhum material encontrado para &quot;{busca}&quot;.
                </TableCell>
              </TableRow>
            ) : (
              materiaisFiltrados.map((material) => {
                const baixo = material.quantidadeEstoque < material.estoqueMinimo
                const unidadeLabel = material.unidade === "m2" ? "m²" : "un"

                return (
                  <TableRow key={material.id} className="hover:bg-muted/40">
                    <TableCell className="font-semibold text-foreground">
                      {material.nome}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-medium">
                        {material.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold text-foreground">
                      {formatarMoeda(material.precoUnitario)}
                      <span className="text-xs text-muted-foreground font-normal">
                        {" "}/ {unidadeLabel}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={baixo ? "destructive" : "secondary"} className="font-bold">
                        {material.quantidadeEstoque} {unidadeLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {material.estoqueMinimo} {unidadeLabel}
                    </TableCell>
                    <TableCell className="text-right">
                      <MaterialFormDialog material={material} />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
