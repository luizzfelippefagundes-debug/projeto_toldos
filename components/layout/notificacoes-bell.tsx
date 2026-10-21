"use client"

import Link from "next/link"
import { useState } from "react"
import { Bell, Check, X } from "lucide-react"
import { useAlertas } from "@/hooks/use-alertas"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export function NotificacoesBell() {
  const alertas = useAlertas()
  const [aberto, setAberto] = useState(false)

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={<Button variant="ghost" size="icon" />}>
        <span className="relative">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {alertas.length > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {alertas.length > 9 ? "9+" : alertas.length}
            </span>
          )}
        </span>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notificações
          </DialogTitle>
        </DialogHeader>

        {alertas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
            <Check className="h-8 w-8 text-green-500" />
            <p className="font-medium">Tudo em ordem!</p>
            <p>Nenhum alerta no momento.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {alertas.map((alerta) => (
              <Link
                key={alerta.id}
                href={alerta.href}
                onClick={() => setAberto(false)}
                className="flex items-start gap-3 rounded-lg border border-border bg-accent/30 p-3 text-sm transition-colors hover:bg-accent"
              >
                <alerta.Icon className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <span>{alerta.texto}</span>
              </Link>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
