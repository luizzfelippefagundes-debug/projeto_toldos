"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import type { NavGroup } from "./nav-groups"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

interface NavSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  grupos: NavGroup[]
  titulo: string
  subtitulo?: string
  extra?: ReactNode
}

// Menu deslizante (Sheet) com os mesmos grupos de navegação usados na
// sidebar de desktop — usado tanto no menu mobile da loja
// (components/layout/app-shell.tsx) quanto no menu do vendedor
// (components/vendedor/vendedor-shell.tsx), pra não duplicar o mesmo
// componente de lista de navegação em dois lugares.
export function NavSheet({
  open,
  onOpenChange,
  grupos,
  titulo,
  subtitulo,
  extra,
}: NavSheetProps) {
  const pathname = usePathname()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle>{titulo}</SheetTitle>
          {subtitulo && (
            <p className="text-xs text-muted-foreground">{subtitulo}</p>
          )}
        </SheetHeader>

        {extra && <div className="px-4">{extra}</div>}

        <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
          {grupos.map((grupo) => (
            <div key={grupo.title}>
              <p className="mb-2 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
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
                      onClick={() => onOpenChange(false)}
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
      </SheetContent>
    </Sheet>
  )
}
