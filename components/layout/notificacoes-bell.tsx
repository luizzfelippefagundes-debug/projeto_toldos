"use client"

import Link from "next/link"
import { useState } from "react"
import { Bell, Check, X } from "lucide-react"
import { useAlertas } from "@/hooks/use-alertas"
import { usePapelAtivo } from "@/context/papel-ativo-context"
import { NotificacoesPermissaoCard } from "./notificacoes-permissao-card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export function NotificacoesBell() {
  const { papel } = usePapelAtivo()
  const alertas = useAlertas()
  const [aberto, setAberto] = useState(false)

  // Colaborador não deve ter sininho de notificações de gestão/retornos/financeiro
  if (papel === "operador") return null

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
      <DialogContent className="w-[94vw] max-w-sm sm:max-w-md max-h-[85vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="shrink-0 pb-2 border-b border-border/50 pr-8">
          <DialogTitle className="flex items-center gap-2 text-base font-bold flex-wrap">
            <span className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary shrink-0" />
              <span>Notificações</span>
            </span>
            {alertas.length > 0 && (
              <span className="rounded-full bg-destructive/15 text-destructive font-bold text-xs px-2 py-0.5 shrink-0">
                {alertas.length} {alertas.length === 1 ? "alerta" : "alertas"}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Conteúdo com rolagem fluida e responsiva para qualquer celular */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pt-2 pr-1 pb-2 [scrollbar-width:thin]">
          {/* Card para os donos habilitarem notificações no aparelho (push/celular) */}
          <NotificacoesPermissaoCard />

          {alertas.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <Check className="h-8 w-8 text-emerald-500" />
              <p className="font-medium text-foreground">Tudo em ordem!</p>
              <p className="text-xs">Nenhum alerta pendente no momento.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {alertas.map((alerta) => (
                <Link
                  key={alerta.id}
                  href={alerta.href}
                  onClick={() => setAberto(false)}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border/80 bg-accent/30 p-3 text-xs sm:text-sm transition-colors hover:bg-accent active:scale-[0.99]"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <alerta.Icon className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <span className="leading-snug text-foreground font-medium break-words">{alerta.texto}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 font-semibold self-center">Ver →</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
