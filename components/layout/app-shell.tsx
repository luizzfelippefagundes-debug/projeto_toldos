"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Zap, Factory, Wallet, Menu } from "lucide-react"
import { cn } from "@/lib/utils"
import { Sidebar } from "./sidebar"
import { NavSheet } from "./nav-sheet"
import { filtrarGruposPorPapel, gruposNavegacao } from "./nav-groups"
import { ThemeToggle } from "./theme-toggle"
import { Button } from "@/components/ui/button"
import { usePapelAtivo } from "@/context/papel-ativo-context"
import type { Papel } from "@/lib/types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Abas rápidas da barra inferior mobile — as mesmas 4 páginas mais usadas no
// dia a dia da loja, cada uma marcada com quem pode vê-la (igual aos grupos
// de navegação). As demais ficam no menu completo (botão "Menu").
const abasRapidas: {
  label: string
  href: string
  icon: typeof LayoutDashboard
  papeis?: Papel[]
}[] = [
  { label: "Início", href: "/dashboard", icon: LayoutDashboard },
  { label: "Rápida", href: "/grafica-rapida", icon: Zap },
  { label: "Produção", href: "/producao", icon: Factory, papeis: ["producao"] },
  { label: "Financeiro", href: "/financeiro", icon: Wallet, papeis: ["financeiro"] },
]

const rotuloPapel = {
  dono: "Dono (vê tudo)",
  producao: "Visão Produção",
  financeiro: "Visão Financeiro",
} as const

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [menuAberto, setMenuAberto] = useState(false)
  const { papel, setPapel } = usePapelAtivo()

  // A área do vendedor (/vendedor/*) tem o próprio shell mobile (barra
  // superior + abas embaixo, ver app/vendedor/layout.tsx) — sem a sidebar da
  // loja. Ela ainda usa o mesmo DataProvider da raiz, só não usa este shell.
  if (pathname?.startsWith("/vendedor")) {
    return <>{children}</>
  }

  const grupos = filtrarGruposPorPapel(gruposNavegacao, papel)
  const abasVisiveis = abasRapidas.filter(
    (aba) => papel === "dono" || !aba.papeis || aba.papeis.includes(papel)
  )

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-card px-4 py-3 md:hidden print:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMenuAberto(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex flex-1 items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
              T
            </div>
            <span className="text-sm font-semibold">Toldos Print</span>
          </div>
          <ThemeToggle />
        </header>

        <NavSheet
          open={menuAberto}
          onOpenChange={setMenuAberto}
          grupos={grupos}
          titulo="Toldos Print"
          extra={
            <Select
              value={papel}
              onValueChange={(v) => setPapel((v ?? papel) as Papel)}
            >
              <SelectTrigger className="mb-4 w-full text-xs">
                <SelectValue>
                  {(valor: string) =>
                    rotuloPapel[valor as keyof typeof rotuloPapel] ?? valor
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dono">{rotuloPapel.dono}</SelectItem>
                <SelectItem value="producao">{rotuloPapel.producao}</SelectItem>
                <SelectItem value="financeiro">
                  {rotuloPapel.financeiro}
                </SelectItem>
              </SelectContent>
            </Select>
          }
        />

        <main className="min-w-0 flex-1 overflow-x-hidden p-4 pb-24 md:p-8 md:pb-8">
          {children}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-card md:hidden print:hidden">
          {abasVisiveis.map((aba) => {
            const ativo = pathname === aba.href
            const Icon = aba.icon
            return (
              <Link
                key={aba.href}
                href={aba.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs",
                  ativo ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                {aba.label}
              </Link>
            )
          })}
          <button
            onClick={() => setMenuAberto(true)}
            className="flex flex-1 flex-col items-center gap-1 py-2.5 text-xs text-muted-foreground"
          >
            <Menu className="h-5 w-5" />
            Menu
          </button>
        </nav>
      </div>
    </div>
  )
}
