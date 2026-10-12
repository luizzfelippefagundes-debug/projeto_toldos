"use client"

import Link from "next/link"
import { Bell, Check } from "lucide-react"
import { useAlertas } from "@/hooks/use-alertas"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

export function NotificacoesBell() {
  const alertas = useAlertas()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
        <span className="relative">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {alertas.length > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {alertas.length > 9 ? "9+" : alertas.length}
            </span>
          )}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Alertas</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {alertas.length === 0 ? (
          <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
            <Check className="h-4 w-4" />
            Tudo certo por aqui.
          </div>
        ) : (
          alertas.map((alerta) => (
            <DropdownMenuItem
              key={alerta.id}
              nativeButton={false}
              render={<Link href={alerta.href} />}
            >
              <alerta.Icon className="h-4 w-4 text-muted-foreground" />
              {alerta.texto}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
