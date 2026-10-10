"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { usePapelAtivo } from "@/context/papel-ativo-context"
import { filtrarGruposPorPapel, gruposNavegacao } from "./nav-groups"
import { ThemeToggle } from "./theme-toggle"
import { Logo } from "@/components/brand/logo"
import { UserButton, useUser } from "@clerk/nextjs"
import { Bell } from "lucide-react"
import { useData } from "@/context/data-context"
import { ROTULO_PAPEL } from "@/lib/papel"

export function Sidebar() {
  const pathname = usePathname()
  const { papel } = usePapelAtivo()
  const { user } = useUser()
  const { totalAlertas } = useData()
  const grupos = filtrarGruposPorPapel(gruposNavegacao, papel)

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-border bg-card p-4 md:flex md:flex-col print:hidden">
      <div className="mb-6 flex items-center gap-2">
        <Link href="/dashboard" className="min-w-0 flex-1">
          <Logo />
        </Link>
        <ThemeToggle />
      </div>

      <nav className="-mr-2 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pr-2">
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
                    target={item.externo ? "_blank" : undefined}
                    rel={item.externo ? "noopener noreferrer" : undefined}
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

      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <div className="flex min-w-0 items-center gap-2">
          <UserButton />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium">
              {user?.firstName ?? user?.primaryEmailAddress?.emailAddress ?? "Minha conta"}
            </p>
            <p className="text-xs text-muted-foreground">{ROTULO_PAPEL[papel]}</p>
          </div>
        </div>
        {totalAlertas > 0 && (
          <Link href="/dashboard" className="relative">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {totalAlertas > 9 ? "9+" : totalAlertas}
            </span>
          </Link>
        )}
      </div>
    </aside>
  )
}
