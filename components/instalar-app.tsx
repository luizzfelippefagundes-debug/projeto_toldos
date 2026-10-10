"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Share, SquarePlus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface EventoInstalacao extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const CHAVE_DISPENSADO = "toldosprint.instalarDispensadoEm"
const SETE_DIAS = 7 * 24 * 60 * 60 * 1000

function foiDispensadoRecentemente() {
  try {
    const em = Number(localStorage.getItem(CHAVE_DISPENSADO))
    return Boolean(em) && Date.now() - em < SETE_DIAS
  } catch {
    return false
  }
}

function jaEstaInstalado() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function ehIos() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  )
}

export function InstalarApp({ className }: { className?: string }) {
  const [modo, setModo] = useState<"oculto" | "botao" | "ios">("oculto")
  const [evento, setEvento] = useState<EventoInstalacao | null>(null)

  useEffect(() => {
    if (jaEstaInstalado() || foiDispensadoRecentemente()) return

    if (ehIos()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModo("ios")
      return
    }

    function aoPoderInstalar(e: Event) {
      e.preventDefault()
      setEvento(e as EventoInstalacao)
      setModo("botao")
    }
    function aoInstalar() {
      setModo("oculto")
    }
    window.addEventListener("beforeinstallprompt", aoPoderInstalar)
    window.addEventListener("appinstalled", aoInstalar)
    return () => {
      window.removeEventListener("beforeinstallprompt", aoPoderInstalar)
      window.removeEventListener("appinstalled", aoInstalar)
    }
  }, [])

  function dispensar() {
    try {
      localStorage.setItem(CHAVE_DISPENSADO, String(Date.now()))
    } catch {}
    setModo("oculto")
  }

  async function instalar() {
    if (!evento) return
    await evento.prompt()
    const { outcome } = await evento.userChoice
    setEvento(null)
    if (outcome === "accepted") setModo("oculto")
    else dispensar()
  }

  if (modo === "oculto") return null

  return (
    <div
      className={cn(
        "fixed inset-x-3 bottom-4 z-50 mx-auto max-w-md rounded-2xl border border-border bg-card p-4 shadow-2xl print:hidden",
        className
      )}
    >
      <button
        onClick={dispensar}
        aria-label="Fechar"
        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-3 pr-6">
        <Image
          src="/icon-192.png"
          alt=""
          width={48}
          height={48}
          className="h-12 w-12 shrink-0 rounded-xl"
        />
        <div>
          <p className="text-sm font-semibold">Instale o app Toldos Print</p>
          <p className="text-xs text-muted-foreground">
            Abra direto da tela inicial, como um aplicativo.
          </p>
        </div>
      </div>

      {modo === "botao" ? (
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={dispensar}>
            Agora não
          </Button>
          <Button size="sm" onClick={instalar}>
            Instalar
          </Button>
        </div>
      ) : (
        <ol className="mt-3 flex flex-col gap-2 rounded-lg bg-muted/50 p-3 text-xs">
          <li className="flex items-center gap-2">
            <span className="font-semibold">1.</span> Toque em
            <Share className="h-4 w-4 text-primary" />
            <span className="font-medium">Compartilhar</span>, na barra do Safari
          </li>
          <li className="flex items-center gap-2">
            <span className="font-semibold">2.</span> Escolha
            <SquarePlus className="h-4 w-4" />
            <span className="font-medium">Adicionar à Tela de Início</span>
          </li>
        </ol>
      )}
    </div>
  )
}
