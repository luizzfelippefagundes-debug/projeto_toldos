"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatarDataHora } from "@/lib/format"
import { linkWhatsapp } from "@/lib/whatsapp"
import { ExternalLink, FileText, Images, Loader2, MessageCircle, RefreshCw, Store, Boxes } from "lucide-react"
import type { ResumoPedidoLoja } from "@/lib/loja-orcamento"

const URL_DO_SITE = "https://toldosprint.com.br"

interface PedidoSite {
  id: string
  numero: number
  numeroFormatado: string
  criadoEm: string
  status: string
  novo: boolean
  totalFechado: number | null
  cliente: { id: string | null; nome: string; telefone: string }
  resumo: ResumoPedidoLoja
}

type Filtro = "todos" | "novos" | "andamento" | "fechados"

function rotuloStatus(p: PedidoSite) {
  if (p.status === "fechado") return { texto: "Fechado", classe: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" }
  if (p.status === "cancelado") return { texto: "Cancelado", classe: "bg-muted text-muted-foreground" }
  if (p.novo) return { texto: "Novo", classe: "bg-sky-500/10 text-sky-700 border-sky-500/30" }
  return { texto: "Em andamento", classe: "bg-amber-500/10 text-amber-700 border-amber-500/30" }
}

export default function SiteLojaPage() {
  const [pedidos, setPedidos] = useState<PedidoSite[] | null>(null)
  const [erro, setErro] = useState("")
  const [carregando, setCarregando] = useState(false)
  const [filtro, setFiltro] = useState<Filtro>("todos")

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const r = await fetch("/api/site-loja/pedidos", { cache: "no-store" })
      if (!r.ok) throw new Error(`Erro ${r.status}`)
      const d = (await r.json()) as { pedidos: PedidoSite[] }
      setPedidos(d.pedidos)
      setErro("")
    } catch {
      setErro("Não foi possível carregar os pedidos do site. Tente atualizar.")
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
    // Pedido novo aparece sozinho, sem precisar recarregar a tela.
    const t = setInterval(carregar, 45_000)
    return () => clearInterval(t)
  }, [carregar])

  const contagem = useMemo(() => {
    const lista = pedidos ?? []
    return {
      novos: lista.filter((p) => p.novo).length,
      andamento: lista.filter((p) => p.status === "aberto" && !p.novo).length,
      fechados: lista.filter((p) => p.status === "fechado").length,
      total: lista.length,
    }
  }, [pedidos])

  const lista = useMemo(() => {
    const todos = pedidos ?? []
    if (filtro === "novos") return todos.filter((p) => p.novo)
    if (filtro === "andamento") return todos.filter((p) => p.status === "aberto" && !p.novo)
    if (filtro === "fechados") return todos.filter((p) => p.status === "fechado")
    return todos
  }, [pedidos, filtro])

  const abas: { id: Filtro; rotulo: string; n: number }[] = [
    { id: "todos", rotulo: "Todos", n: contagem.total },
    { id: "novos", rotulo: "Novos", n: contagem.novos },
    { id: "andamento", rotulo: "Em andamento", n: contagem.andamento },
    { id: "fechados", rotulo: "Fechados", n: contagem.fechados },
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Store className="h-6 w-6" /> Site da loja
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pedidos de orçamento que chegam pelo site. Cada um já entra no sistema como orçamento aberto.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={carregar} disabled={carregando}>
            {carregando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Atualizar
          </Button>
          <Button variant="outline" size="sm" nativeButton={false} render={<a href={URL_DO_SITE} target="_blank" rel="noopener noreferrer" />}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Ver o site
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Novos, esperando resposta</p>
            <p className="mt-1 text-3xl font-bold text-sky-700">{contagem.novos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Em andamento</p>
            <p className="mt-1 text-3xl font-bold">{contagem.andamento}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Fechados</p>
            <p className="mt-1 text-3xl font-bold text-emerald-700">{contagem.fechados}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pedidos do site</CardTitle>
          <div className="flex flex-wrap gap-1.5 pt-2" role="tablist" aria-label="Filtrar pedidos">
            {abas.map((a) => (
              <button
                key={a.id}
                type="button"
                role="tab"
                aria-selected={filtro === a.id}
                onClick={() => setFiltro(a.id)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  filtro === a.id ? "border-foreground bg-foreground text-background" : "hover:bg-muted"
                }`}
              >
                {a.rotulo} ({a.n})
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          {pedidos === null && !erro && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </p>
          )}
          {pedidos !== null && lista.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {pedidos.length === 0
                ? "Nenhum pedido chegou pelo site ainda. Quando alguém enviar um pedido de orçamento, ele aparece aqui."
                : "Nenhum pedido neste filtro."}
            </p>
          )}
          {lista.map((p) => {
            const st = rotuloStatus(p)
            const whats = linkWhatsapp(
              p.cliente.telefone,
              `Olá, ${p.cliente.nome.split(" ")[0]}! Aqui é da Toldos Print. Recebemos o seu pedido de orçamento ${p.numeroFormatado} pelo site.`
            )
            return (
              <div key={p.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">Orçamento {p.numeroFormatado}</span>
                      <Badge variant="outline" className={`h-5 px-2 text-[11px] font-semibold ${st.classe}`}>
                        {st.texto}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatarDataHora(p.criadoEm)}
                      {p.resumo.codigo ? ` · pedido ${p.resumo.codigo}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {whats && (
                      <Button variant="outline" size="sm" nativeButton={false} render={<a href={whats} target="_blank" rel="noopener noreferrer" />}>
                        <MessageCircle className="mr-2 h-4 w-4 text-emerald-600" />
                        WhatsApp
                      </Button>
                    )}
                    <Button size="sm" nativeButton={false} render={<Link href={`/orcamentos/${p.id}`} />}>
                      <FileText className="mr-2 h-4 w-4" />
                      Abrir orçamento
                    </Button>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="font-medium">{p.cliente.nome}</p>
                    <p className="text-muted-foreground">{p.cliente.telefone}</p>
                    {(p.resumo.cidade || p.resumo.recebimento) && (
                      <p className="text-muted-foreground">
                        {[p.resumo.cidade, p.resumo.recebimento].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <ul className="space-y-0.5">
                    {p.resumo.itens.map((i, n) => (
                      <li key={n}>{i}</li>
                    ))}
                    {p.resumo.observacaoCliente && (
                      <li className="pt-1 text-muted-foreground">Obs.: {p.resumo.observacaoCliente}</li>
                    )}
                  </ul>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <Boxes className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="text-sm">
              <p className="font-semibold">Preços do site</p>
              <p className="text-muted-foreground">
                Vêm do cadastro de materiais. Mudou o preço lá, o site atualiza sozinho em até 5 minutos.
              </p>
              <Link href="/materiais" className="mt-1 inline-block font-medium underline underline-offset-2">
                Abrir materiais
              </Link>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <Images className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="text-sm">
              <p className="font-semibold">Fotos dos trabalhos</p>
              <p className="text-muted-foreground">As fotos de obras ficam no Portfólio do sistema.</p>
              <Link href="/portfolio-fotos" className="mt-1 inline-block font-medium underline underline-offset-2">
                Abrir portfólio
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
