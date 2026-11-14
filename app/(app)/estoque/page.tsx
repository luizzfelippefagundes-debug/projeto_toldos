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
import { NovaEntradaDialog } from "@/components/estoque/nova-entrada-dialog"
import { formatarData } from "@/lib/format"
import type { TipoMaterial } from "@/lib/types"
import {
  Boxes,
  AlertTriangle,
  CheckCircle2,
  Search,
  X,
  Plus,
  ArrowDownToLine,
  Truck,
  FileText,
  Tag,
  History,
  Layers,
} from "lucide-react"

const TIPOS_FILTRO: TipoMaterial[] = [
  "Lona",
  "ACM",
  "PVC",
  "Adesivo Vinil",
  "Metalon",
  "Outro",
]

export default function EstoquePage() {
  const { materiais, entradasEstoque } = useData()
  const [abaAtiva, setAbaAtiva] = useState<"materiais" | "entradas">("materiais")
  const [busca, setBusca] = useState("")
  const [filtroTipo, setFiltroTipo] = useState<string>("todos")

  const totalMateriais = materiais.length
  const totalBaixoEstoque = useMemo(
    () => materiais.filter((m) => m.quantidadeEstoque < m.estoqueMinimo).length,
    [materiais]
  )
  const totalNormal = totalMateriais - totalBaixoEstoque
  const totalEntradas = entradasEstoque.length

  // Filtro de materiais
  const materiaisFiltrados = useMemo(() => {
    return materiais.filter((m) => {
      if (filtroTipo === "baixo") {
        if (m.quantidadeEstoque >= m.estoqueMinimo) return false
      } else if (filtroTipo !== "todos" && m.tipo !== filtroTipo) {
        return false
      }

      if (busca.trim()) {
        const termo = busca.trim().toLowerCase()
        const nomeMatch = m.nome.toLowerCase().includes(termo)
        const tipoMatch = m.tipo.toLowerCase().includes(termo)
        return nomeMatch || tipoMatch
      }

      return true
    })
  }, [materiais, busca, filtroTipo])

  // Filtro de histórico de entradas
  const entradasFiltradas = useMemo(() => {
    if (!busca.trim()) return entradasEstoque
    const termo = busca.trim().toLowerCase()
    return entradasEstoque.filter((entrada) => {
      const mat = materiais.find((m) => m.id === entrada.materialId)
      const nomeMatch = mat?.nome.toLowerCase().includes(termo) ?? false
      const fornMatch = entrada.fornecedor?.toLowerCase().includes(termo) ?? false
      const notaMatch = entrada.numeroNota?.toLowerCase().includes(termo) ?? false
      return nomeMatch || fornMatch || notaMatch
    })
  }, [entradasEstoque, materiais, busca])

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Boxes className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-black tracking-tight">Controle de Estoque</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitore o saldo disponível de cada material e o histórico de entradas.
          </p>
        </div>
        <div className="shrink-0">
          <NovaEntradaDialog />
        </div>
      </div>

      {/* Cards de Métricas (Responsivos) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={() => {
            setAbaAtiva("materiais")
            setFiltroTipo("todos")
          }}
          className={`flex flex-col rounded-2xl border p-3 sm:p-4 text-left transition-all ${
            abaAtiva === "materiais" && filtroTipo === "todos"
              ? "border-primary bg-primary/5 shadow-xs"
              : "border-border/80 bg-card hover:bg-muted/40 shadow-2xs"
          }`}
        >
          <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground">
            Total de Materiais
          </span>
          <span className="mt-1 text-xl sm:text-2xl font-black text-foreground">
            {totalMateriais}
          </span>
          <span className="text-[10px] sm:text-[11px] text-muted-foreground/80 mt-0.5">
            {totalNormal} em nível normal
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setAbaAtiva("materiais")
            setFiltroTipo(filtroTipo === "baixo" ? "todos" : "baixo")
          }}
          className={`flex flex-col rounded-2xl border p-3 sm:p-4 text-left transition-all ${
            totalBaixoEstoque > 0
              ? filtroTipo === "baixo" && abaAtiva === "materiais"
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

        <button
          type="button"
          onClick={() => setAbaAtiva("entradas")}
          className={`col-span-2 sm:col-span-1 flex flex-col rounded-2xl border p-3 sm:p-4 text-left transition-all ${
            abaAtiva === "entradas"
              ? "border-primary bg-primary/5 shadow-xs"
              : "border-border/80 bg-card hover:bg-muted/40 shadow-2xs"
          }`}
        >
          <div className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-muted-foreground">
            <History className="h-3.5 w-3.5 text-primary" />
            <span>Histórico Entradas</span>
          </div>
          <span className="mt-1 text-xl sm:text-2xl font-black text-foreground">
            {totalEntradas}
          </span>
          <span className="text-[10px] sm:text-[11px] text-muted-foreground/80 mt-0.5">
            registros de compra/entrada
          </span>
        </button>
      </div>

      {/* Navegador de Abas */}
      <div className="flex items-center border-b border-border/70 pb-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setAbaAtiva("materiais")
              setBusca("")
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-bold border-b-2 transition-all ${
              abaAtiva === "materiais"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Boxes className="h-4 w-4" />
            <span>Saldos de Materiais</span>
            <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground">
              {materiais.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAbaAtiva("entradas")
              setBusca("")
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-bold border-b-2 transition-all ${
              abaAtiva === "entradas"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <ArrowDownToLine className="h-4 w-4" />
            <span>Histórico de Entradas</span>
            <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground">
              {entradasEstoque.length}
            </span>
          </button>
        </div>
      </div>

      {/* Conteúdo da Aba Materiais */}
      {abaAtiva === "materiais" && (
        <div className="flex flex-col gap-4">
          {/* Busca e Filtros de Materiais */}
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar material no estoque por nome ou tipo..."
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

            {/* Chips de filtro */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              <span className="text-xs font-semibold text-muted-foreground mr-1 shrink-0 flex items-center gap-1">
                <Tag className="h-3 w-3" /> Tipo:
              </span>
              <button
                type="button"
                onClick={() => setFiltroTipo("todos")}
                className={`px-3 py-1.5 rounded-full font-medium transition-colors shrink-0 ${
                  filtroTipo === "todos"
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "bg-muted/70 hover:bg-muted text-muted-foreground"
                }`}
              >
                Todos ({totalMateriais})
              </button>

              {totalBaixoEstoque > 0 && (
                <button
                  type="button"
                  onClick={() => setFiltroTipo(filtroTipo === "baixo" ? "todos" : "baixo")}
                  className={`px-3 py-1.5 rounded-full font-medium transition-colors shrink-0 flex items-center gap-1 ${
                    filtroTipo === "baixo"
                      ? "bg-red-600 text-white shadow-2xs"
                      : "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 hover:bg-red-200"
                  }`}
                >
                  <AlertTriangle className="h-3 w-3" />
                  Estoque Baixo ({totalBaixoEstoque})
                </button>
              )}

              {TIPOS_FILTRO.map((tipo) => {
                const count = materiais.filter((m) => m.tipo === tipo).length
                if (count === 0) return null
                return (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => setFiltroTipo(filtroTipo === tipo ? "todos" : tipo)}
                    className={`px-3 py-1.5 rounded-full font-medium transition-colors shrink-0 ${
                      filtroTipo === tipo
                        ? "bg-primary text-primary-foreground shadow-2xs"
                        : "bg-muted/70 hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    {tipo} ({count})
                  </button>
                )
              })}
            </div>
          </div>

          {/* CARDS MOBILE (block md:hidden) */}
          <div className="block md:hidden">
            {materiaisFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 p-8 text-center bg-card/50">
                <Boxes className="h-10 w-10 text-muted-foreground/50 mb-2" />
                <p className="font-semibold text-foreground">Nenhum material encontrado</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Tente alterar os termos de busca ou redefinir os filtros.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {materiaisFiltrados.map((material) => {
                  const baixo = material.quantidadeEstoque < material.estoqueMinimo
                  const unidadeRotulo = material.unidade === "m2" ? "m²" : "un"
                  const pct = Math.min(
                    100,
                    material.estoqueMinimo > 0
                      ? Math.round((material.quantidadeEstoque / (material.estoqueMinimo * 1.5)) * 100)
                      : 100
                  )

                  return (
                    <div
                      key={material.id}
                      className={`flex flex-col rounded-2xl border p-3.5 shadow-2xs transition-colors ${
                        baixo
                          ? "border-red-500/40 bg-card hover:border-red-500/80"
                          : "border-border/80 bg-card hover:border-primary/40"
                      }`}
                    >
                      {/* Topo do Card */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-sm sm:text-base text-foreground leading-snug break-words">
                            {material.nome}
                          </h3>
                        </div>
                        <Badge variant="secondary" className="shrink-0 text-[10px] font-semibold">
                          {material.tipo}
                        </Badge>
                      </div>

                      {/* Status e Quantidade */}
                      <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-medium text-muted-foreground">
                            Saldo em Estoque
                          </span>
                          <span
                            className={`text-lg font-black ${
                              baixo ? "text-red-600 dark:text-red-400" : "text-foreground"
                            }`}
                          >
                            {material.quantidadeEstoque} {unidadeRotulo}
                          </span>
                        </div>

                        <div className="flex flex-col items-end">
                          <span className="text-[11px] font-medium text-muted-foreground">
                            Estoque Mínimo
                          </span>
                          <span className="text-xs font-semibold text-muted-foreground">
                            {material.estoqueMinimo} {unidadeRotulo}
                          </span>
                        </div>
                      </div>

                      {/* Barra visual de estoque */}
                      <div className="mt-2 w-full bg-muted/70 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            baixo ? "bg-red-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.max(5, pct)}%` }}
                        />
                      </div>

                      {/* Rodapé com Alerta e Ação Rápida */}
                      <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between gap-2">
                        {baixo ? (
                          <Badge
                            variant="destructive"
                            className="gap-1 text-[11px] px-2 py-0.5 font-semibold"
                          >
                            <AlertTriangle className="h-3 w-3" />
                            Estoque Baixo
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="gap-1 text-[11px] px-2 py-0.5 font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Normal
                          </Badge>
                        )}

                        <NovaEntradaDialog
                          materialIdInicial={material.id}
                          trigger={
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2.5 text-xs font-semibold gap-1.5 rounded-lg border-border/80 hover:bg-muted"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Dar Entrada
                            </Button>
                          }
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* TABELA DESKTOP (hidden md:block) */}
          <div className="hidden md:block rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="font-bold text-foreground">Material</TableHead>
                  <TableHead className="font-bold text-foreground">Tipo</TableHead>
                  <TableHead className="font-bold text-foreground">Saldo em Estoque</TableHead>
                  <TableHead className="font-bold text-foreground">Estoque Mínimo</TableHead>
                  <TableHead className="font-bold text-foreground">Situação</TableHead>
                  <TableHead className="w-32 text-right font-bold text-foreground">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materiaisFiltrados.map((material) => {
                  const baixo = material.quantidadeEstoque < material.estoqueMinimo
                  const unidadeRotulo = material.unidade === "m2" ? "m²" : "un"

                  return (
                    <TableRow key={material.id} className="hover:bg-muted/30">
                      <TableCell className="font-semibold text-foreground">
                        {material.nome}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-medium text-xs">
                          {material.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`font-black ${
                            baixo ? "text-red-600 dark:text-red-400" : "text-foreground"
                          }`}
                        >
                          {material.quantidadeEstoque} {unidadeRotulo}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm font-medium">
                        {material.estoqueMinimo} {unidadeRotulo}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={baixo ? "destructive" : "secondary"}
                          className={`font-semibold text-xs gap-1 ${
                            !baixo
                              ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                              : ""
                          }`}
                        >
                          {baixo ? (
                            <>
                              <AlertTriangle className="h-3 w-3" />
                              Estoque baixo
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-3 w-3" />
                              Normal
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <NovaEntradaDialog
                          materialIdInicial={material.id}
                          trigger={
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2.5 text-xs font-semibold gap-1.5"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Entrada
                            </Button>
                          }
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
                {materiaisFiltrados.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-28 text-center text-sm text-muted-foreground">
                      Nenhum material encontrado no estoque para os filtros aplicados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Conteúdo da Aba Histórico de Entradas */}
      {abaAtiva === "entradas" && (
        <div className="flex flex-col gap-4">
          {/* Busca de Entradas */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar histórico por material, fornecedor ou nota fiscal..."
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

          {/* CARDS MOBILE (block md:hidden) */}
          <div className="block md:hidden">
            {entradasFiltradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 p-8 text-center bg-card/50">
                <History className="h-10 w-10 text-muted-foreground/50 mb-2" />
                <p className="font-semibold text-foreground">Nenhuma entrada encontrada</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Não foram encontrados registros para o termo pesquisado.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {entradasFiltradas.map((entrada) => {
                  const material = materiais.find((m) => m.id === entrada.materialId)
                  const unidadeRotulo = material?.unidade === "m2" ? "m²" : "un"

                  return (
                    <div
                      key={entrada.id}
                      className="flex flex-col rounded-2xl border border-border/80 bg-card p-3.5 shadow-2xs hover:border-primary/40 transition-colors"
                    >
                      {/* Topo: Nome do Material e Data */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-sm sm:text-base text-foreground leading-snug break-words">
                            {material?.nome ?? "Material não identificado"}
                          </h3>
                          <span className="text-xs text-muted-foreground mt-0.5 block">
                            {formatarData(entrada.data)}
                          </span>
                        </div>
                        <Badge className="shrink-0 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white">
                          +{entrada.quantidade} {unidadeRotulo}
                        </Badge>
                      </div>

                      {/* Fornecedor e Nota Fiscal */}
                      <div className="mt-3 pt-2.5 border-t border-border/50 flex flex-col gap-1.5 text-xs">
                        {entrada.fornecedor && (
                          <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                            <Truck className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                            <span className="truncate">Fornecedor: {entrada.fornecedor}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                          <span>
                            {entrada.comNotaFiscal
                              ? `Nota Fiscal: ${entrada.numeroNota || "Sim (s/ nº)"}`
                              : "Sem nota fiscal"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* TABELA DESKTOP (hidden md:block) */}
          <div className="hidden md:block rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="font-bold text-foreground">Data</TableHead>
                  <TableHead className="font-bold text-foreground">Material</TableHead>
                  <TableHead className="font-bold text-foreground">Quantidade Entrada</TableHead>
                  <TableHead className="font-bold text-foreground">Fornecedor</TableHead>
                  <TableHead className="font-bold text-foreground">Nota Fiscal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entradasFiltradas.map((entrada) => {
                  const material = materiais.find((m) => m.id === entrada.materialId)
                  const unidadeRotulo = material?.unidade === "m2" ? "m²" : "un"

                  return (
                    <TableRow key={entrada.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium text-foreground">
                        {formatarData(entrada.data)}
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">
                        {material?.nome ?? "—"}
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          +{entrada.quantidade} {unidadeRotulo}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {entrada.fornecedor ?? "—"}
                      </TableCell>
                      <TableCell>
                        {entrada.comNotaFiscal ? (
                          <Badge variant="outline" className="font-medium text-xs">
                            Nº {entrada.numeroNota ?? "—"}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sem nota</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {entradasFiltradas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-28 text-center text-sm text-muted-foreground">
                      Nenhuma entrada encontrada para os filtros aplicados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
