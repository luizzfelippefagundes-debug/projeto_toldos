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
import { Logo } from "@/components/brand/logo"
import { NotificacoesBell } from "./notificacoes-bell"
import { usePapelAtivo } from "@/context/papel-ativo-context"
import type { Papel } from "@/lib/types"
import { ROTULO_PAPEL } from "@/lib/papel"
import { UserButton } from "@clerk/nextjs"

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
  { label: "Produção", href: "/producao", icon: Factory, papeis: ["producao", "operador"] },
  { label: "Financeiro", href: "/financeiro", icon: Wallet, papeis: ["financeiro"] },
]

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [menuAberto, setMenuAberto] = useState(false)
  const { papel, previa, verComo } = usePapelAtivo()

  // A área do vendedor tem barras próprias no celular (VendedorShell); aqui
  // ela só ganha a barra lateral do computador.
  if (pathname?.startsWith("/vendedor")) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    )
  }

  const grupos = filtrarGruposPorPapel(gruposNavegacao, papel)
  const abasVisiveis = abasRapidas.filter(
    (aba) =>
      papel === "operador"
        ? aba.papeis?.includes(papel)
        : papel === "dono" || !aba.papeis || aba.papeis.includes(papel)
  )

  return (
    <div className="flex min-h-screen bg-background print:block print:bg-white">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col print:w-full">
        {previa && (
          <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-black print:hidden">
            <span>Você está vendo como: {ROTULO_PAPEL[papel]}</span>
            <Link
              href="/equipe"
              onClick={() => verComo(null)}
              className="rounded-md bg-black/15 px-3 py-1"
            >
              Voltar ao normal
            </Link>
          </div>
        )}

        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-card px-4 py-3 md:hidden print:hidden">
          <div className="flex min-w-0 flex-1 items-center">
            <Link href="/dashboard" className="w-32 max-w-full">
              <Logo className="px-2 py-1" />
            </Link>
          </div>
          <ThemeToggle />
          <NotificacoesBell />
          <UserButton />
        </header>

        <NavSheet
          open={menuAberto}
          onOpenChange={setMenuAberto}
          grupos={grupos}
          titulo="Toldos Print"
        />

        <main className="min-w-0 flex-1 overflow-x-hidden p-4 pb-24 md:p-8 md:pb-8 print:p-0 print:pb-0">
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
