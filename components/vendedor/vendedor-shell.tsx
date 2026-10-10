"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, type ReactNode } from "react"
import { LayoutDashboard, FilePlus2, History, Menu } from "lucide-react"
import { cn } from "@/lib/utils"
import { UserButton } from "@clerk/nextjs"
import { useVendedorAtivo } from "@/context/vendedor-ativo-context"
import { gruposNavegacao } from "@/components/layout/nav-groups"
import { NavSheet } from "@/components/layout/nav-sheet"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"

const abas = [
  { label: "Painel", href: "/vendedor", icon: LayoutDashboard },
  { label: "Novo", href: "/vendedor/novo", icon: FilePlus2 },
  { label: "Orçamentos", href: "/vendedor/orcamentos", icon: History },
]

const grupoVendedor = {
  title: "Minha área",
  items: abas.map((a) => ({ label: a.label, href: a.href, icon: a.icon })),
}

// No celular tem barra própria (topo + abas embaixo); no computador fica
// dentro do layout normal, com a barra lateral do sistema.
export function VendedorShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { nome } = useVendedorAtivo()
  const [menuAberto, setMenuAberto] = useState(false)

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background md:max-w-5xl">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-card px-3 py-3 md:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMenuAberto(true)}
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex flex-1 items-center">
          <Link href="/vendedor" className="w-28">
            <Logo className="px-2 py-1" />
          </Link>
        </div>
        <ThemeToggle />
        <UserButton />
      </header>

      <div className="hidden px-8 pt-8 md:flex">
        <nav className="flex gap-1 rounded-lg bg-muted p-1">
          {abas.map((aba) => {
            const ativo = pathname === aba.href
            const Icon = aba.icon
            return (
              <Link
                key={aba.href}
                href={aba.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
                  ativo
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {aba.label}
              </Link>
            )
          })}
        </nav>
      </div>

      <NavSheet
        open={menuAberto}
        onOpenChange={setMenuAberto}
        grupos={[grupoVendedor, ...gruposNavegacao]}
        titulo={nome || "Menu"}
      />

      <main className="flex-1 overflow-x-hidden px-4 py-5 pb-24 md:px-8 md:py-6 md:pb-8">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto flex w-full max-w-md border-t border-border bg-card md:hidden">
        {abas.map((aba) => {
          const ativo = pathname === aba.href
          const Icon = aba.icon
          return (
            <Link
              key={aba.href}
              href={aba.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-3 text-xs",
                ativo ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {aba.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
