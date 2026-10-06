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

const ICONES = ["📢", "🚨", "⚠️", "✅", "🔔", "❗", "📌", "🎯", "🔴", "⭕", "💬", "ℹ️"]

const CORES: { key: string; label: string; texto: string; bg: string; borda: string }[] = [
  { key: "azul",    label: "Azul",    texto: "text-blue-400",    bg: "bg-blue-400",    borda: "ring-blue-400" },
  { key: "verde",   label: "Verde",   texto: "text-emerald-400", bg: "bg-emerald-400", borda: "ring-emerald-400" },
  { key: "amarelo", label: "Amarelo", texto: "text-yellow-400",  bg: "bg-yellow-400",  borda: "ring-yellow-400" },
  { key: "vermelho",label: "Vermelho",texto: "text-red-400",     bg: "bg-red-400",     borda: "ring-red-400" },
  { key: "roxo",    label: "Roxo",    texto: "text-violet-400",  bg: "bg-violet-400",  borda: "ring-violet-400" },
  { key: "laranja", label: "Laranja", texto: "text-orange-400",  bg: "bg-orange-400",  borda: "ring-orange-400" },
  { key: "branco",  label: "Branco",  texto: "text-white",       bg: "bg-white",       borda: "ring-white" },
  { key: "rosa",    label: "Rosa",    texto: "text-pink-400",    bg: "bg-pink-400",    borda: "ring-pink-400" },
]

function corTextoClass(cor: string) {
  return CORES.find((c) => c.key === cor)?.texto ?? "text-blue-400"
}

function gerarId() {
  return `aviso-${Math.random().toString(36).slice(2, 10)}`
}

export default function AvisosTvPage() {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [nova, setNova] = useState("")
  const [cor, setCor] = useState("azul")
  const [icone, setIcone] = useState("📢")
  const [som, setSom] = useState(false)
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
    const aviso: Aviso = {
      id: gerarId(),
      mensagem: nova.trim(),
      criado_em: new Date().toISOString(),
      cor,
      icone,
      som,
    }
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

  const corAtual = CORES.find((c) => c.key === cor) ?? CORES[0]

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

      {/* Formulário de novo aviso */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-4">
        <p className="text-sm font-medium text-muted-foreground">Novo aviso</p>

        {/* Texto */}
        <Input
          value={nova}
          onChange={(e) => setNova(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && adicionar()}
          placeholder="Digite a mensagem que vai aparecer no painel..."
          maxLength={140}
        />

        {/* Preview */}
        {nova.trim() && (
          <div className="rounded-lg border border-dashed border-border bg-slate-950 px-4 py-2">
            <span className={`text-sm font-semibold ${corTextoClass(cor)}`}>
              {icone} {nova.trim()}
            </span>
          </div>
        )}

        {/* Ícone */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Ícone</p>
          <div className="flex flex-wrap gap-2">
            {ICONES.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIcone(i)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition-colors ${
                  icone === i
                    ? "border-primary bg-primary/10"
                    : "border-border bg-muted hover:bg-accent"
                }`}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        {/* Cor */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Cor do texto</p>
          <div className="flex flex-wrap gap-2">
            {CORES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCor(c.key)}
                title={c.label}
                className={`h-7 w-7 rounded-full transition-all ${c.bg} ${
                  cor === c.key ? `ring-2 ring-offset-2 ring-offset-card ${c.borda} scale-110` : "opacity-60 hover:opacity-100"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Som + Botão */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setSom((v) => !v)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              som
                ? "border-amber-500 bg-amber-500/10 text-amber-500"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {som ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            {som ? "Alerta sonoro ativado" : "Alerta sonoro desativado"}
          </button>

          <Button
            onClick={adicionar}
            disabled={!nova.trim() || salvando}
            style={{ backgroundColor: som ? undefined : corAtual.bg.replace("bg-", "") }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar aviso
          </Button>
        </div>
      </div>

      {/* Lista de avisos */}
      {avisos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <Tv2 className="h-10 w-10 opacity-30" />
          <p>Nenhum aviso no painel ainda.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {avisos.map((aviso) => {
            const corInfo = CORES.find((c) => c.key === (aviso.cor ?? "azul")) ?? CORES[0]
            return (
              <div
                key={aviso.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
              >
                <div className="min-w-0 flex items-start gap-3">
                  <span className="shrink-0 text-lg mt-0.5">{aviso.icone ?? "📢"}</span>
                  <div className="min-w-0">
                    <p className={`truncate font-medium ${corInfo.texto}`}>
                      {aviso.mensagem}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${corInfo.bg}`} />
                      <span className="text-xs text-muted-foreground">{corInfo.label}</span>
                      {aviso.som && (
                        <span className="flex items-center gap-1 text-xs text-amber-500">
                          <Volume2 className="h-3 w-3" /> Som
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(aviso.criado_em).toLocaleString("pt-BR", {
                          day: "2-digit", month: "2-digit", year: "2-digit",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
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
            )
          })}
        </div>
      )}
    </div>
  )
}
