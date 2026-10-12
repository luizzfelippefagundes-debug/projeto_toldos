"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Logo } from "@/components/brand/logo"
import { ImageOff } from "lucide-react"
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

export default function PortfolioPage() {
  const [fotos, setFotos] = useState<FotoPortfolio[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState<CategoriaProdutoRapido | "Todos">("Todos")

  useEffect(() => {
    fetch("/api/portfolio", { cache: "no-store" })
      .then((r) => r.json())
      .then(setFotos)
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [])

  const categoriasComFoto = CATEGORIAS.filter((c) =>
    fotos.some((f) => f.categoria === c)
  )
  const fotosFiltradas =
    filtro === "Todos" ? fotos : fotos.filter((f) => f.categoria === filtro)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col items-center gap-3 text-center">
        <Logo className="w-56" />
        <p className="text-sm text-muted-foreground">
          Toldos e comunicação visual — alguns dos nossos trabalhos.
        </p>
      </header>

      {!carregando && categoriasComFoto.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={() => setFiltro("Todos")}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              filtro === "Todos"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Todos
          </button>
          {categoriasComFoto.map((c) => (
            <button
              key={c}
              onClick={() => setFiltro(c)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                filtro === c
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {carregando ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="aspect-square animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : fotosFiltradas.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
          <ImageOff className="h-10 w-10 opacity-30" />
          <p className="text-sm">Em breve, fotos dos nossos trabalhos por aqui.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {fotosFiltradas.map((foto) => (
            <figure
              key={foto.id}
              className="group relative aspect-square overflow-hidden rounded-xl bg-muted"
            >
              <Image
                src={foto.url}
                alt={foto.descricao ?? foto.categoria}
                fill
                sizes="(max-width: 640px) 50vw, 33vw"
                className="object-cover transition-transform group-hover:scale-105"
              />
              {foto.descricao && (
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {foto.descricao}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}
    </div>
  )
}
