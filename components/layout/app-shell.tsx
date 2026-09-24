"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Zap, Factory, Wallet, Menu } from "lucide-react"
import { cn } from "@/lib/utils"
import { Sidebar } from "./sidebar"
import { NavSheet } from "./nav-sheet"
import { gruposNavegacao } from "./nav-groups"
import { Button } from "@/components/ui/button"

// Abas rápidas da barra inferior mobile — as mesmas 4 páginas mais usadas no
// dia a dia da loja. As demais ficam no menu completo (botão "Menu").
const abasRapidas = [
  { label: "Início", href: "/dashboard", icon: LayoutDashboard },
  { label: "Rápida", href: "/grafica-rapida", icon: Zap },
  { label: "Produção", href: "/producao", icon: Factory },
  { label: "Financeiro", href: "/financeiro", icon: Wallet },
]

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [menuAberto, setMenuAberto] = useState(false)

  // A área do vendedor (/vendedor/*) tem o próprio shell mobile (barra
  // superior + abas embaixo, ver app/vendedor/layout.tsx) — sem a sidebar da
  // loja. Ela ainda usa o mesmo DataProvider da raiz, só não usa este shell.
  if (pathname?.startsWith("/vendedor")) {
    return <>{children}</>
  }

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
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
              T
            </div>
            <span className="text-sm font-semibold">Toldos Print</span>
          </div>
        </header>

        <NavSheet
          open={menuAberto}
          onOpenChange={setMenuAberto}
          grupos={gruposNavegacao}
          titulo="Toldos Print"
        />

        <main className="min-w-0 flex-1 overflow-x-hidden p-4 pb-24 md:p-8 md:pb-8">
          {children}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-card md:hidden print:hidden">
          {abasRapidas.map((aba) => {
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
