"use client"

import { useEffect, useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Copy, Check, Phone, Bell, Plus, Trash2, Smartphone } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { usePapelAtivo } from "@/context/papel-ativo-context"
import type { Papel } from "@/lib/types"

interface Membro {
  id: string
  nome: string
  email: string
  papel: Papel
  imagemUrl: string
  ultimoLogin: number | null
}

const corPapel: Record<string, string> = {
  dono: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  producao: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  financeiro: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  operador: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
}

const rotuloPapel: Record<string, string> = {
  producao: "Produção",
  financeiro: "Financeiro",
  dono: "Dono",
  operador: "Produção e TV",
}

function Avatar({ nome, imagemUrl }: { nome: string; imagemUrl: string }) {
  const [erro, setErro] = useState(false)
  const iniciais = nome
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase()

  if (erro || !imagemUrl) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {iniciais}
      </div>
    )
  }

  return (
    <img
      src={imagemUrl}
      alt={nome}
      onError={() => setErro(true)}
      className="h-9 w-9 shrink-0 rounded-full object-cover"
    />
  )
}

export default function EquipePage() {
  const router = useRouter()
  const { verComo } = usePapelAtivo()
  const [membros, setMembros] = useState<Membro[]>([])
  const [carregando, setCarregando] = useState(true)
  const [copiado, setCopiado] = useState(false)
  const [telefonesProducao, setTelefonesProducao] = useState<string[]>([])
  const [novoTelefone, setNovoTelefone] = useState("")
  const [salvandoTelefones, setSalvandoTelefones] = useState(false)

  const linkCadastro = typeof window !== "undefined"
    ? `${window.location.origin}/sign-up`
    : ""

  useEffect(() => {
    fetch("/api/equipe")
      .then((r) => r.json())
      .then(setMembros)
      .catch(() => toast.error("Erro ao carregar equipe."))
      .finally(() => setCarregando(false))

    fetch("/api/equipe/telefones-producao")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.telefones)) setTelefonesProducao(d.telefones)
      })
      .catch(() => {})
  }, [])

  async function atualizarTelefonesProducao(novos: string[]) {
    setSalvandoTelefones(true)
    try {
      const res = await fetch("/api/equipe/telefones-producao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefones: novos }),
      })
      if (!res.ok) throw new Error("Erro ao salvar telefones")
      setTelefonesProducao(novos)
      toast.success("Telefones da equipe atualizados!")
    } catch {
      toast.error("Não foi possível salvar os telefones.")
    } finally {
      setSalvandoTelefones(false)
    }
  }

  function adicionarTelefone() {
    const limpo = novoTelefone.replace(/\D/g, "")
    if (limpo.length < 10) {
      toast.error("Informe um número de WhatsApp válido com DDD.")
      return
    }
    const comDdi = limpo.startsWith("55") ? limpo : `55${limpo}`
    if (telefonesProducao.includes(comDdi)) {
      toast.error("Este telefone já está na lista.")
      return
    }
    const listaAtualizada = [...telefonesProducao, comDdi]
    atualizarTelefonesProducao(listaAtualizada)
    setNovoTelefone("")
  }

  function removerTelefone(tel: string) {
    const listaAtualizada = telefonesProducao.filter((t) => t !== tel)
    atualizarTelefonesProducao(listaAtualizada)
  }

  function copiarLink() {
    navigator.clipboard.writeText(linkCadastro).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  async function atualizarPapel(userId: string, novoPapel: Papel) {
    const anterior = membros
    setMembros((m) =>
      m.map((u) => (u.id === userId ? { ...u, papel: novoPapel } : u))
    )
    try {
      const res = await fetch(`/api/equipe/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ papel: novoPapel }),
      })
      if (!res.ok) {
        const corpo = await res.json().catch(() => null)
        throw new Error(corpo?.error ?? "Erro ao atualizar papel.")
      }
      toast.success("Acesso atualizado. Vale em até 1 minuto (ou ao recarregar a página).")
    } catch (e) {
      setMembros(anterior)
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar papel.")
    }
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-semibold">Equipe</h1>
        <p className="text-sm text-muted-foreground">
          Defina o que cada funcionário pode ver no sistema.
        </p>
      </div>

      {/* Prévia: o dono vê o sistema como o funcionário veria */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">Ver como funcionário</p>
          <p className="text-xs text-muted-foreground">
            Mostra só a Produção e o Painel TV, igual ao que o papel &quot;Produção e TV&quot; enxerga.
            Seu acesso de dono não muda.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            verComo("operador")
            router.push("/producao")
          }}
        >
          Ver como Produção e TV
        </Button>
      </div>

      {/* Link de cadastro */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-1 text-sm font-medium">Link de cadastro</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Mande esse link pro funcionário. A conta nova já entra como Dono — se quiser restringir o acesso dele, troca o papel aqui embaixo.
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 truncate rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {linkCadastro}
          </div>
          <button
            onClick={copiarLink}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-accent"
          >
            {copiado ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copiado ? "Copiado" : "Copiar"}
          </button>
        </div>
      </div>

      {/* WhatsApp Notificações Automáticas para a Equipe de Produção e TV */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600">
            <Smartphone className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              Notificações no WhatsApp (Produção e TV)
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                Ativo
              </span>
            </h2>
            <p className="text-xs text-muted-foreground">
              A cada nova demanda (pedido rápido ou OS assinada) e a cada aviso do dono no telão, o robô avisa estes números automaticamente.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {telefonesProducao.map((tel) => {
            const numLimpo = tel.replace(/^55/, "")
            const formatado =
              numLimpo.length === 11
                ? `(${numLimpo.slice(0, 2)}) ${numLimpo.slice(2, 7)}-${numLimpo.slice(7)}`
                : tel

            return (
              <div
                key={tel}
                className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-muted/30 px-2.5 py-1.5 text-xs font-medium"
              >
                <Phone className="h-3 w-3 text-emerald-600" />
                <span>+55 {formatado}</span>
                <button
                  type="button"
                  onClick={() => removerTelefone(tel)}
                  disabled={salvandoTelefones}
                  className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                  title="Remover telefone"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Input
            placeholder="Ex: 27998051301"
            value={novoTelefone}
            onChange={(e) => setNovoTelefone(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                adicionarTelefone()
              }
            }}
            className="h-8 max-w-[220px] text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1"
            onClick={adicionarTelefone}
            disabled={salvandoTelefones || !novoTelefone.trim()}
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar WhatsApp
          </Button>
        </div>
      </div>

      {/* Lista de membros */}
      {carregando ? (
        <div className="flex flex-col gap-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : membros.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhum membro encontrado.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {membros.map((membro) => (
            <div
              key={membro.id}
              className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3"
            >
              <Avatar nome={membro.nome} imagemUrl={membro.imagemUrl} />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{membro.nome}</p>
                <p className="truncate text-xs text-muted-foreground">{membro.email}</p>
              </div>

              {membro.ultimoLogin && (
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                  {new Date(membro.ultimoLogin).toLocaleDateString("pt-BR")}
                </span>
              )}

              <Select
                value={membro.papel}
                onValueChange={(v) => v && atualizarPapel(membro.id, v as Papel)}
              >
                <SelectTrigger className={`w-36 shrink-0 rounded-full border-0 text-xs font-medium ${corPapel[membro.papel] ?? ""}`}>
                  <SelectValue>
                    {(valor: string) => rotuloPapel[valor] ?? valor}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operador">{rotuloPapel.operador}</SelectItem>
                  <SelectItem value="producao">{rotuloPapel.producao}</SelectItem>
                  <SelectItem value="financeiro">{rotuloPapel.financeiro}</SelectItem>
                  <SelectItem value="dono">{rotuloPapel.dono}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
