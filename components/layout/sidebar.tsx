"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { gruposNavegacao } from "./nav-groups"
import { ThemeToggle } from "./theme-toggle"

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-card p-4 md:flex md:flex-col print:hidden">
      <div className="mb-6 flex items-center justify-between gap-2 px-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">
            T
          </div>
          <span className="text-sm font-semibold">Toldos Print</span>
        </div>
        <ThemeToggle />
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto">
        {gruposNavegacao.map((grupo) => (
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
      </nav>
    </aside>
  )
}
