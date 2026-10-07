"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tv2, Trash2, Plus, ExternalLink, Volume2, VolumeX } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

interface Aviso {
  id: string
  mensagem: string
  criado_em: string
  cor: string
  icone: string
  som: boolean
}

const TIPOS = [
  { label: "Aviso",   icone: "📢", cor: "azul",     classe: "border-blue-500/50 bg-blue-500/10 text-blue-400",     ativo: "border-blue-500 bg-blue-500/20 text-blue-300 ring-1 ring-blue-500" },
  { label: "Atenção", icone: "⚠️", cor: "amarelo",  classe: "border-yellow-500/50 bg-yellow-500/10 text-yellow-500", ativo: "border-yellow-500 bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-500" },
  { label: "Alerta",  icone: "🚨", cor: "vermelho",  classe: "border-red-500/50 bg-red-500/10 text-red-400",         ativo: "border-red-500 bg-red-500/20 text-red-300 ring-1 ring-red-500" },
  { label: "OK",      icone: "✅", cor: "verde",     classe: "border-emerald-500/50 bg-emerald-500/10 text-emerald-400", ativo: "border-emerald-500 bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500" },
]

const COR_TEXTO: Record<string, string> = {
  azul:     "text-blue-400",
  amarelo:  "text-yellow-400",
  vermelho: "text-red-400",
  verde:    "text-emerald-400",
}

function gerarId() {
  return `aviso-${Math.random().toString(36).slice(2, 10)}`
}

export default function AvisosTvPage() {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [mensagem, setMensagem] = useState("")
  const [tipoIdx, setTipoIdx] = useState(0)
  const [som, setSom] = useState(false)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    fetch("/api/avisos-tv")
      .then((r) => r.json())
      .then(setAvisos)
      .catch(() => {})
  }, [])

  const tipo = TIPOS[tipoIdx]

  async function adicionar() {
    if (!mensagem.trim()) return
    setSalvando(true)
    const aviso: Aviso = {
      id: gerarId(),
      mensagem: mensagem.trim(),
      criado_em: new Date().toISOString(),
      cor: tipo.cor,
      icone: tipo.icone,
      som,
    }
    try {
      await fetch("/api/avisos-tv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aviso),
      })
      setAvisos((atual) => [aviso, ...atual])
      setMensagem("")
      toast.success("Aviso adicionado ao painel.")
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

      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Avisos do Painel TV</h1>
          <p className="text-sm text-muted-foreground">
            Aparecem no rodapé do painel da produção em tempo real.
          </p>
        </div>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/tv" target="_blank" />}>
          <ExternalLink className="mr-2 h-4 w-4" />
          Ver painel
        </Button>
      </div>

      {/* Formulário */}
      <div className="flex flex-col gap-3">

        {/* Tipo */}
        <div className="flex gap-2">
          {TIPOS.map((t, i) => (
            <button
              key={t.label}
              type="button"
              onClick={() => setTipoIdx(i)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${
                tipoIdx === i ? t.ativo : t.classe
              }`}
            >
              <span>{t.icone}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Input + botões */}
        <div className="flex gap-2">
          <Input
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adicionar()}
            placeholder="Escreva a mensagem..."
            maxLength={140}
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => setSom((v) => !v)}
            title={som ? "Alerta sonoro ativo" : "Sem som"}
            className={`flex items-center justify-center rounded-lg border px-3 transition-colors ${
              som
                ? "border-amber-500 bg-amber-500/10 text-amber-400"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {som ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <Button onClick={adicionar} disabled={!mensagem.trim() || salvando}>
            <Plus className="mr-1.5 h-4 w-4" />
            Adicionar
          </Button>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Lista */}
      {avisos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <Tv2 className="h-8 w-8 opacity-25" />
          <p className="text-sm">Nenhum aviso ativo no painel.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {avisos.map((aviso) => {
            const t = TIPOS.find((x) => x.cor === aviso.cor) ?? TIPOS[0]
            return (
              <div
                key={aviso.id}
                className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50"
              >
                <span className="shrink-0 text-base">{aviso.icone ?? "📢"}</span>
                <p className={`flex-1 min-w-0 truncate text-sm font-medium ${COR_TEXTO[aviso.cor] ?? "text-blue-400"}`}>
                  {aviso.mensagem}
                </p>
                <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  {aviso.som && <Volume2 className="h-3.5 w-3.5 text-amber-500" />}
                  <span>
                    {new Date(aviso.criado_em).toLocaleString("pt-BR", {
                      day: "2-digit", month: "2-digit",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                  <button
                    onClick={() => remover(aviso.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
