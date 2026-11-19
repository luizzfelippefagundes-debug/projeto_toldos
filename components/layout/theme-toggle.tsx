"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  // O tema real só é conhecido depois de montar no cliente (next-themes lê
  // do localStorage) — mesmo cuidado de hydration dos outros contexts.
  // Antes de montar, sempre renderiza a Lua (mesmo valor do servidor).
  const [montado, setMontado] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMontado(true)
  }, [])

  // Não respeita sistema operacional: apenas o tema configurado explicitamente no sistema
  const temaAtual = montado ? (theme || resolvedTheme || "dark") : "dark"
  const escuro = temaAtual !== "light"

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={escuro ? "Mudar para tema claro" : "Mudar para tema escuro"}
      onClick={() => {
        const novoTema = escuro ? "light" : "dark"
        setTheme(novoTema)
        // O Painel TV roda em outro aparelho e segue o tema salvo no servidor.
        fetch("/api/tema", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tema: novoTema }),
        }).catch(() => {})
      }}
    >
      {escuro ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  )
}
