"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tv2, Trash2, Plus, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

interface Aviso {
  id: string
  mensagem: string
  criado_em: string
}

function gerarId() {
  return `aviso-${Math.random().toString(36).slice(2, 10)}`
}

export default function AvisosTvPage() {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [nova, setNova] = useState("")
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    fetch("/api/avisos-tv")
      .then((r) => r.json())
      .then(setAvisos)
      .catch(() => {})
  }, [])

  async function adicionar() {
    if (!nova.trim()) return
    setSalvando(true)
    const aviso: Aviso = { id: gerarId(), mensagem: nova.trim(), criado_em: new Date().toISOString() }
    try {
      await fetch("/api/avisos-tv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aviso),
      })
      setAvisos((atual) => [aviso, ...atual])
      setNova("")
      toast.success("Aviso adicionado ao painel TV.")
    } catch {
      toast.error("Erro ao salvar aviso.")
    } finally {
      setSalvando(false)
    }
  }

  async function remover(id: string) {
    try {
      await fetch(`/api/avisos-tv/${id}`, { method: "DELETE" })
      setAvisos((atual) => atual.filter((a) => a.id !== id))
      toast.success("Aviso removido.")
    } catch {
      toast.error("Erro ao remover aviso.")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Avisos do Painel TV</h1>
          <p className="text-sm text-muted-foreground">
            Mensagens que aparecem no rodapé do painel da TV em tempo real.
          </p>
        </div>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/tv" target="_blank" />}>
          <ExternalLink className="mr-2 h-4 w-4" />
          Abrir Painel TV
        </Button>
      </div>

      {/* Input de novo aviso */}
      <div className="flex gap-2">
        <Input
          value={nova}
          onChange={(e) => setNova(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && adicionar()}
          placeholder="Ex: Reunião às 17h — Feriado amanhã, entregar hoje"
          className="flex-1"
          maxLength={120}
        />
        <Button onClick={adicionar} disabled={!nova.trim() || salvando}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar
        </Button>
      </div>

      {/* Lista de avisos */}
      {avisos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <Tv2 className="h-10 w-10 opacity-30" />
          <p>Nenhum aviso no painel ainda.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {avisos.map((aviso) => (
            <div
              key={aviso.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{aviso.mensagem}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(aviso.criado_em).toLocaleString("pt-BR", {
                    day: "2-digit", month: "2-digit", year: "2-digit",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-destructive hover:text-destructive"
                onClick={() => remover(aviso.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
