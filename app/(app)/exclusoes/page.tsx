"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useData } from "@/context/data-context"
import { formatarDataHora } from "@/lib/format"
import type { ExclusaoRegistrada } from "@/lib/historico-exclusoes"
import {
  RotateCcw,
  FileText,
  User,
  DollarSign,
  Search,
  ChevronDown,
  ChevronUp,
  History,
} from "lucide-react"

const rotuloTabela: Record<ExclusaoRegistrada["tabela"], string> = {
  orcamentos: "Orçamento",
  clientes: "Cliente",
  lancamentos_financeiros: "Financeiro",
}

const estiloTabela: Record<
  ExclusaoRegistrada["tabela"],
  { badge: string; icone: typeof FileText }
> = {
  orcamentos: {
    badge: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    icone: FileText,
  },
  clientes: {
    badge: "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300",
    icone: User,
  },
  lancamentos_financeiros: {
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    icone: DollarSign,
  },
}

type Estado =
  | { situacao: "carregando" }
  | { situacao: "erro"; mensagem: string }
  | { situacao: "pronto"; itens: ExclusaoRegistrada[] }

export default function ExclusoesPage() {
  const router = useRouter()
  const { recarregarDados } = useData()
  const [estado, setEstado] = useState<Estado>({ situacao: "carregando" })
  const [aberto, setAberto] = useState<string | null>(null)
  const [filtroTabela, setFiltroTabela] = useState<string>("todos")
  const [busca, setBusca] = useState("")
  const [restaurandoId, setRestaurandoId] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    fetch("/api/exclusoes", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 403) throw new Error("Só o dono pode ver o histórico de exclusões.")
        if (!res.ok) throw new Error("Não foi possível carregar o histórico.")
        return (await res.json()) as ExclusaoRegistrada[]
      })
      .then((itens) => ativo && setEstado({ situacao: "pronto", itens }))
      .catch((e: Error) => ativo && setEstado({ situacao: "erro", mensagem: e.message }))
    return () => {
      ativo = false
    }
  }, [])

  const itensFiltrados = useMemo(() => {
    if (estado.situacao !== "pronto") return []
    return estado.itens.filter((item) => {
      if (filtroTabela !== "todos" && item.tabela !== filtroTabela) return false
      if (busca.trim()) {
        const termo = busca.toLowerCase()
        const resumo = item.resumo.toLowerCase()
        const autor = (item.excluidoPorNome ?? "").toLowerCase()
        return resumo.includes(termo) || autor.includes(termo)
      }
      return true
    })
  }, [estado, filtroTabela, busca])

  const contagens = useMemo(() => {
    if (estado.situacao !== "pronto") return { todos: 0, orcamentos: 0, clientes: 0, lancamentos_financeiros: 0 }
    return {
      todos: estado.itens.length,
      orcamentos: estado.itens.filter((i) => i.tabela === "orcamentos").length,
      clientes: estado.itens.filter((i) => i.tabela === "clientes").length,
      lancamentos_financeiros: estado.itens.filter((i) => i.tabela === "lancamentos_financeiros").length,
    }
  }, [estado])

  const handleRestaurar = async (item: ExclusaoRegistrada) => {
    const nomeRotulo = rotuloTabela[item.tabela]
    const confirmado = window.confirm(
      `Deseja realmente recuperar ${nomeRotulo.toLowerCase()} "${item.resumo}" de volta ao sistema?`
    )
    if (!confirmado) return

    setRestaurandoId(item.id)
    try {
      const res = await fetch("/api/exclusoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error ?? "Falha ao restaurar o registro.")
      }

      toast.success(`${nomeRotulo} recuperado com sucesso!`, {
        action:
          item.tabela === "orcamentos"
            ? { label: "Ver Orçamentos", onClick: () => router.push("/orcamentos") }
            : item.tabela === "clientes"
            ? { label: "Ver Clientes", onClick: () => router.push("/clientes") }
            : { label: "Ver Financeiro", onClick: () => router.push("/financeiro") },
      })

      // Remove da lista em tela
      setEstado((prev) =>
        prev.situacao === "pronto"
          ? { ...prev, itens: prev.itens.filter((i) => i.id !== item.id) }
          : prev
      )

      // Atualiza o cache do DataContext em background
      if (recarregarDados) {
        recarregarDados().catch(() => {})
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao restaurar."
      toast.error(msg)
    } finally {
      setRestaurandoId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-black tracking-tight">Histórico de exclusões</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Recupere orçamentos, clientes e lançamentos apagados com um clique.
          </p>
        </div>
      </div>

      {estado.situacao === "pronto" && (
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Abas de filtro */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setFiltroTabela("todos")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                filtroTabela === "todos"
                  ? "bg-primary text-primary-foreground border-primary shadow-xs font-black"
                  : "bg-card text-foreground border-border/80 hover:bg-muted"
              }`}
            >
              <span>Todos</span>
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                filtroTabela === "todos" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
              }`}>
                {contagens.todos}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFiltroTabela("orcamentos")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                filtroTabela === "orcamentos"
                  ? "bg-blue-600 text-white border-blue-600 shadow-xs font-black"
                  : "bg-card text-foreground border-border/80 hover:bg-muted"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Orçamentos</span>
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                filtroTabela === "orcamentos" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
              }`}>
                {contagens.orcamentos}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFiltroTabela("clientes")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                filtroTabela === "clientes"
                  ? "bg-purple-600 text-white border-purple-600 shadow-xs font-black"
                  : "bg-card text-foreground border-border/80 hover:bg-muted"
              }`}
            >
              <User className="h-3.5 w-3.5" />
              <span>Clientes</span>
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                filtroTabela === "clientes" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
              }`}>
                {contagens.clientes}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFiltroTabela("lancamentos_financeiros")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                filtroTabela === "lancamentos_financeiros"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs font-black"
                  : "bg-card text-foreground border-border/80 hover:bg-muted"
              }`}
            >
              <DollarSign className="h-3.5 w-3.5" />
              <span>Financeiro</span>
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                filtroTabela === "lancamentos_financeiros" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
              }`}>
                {contagens.lancamentos_financeiros}
              </span>
            </button>
          </div>

          {/* Campo de Busca */}
          <div className="relative min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar no histórico..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full rounded-xl border border-border bg-card pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
            />
          </div>
        </div>
      )}

      {estado.situacao === "carregando" && (
        <div className="rounded-2xl border border-border/80 bg-card p-8 text-center text-sm text-muted-foreground">
          Carregando histórico de exclusões…
        </div>
      )}

      {estado.situacao === "erro" && (
        <div className="rounded-2xl border border-red-500/30 bg-red-50/50 dark:bg-red-950/30 p-6 text-sm text-red-600 dark:text-red-300">
          {estado.mensagem}
        </div>
      )}

      {estado.situacao === "pronto" && estado.itens.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/80 bg-card p-12 text-center text-sm text-muted-foreground">
          Nada foi apagado desde que o histórico começou a ser guardado.
        </div>
      )}

      {estado.situacao === "pronto" && estado.itens.length > 0 && itensFiltrados.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/80 bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhum registro encontrado para este filtro ou busca.
        </div>
      )}

      {estado.situacao === "pronto" && itensFiltrados.length > 0 && (
        <ul className="flex flex-col gap-3">
          {itensFiltrados.map((item) => {
            const estilo = estiloTabela[item.tabela]
            const Icone = estilo.icone
            const estaRestaurando = restaurandoId === item.id

            return (
              <li
                key={item.id}
                className="rounded-2xl border border-border/80 bg-card p-4 transition-all hover:border-border shadow-2xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-black uppercase tracking-wider ${estilo.badge}`}
                      >
                        <Icone className="h-3 w-3" />
                        <span>{rotuloTabela[item.tabela]}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatarDataHora(item.excluidoEm)}
                      </span>
                    </div>

                    <p className="mt-2 text-base font-bold text-foreground tracking-tight break-words">
                      {item.resumo}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Apagado por{" "}
                      <span className="font-semibold text-foreground/80">
                        {item.excluidoPorNome ?? "usuário desconhecido"}
                      </span>
                    </p>
                  </div>

                  {/* Botão de Recuperar / Restaurar */}
                  <div className="shrink-0 flex items-center gap-2 pt-1 sm:pt-0">
                    <button
                      type="button"
                      disabled={estaRestaurando}
                      onClick={() => handleRestaurar(item)}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black shadow-xs transition-all active:scale-95 disabled:opacity-50 ${
                        item.tabela === "orcamentos"
                          ? "bg-blue-600 hover:bg-blue-700 text-white"
                          : item.tabela === "clientes"
                          ? "bg-purple-600 hover:bg-purple-700 text-white"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white"
                      }`}
                      title={`Recuperar ${rotuloTabela[item.tabela].toLowerCase()} de volta ao sistema`}
                    >
                      <RotateCcw className={`h-3.5 w-3.5 ${estaRestaurando ? "animate-spin" : ""}`} />
                      <span>
                        {estaRestaurando
                          ? "Recuperando..."
                          : `Recuperar ${rotuloTabela[item.tabela]}`}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Acordeão para ver os dados brutos se quiser */}
                <div className="mt-3 pt-2.5 border-t border-border/40 flex flex-col gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-semibold transition-colors"
                    onClick={() => setAberto(aberto === item.id ? null : item.id)}
                  >
                    {aberto === item.id ? (
                      <>
                        <ChevronUp className="h-3 w-3" />
                        <span>Ocultar detalhes</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3" />
                        <span>Ver detalhes do registro</span>
                      </>
                    )}
                  </button>

                  {aberto === item.id && (
                    <pre className="max-h-72 overflow-auto rounded-xl bg-muted/50 p-3 text-xs font-mono text-muted-foreground border border-border/60">
                      {JSON.stringify(item.dados, null, 2)}
                    </pre>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
