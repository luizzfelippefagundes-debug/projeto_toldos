"use client"

import { useEffect, useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Copy, Check } from "lucide-react"
import { toast } from "sonner"
import type { Papel } from "@/lib/types"

type PapelEquipe = Papel | "pendente"

interface Membro {
  id: string
  nome: string
  email: string
  papel: PapelEquipe
  imagemUrl: string
  ultimoLogin: number | null
}

const corPapel: Record<string, string> = {
  dono: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  producao: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  financeiro: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  pendente: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
}

const rotuloPapel: Record<string, string> = {
  pendente: "Sem acesso",
  producao: "Produção",
  financeiro: "Financeiro",
  dono: "Dono",
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
  const [membros, setMembros] = useState<Membro[]>([])
  const [carregando, setCarregando] = useState(true)
  const [copiado, setCopiado] = useState(false)

  const linkCadastro = typeof window !== "undefined"
    ? `${window.location.origin}/sign-up`
    : ""

  useEffect(() => {
    fetch("/api/equipe")
      .then((r) => r.json())
      .then(setMembros)
      .catch(() => toast.error("Erro ao carregar equipe."))
      .finally(() => setCarregando(false))
  }, [])

  function copiarLink() {
    navigator.clipboard.writeText(linkCadastro).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  async function atualizarPapel(userId: string, novoPapel: PapelEquipe) {
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

  const ordenados = [...membros].sort(
    (a, b) => Number(b.papel === "pendente") - Number(a.papel === "pendente")
  )

  return (
    <div className="flex flex-col gap-6">

      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-semibold">Equipe</h1>
        <p className="text-sm text-muted-foreground">
          Defina o que cada funcionário pode ver no sistema.
        </p>
      </div>

      {/* Link de cadastro */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-1 text-sm font-medium">Link de cadastro</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Mande esse link pro funcionário. A conta nova entra como &quot;Sem acesso&quot; até você escolher o papel dele aqui embaixo.
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
          {ordenados.map((membro) => (
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
                onValueChange={(v) => v && atualizarPapel(membro.id, v as PapelEquipe)}
              >
                <SelectTrigger className={`w-36 shrink-0 rounded-full border-0 text-xs font-medium ${corPapel[membro.papel] ?? ""}`}>
                  <SelectValue>
                    {(valor: string) => rotuloPapel[valor] ?? valor}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">{rotuloPapel.pendente}</SelectItem>
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
