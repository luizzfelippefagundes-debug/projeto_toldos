"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  FilePlus2,
  History,
  Boxes,
  Wrench,
  Warehouse,
  Factory,
  Wallet,
  Lock,
} from "lucide-react"

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const grupos: NavGroup[] = [
  {
    title: "Principal",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Novo Orçamento", href: "/orcamentos/novo", icon: FilePlus2 },
      { label: "Histórico de Orçamentos", href: "/orcamentos", icon: History },
    ],
  },
  {
    title: "Cadastros",
    items: [
      { label: "Materiais", href: "/materiais", icon: Boxes },
      { label: "Mão de Obra", href: "/mao-de-obra", icon: Wrench },
    ],
  },
  {
    title: "Estoque",
    items: [{ label: "Estoque", href: "/estoque", icon: Warehouse }],
  },
]

const emBreve = [
  { label: "Produção", icon: Factory },
  { label: "Financeiro", icon: Wallet },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-card p-4 md:flex md:flex-col print:hidden">
      <div className="mb-6 flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">
          T
        </div>
        <span className="text-sm font-semibold">ToldoSys</span>
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto">
        {grupos.map((grupo) => (
          <div key={grupo.title}>
            <p className="mb-2 px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {grupo.title}
            </p>
            <div className="flex flex-col gap-1">
              {grupo.items.map((item) => {
                const ativo = pathname === item.href
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                      ativo
                        ? "bg-primary/15 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}

        <div>
          <p className="mb-2 px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Em breve
          </p>
          <div className="flex flex-col gap-1">
            {emBreve.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.label}
                  className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground/50"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                  <Lock className="ml-auto h-3 w-3" />
                </div>
              )
            })}
          </div>
        </div>
      </nav>
    </aside>
  )
}
