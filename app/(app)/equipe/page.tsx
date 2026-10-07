"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { UserPlus, Mail } from "lucide-react"
import { toast } from "sonner"
import type { Papel } from "@/lib/types"

interface Membro {
  id: string
  nome: string
  email: string
  papel: Papel
  imagemUrl: string
  ultimoLogin: number | null
}

const rotuloPapel: Record<string, string> = {
  dono: "Dono",
  producao: "Produção",
  financeiro: "Financeiro",
}

const corPapel: Record<string, string> = {
  dono: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  producao: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  financeiro: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
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

  // Convite
  const [dialogAberto, setDialogAberto] = useState(false)
  const [emailConvite, setEmailConvite] = useState("")
  const [papelConvite, setPapelConvite] = useState<Papel>("producao")
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    fetch("/api/equipe")
      .then((r) => r.json())
      .then(setMembros)
      .catch(() => toast.error("Erro ao carregar equipe."))
      .finally(() => setCarregando(false))
  }, [])

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
      if (!res.ok) throw new Error()
      toast.success("Papel atualizado.")
    } catch {
      setMembros(anterior)
      toast.error("Erro ao atualizar papel.")
    }
  }

  async function enviarConvite() {
    if (!emailConvite.trim()) return
    setEnviando(true)
    try {
      const res = await fetch("/api/equipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailConvite.trim(), papel: papelConvite }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      toast.success(`Convite enviado para ${emailConvite.trim()}.`)
      setEmailConvite("")
      setDialogAberto(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar convite.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Equipe</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie quem tem acesso ao sistema e qual área cada um pode ver.
          </p>
        </div>
        <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
          <DialogTrigger>
            <Button nativeButton={false}>
              <UserPlus className="mr-2 h-4 w-4" />
              Convidar funcionário
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Convidar novo funcionário</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 pt-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">E-mail</label>
                <Input
                  type="email"
                  value={emailConvite}
                  onChange={(e) => setEmailConvite(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && enviarConvite()}
                  placeholder="funcionario@email.com"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Papel no sistema</label>
                <Select
                  value={papelConvite}
                  onValueChange={(v) => setPapelConvite(v as Papel)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="producao">Produção — vê pedidos e produção</SelectItem>
                    <SelectItem value="financeiro">Financeiro — vê orçamentos e financeiro</SelectItem>
                    <SelectItem value="dono">Dono — acesso completo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                <Mail className="mb-1 h-3.5 w-3.5" />
                O funcionário receberá um e-mail de convite para criar a conta.
                Quando entrar, o acesso já estará configurado automaticamente.
              </div>
              <Button onClick={enviarConvite} disabled={!emailConvite.trim() || enviando}>
                {enviando ? "Enviando..." : "Enviar convite"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista */}
      {carregando ? (
        <div className="flex flex-col gap-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : membros.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <p className="text-sm">Nenhum membro encontrado.</p>
        </div>
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
                onValueChange={(v) => atualizarPapel(membro.id, v as Papel)}
              >
                <SelectTrigger className={`w-36 shrink-0 rounded-full border-0 text-xs font-medium ${corPapel[membro.papel] ?? ""}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dono">Dono</SelectItem>
                  <SelectItem value="producao">Produção</SelectItem>
                  <SelectItem value="financeiro">Financeiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Ao mudar o papel de um membro, o acesso é atualizado na próxima vez que ele fizer login.
      </p>
    </div>
  )
}
