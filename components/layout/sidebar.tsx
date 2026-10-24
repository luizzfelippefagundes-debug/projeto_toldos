"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { usePapelAtivo } from "@/context/papel-ativo-context"
import { filtrarGruposPorPapel, gruposNavegacao } from "./nav-groups"
import { ThemeToggle } from "./theme-toggle"
import { Logo } from "@/components/brand/logo"
import { UserButton, useUser } from "@clerk/nextjs"
import { NotificacoesBell } from "./notificacoes-bell"
import { ROTULO_PAPEL } from "@/lib/papel"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"

const STORAGE_KEY = "sidebar-collapsed"

export function Sidebar() {
  const pathname = usePathname()
  const { papel } = usePapelAtivo()
  const { user } = useUser()
  const grupos = filtrarGruposPorPapel(gruposNavegacao, papel)

  const [collapsed, setCollapsed] = useState(false)
  const [montado, setMontado] = useState(false)

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1")
    } catch { /* ignorar */ }
    setMontado(true)
  }, [])

  function toggleCollapsed() {
    const novo = !collapsed
    setCollapsed(novo)
    try { localStorage.setItem(STORAGE_KEY, novo ? "1" : "0") } catch { /* ignorar */ }
  }

  // Evita flash de layout errado no SSR
  if (!montado) return <aside className="sticky top-0 hidden h-screen w-64 shrink-0 md:block" />

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-card p-3 transition-all duration-200 md:flex print:hidden",
        collapsed ? "w-[60px]" : "w-64"
      )}
    >
      {/* Topo: logo + botão colapsar */}
      <div className={cn("mb-5 flex items-center", collapsed ? "justify-center" : "justify-between gap-2")}>
        {!collapsed && (
          <Link href="/dashboard" className="min-w-0 flex-1">
            <Logo />
          </Link>
        )}
        <div className={cn("flex items-center gap-1", collapsed && "flex-col gap-2")}>
          {!collapsed && <ThemeToggle />}
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Expandir menu" : "Minimizar menu"}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {collapsed
              ? <PanelLeftOpen className="h-4 w-4" />
              : <PanelLeftClose className="h-4 w-4" />
            }
          </button>
          {collapsed && <ThemeToggle />}
        </div>
      </div>

      {/* Navegação */}
      <nav
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          collapsed
            ? "items-center gap-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            : "scroll-painel gap-5 -mr-1 pr-1 py-2"
        )}
      >
        {grupos.map((grupo, gi) => (
          <div
            key={grupo.title}
            className={cn(
              "flex flex-col",
              collapsed ? "w-full items-center" : "gap-1"
            )}
          >
            {/* Separador entre grupos no modo colapsado */}
            {collapsed && gi > 0 && (
              <div className="my-1 h-px w-8 rounded-full bg-border" />
            )}

            {!collapsed && (
              <p className="mb-1 px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {grupo.title}
              </p>
            )}

            <div className={cn("flex flex-col", collapsed ? "w-full items-center gap-0.5" : "gap-0.5")}>
              {grupo.items.map((item) => {
                const ativo = pathname === item.href
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    target={item.externo ? "_blank" : undefined}
                    rel={item.externo ? "noopener noreferrer" : undefined}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center rounded-md transition-colors",
                      collapsed
                        ? "h-9 w-10 justify-center"
                        : "gap-2 px-2 py-2 text-sm",
                      ativo
                        ? "bg-primary/15 text-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <Icon className={cn("shrink-0", collapsed ? "h-[18px] w-[18px]" : "h-4 w-4")} />
                    {!collapsed && <span className="font-medium">{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Rodapé: usuário + notificações */}
      <div className={cn(
        "mt-3 border-t border-border pt-3",
        collapsed ? "flex flex-col items-center gap-2" : "flex items-center justify-between"
      )}>
        {collapsed ? (
          <>
            <NotificacoesBell />
            <UserButton />
          </>
        ) : (
           <>
            <div className="flex min-w-0 items-center gap-2">
              <UserButton />
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-medium">
                  {user?.firstName ?? user?.primaryEmailAddress?.emailAddress ?? "Minha conta"}
                </p>
                <p className="text-xs text-muted-foreground">{ROTULO_PAPEL[papel]}</p>
              </div>
            </div>
            <NotificacoesBell />
          </>
        )}
      </div>
    </aside>
  )
}
