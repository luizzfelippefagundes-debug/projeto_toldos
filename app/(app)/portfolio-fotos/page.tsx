"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ExternalLink, ImagePlus, Trash2, ImageOff } from "lucide-react"
import { toast } from "sonner"
import type { CategoriaProdutoRapido } from "@/lib/types"

interface FotoPortfolio {
  id: string
  categoria: CategoriaProdutoRapido
  url: string
  descricao: string | null
  criado_em: string
}

const CATEGORIAS: CategoriaProdutoRapido[] = [
  "Adesivo",
  "Banner",
  "Camiseta",
  "Cartão de Visita",
  "Lona / Faixa",
  "Panfleto / Flyer",
  "Outro",
]

function gerarId() {
  return `pf-${Math.random().toString(36).slice(2, 10)}`
}

export default function PortfolioFotosPage() {
  const [fotos, setFotos] = useState<FotoPortfolio[]>([])
  const [carregando, setCarregando] = useState(true)
  const [categoria, setCategoria] = useState<CategoriaProdutoRapido>("Banner")
  const [descricao, setDescricao] = useState("")
  const [enviando, setEnviando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch("/api/portfolio")
      .then((r) => r.json())
      .then(setFotos)
      .catch(() => toast.error("Erro ao carregar portfólio."))
      .finally(() => setCarregando(false))
  }, [])

  async function enviarFoto(arquivo: File) {
    setEnviando(true)
    try {
      const form = new FormData()
      form.append("file", arquivo)
      const res = await fetch("/api/upload", { method: "POST", body: form })
      if (!res.ok) throw new Error("Falha no upload")
      const { url } = await res.json()

      const foto: FotoPortfolio = {
        id: gerarId(),
        categoria,
        url,
        descricao: descricao.trim() || null,
        criado_em: new Date().toISOString(),
      }
      const criar = await fetch("/api/portfolio-fotos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(foto),
      })
      if (!criar.ok) throw new Error("Falha ao salvar")

      setFotos((atual) => [foto, ...atual])
      setDescricao("")
      toast.success("Foto adicionada ao portfólio.")
    } catch {
      toast.error("Erro ao enviar foto.")
    } finally {
      setEnviando(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function remover(id: string) {
    const anterior = fotos
    setFotos((atual) => atual.filter((f) => f.id !== id))
    try {
      const res = await fetch(`/api/portfolio-fotos/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("Foto removida.")
    } catch {
      setFotos(anterior)
      toast.error("Erro ao remover foto.")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Portfólio</h1>
          <p className="text-sm text-muted-foreground">
            Fotos dos trabalhos que aparecem na página pública, pra mandar pro cliente no WhatsApp.
          </p>
        </div>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/portfolio" target="_blank" />}>
          <ExternalLink className="mr-2 h-4 w-4" />
          Ver página pública
        </Button>
      </div>

      {/* Formulário de nova foto */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-medium text-muted-foreground">Adicionar foto</p>
        <div className="flex flex-wrap gap-3">
          <Select value={categoria} onValueChange={(v) => v && setCategoria(v as CategoriaProdutoRapido)}>
            <SelectTrigger className="w-44">
              <SelectValue>{(v: string) => v}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CATEGORIAS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição (opcional)"
            className="h-9 flex-1 min-w-40 rounded-md border border-border bg-background px-3 text-sm"
          />
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            disabled={enviando}
            onChange={(e) => {
              const arquivo = e.target.files?.[0]
              if (arquivo) enviarFoto(arquivo)
            }}
            className="hidden"
            id="upload-foto-portfolio"
          />
          <Button
            type="button"
            disabled={enviando}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="mr-2 h-4 w-4" />
            {enviando ? "Enviando..." : "Escolher foto"}
          </Button>
        </div>
      </div>

      {/* Galeria */}
      {carregando ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-square animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : fotos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <ImageOff className="h-10 w-10 opacity-30" />
          <p className="text-sm">Nenhuma foto no portfólio ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {fotos.map((foto) => (
            <div key={foto.id} className="group relative aspect-square overflow-hidden rounded-xl bg-muted">
              <Image
                src={foto.url}
                alt={foto.descricao ?? foto.categoria}
                fill
                sizes="(max-width: 640px) 50vw, 25vw"
                className="object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-2">
                <span className="truncate text-[11px] font-medium text-white">{foto.categoria}</span>
                <button
                  onClick={() => remover(foto.id)}
                  className="shrink-0 rounded-full bg-black/40 p-1.5 text-white hover:bg-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
