"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { LayoutDashboard, FilePlus2, History } from "lucide-react"
import { cn } from "@/lib/utils"
import { vendedoresSeed } from "@/lib/seed-data"
import { useVendedorAtivo } from "@/context/vendedor-ativo-context"
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

export function VendedorShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { vendedorId, setVendedorId } = useVendedorAtivo()

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">
            T
          </div>
          <span className="text-sm font-semibold">Toldos Print</span>
        </div>
        <Select
          value={vendedorId}
          onValueChange={(v) => setVendedorId(v ?? vendedorId)}
        >
          <SelectTrigger className="h-8 w-32 text-xs">
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
      </header>

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
