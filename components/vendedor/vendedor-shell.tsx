"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, type ReactNode } from "react"
import { LayoutDashboard, FilePlus2, History, Menu } from "lucide-react"
import { cn } from "@/lib/utils"
import { vendedoresSeed } from "@/lib/seed-data"
import { useVendedorAtivo } from "@/context/vendedor-ativo-context"
import { gruposNavegacao } from "@/components/layout/nav-groups"
import { NavSheet } from "@/components/layout/nav-sheet"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const abas = [
  { label: "Painel", href: "/vendedor", icon: LayoutDashboard },
  { label: "Novo", href: "/vendedor/novo", icon: FilePlus2 },
  { label: "Orçamentos", href: "/vendedor/orcamentos", icon: History },
]

const grupoVendedor = {
  title: "Minha área",
  items: abas.map((a) => ({ label: a.label, href: a.href, icon: a.icon })),
}

export function VendedorShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { vendedorId, setVendedorId } = useVendedorAtivo()
  const vendedor = vendedoresSeed.find((v) => v.id === vendedorId)
  const [menuAberto, setMenuAberto] = useState(false)

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-card px-3 py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMenuAberto(true)}
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex flex-1 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">
            T
          </div>
          <span className="text-sm font-semibold">Toldos Print</span>
        </div>
        <Select
          value={vendedorId}
          onValueChange={(v) => setVendedorId(v ?? vendedorId)}
        >
          <SelectTrigger className="h-8 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {vendedoresSeed.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ThemeToggle />
      </header>

      <NavSheet
        open={menuAberto}
        onOpenChange={setMenuAberto}
        grupos={[grupoVendedor, ...gruposNavegacao]}
        titulo={vendedor?.nome ?? "Menu"}
        subtitulo="Dono também tem acesso ao sistema completo da loja."
      />

      <main className="flex-1 overflow-x-hidden px-4 py-5 pb-24">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto flex w-full max-w-md border-t border-border bg-card">
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
