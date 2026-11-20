"use client"

import { useEffect, useState } from "react"
import { Bell, BellRing, CheckCircle2, AlertCircle, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  obterStatusPermissaoNotificacao,
  solicitarPermissaoNotificacoes,
  dispararNotificacaoNativa,
  type StatusPermissao,
} from "@/lib/notificacoes-app"

export function NotificacoesPermissaoCard({
  variante = "card",
}: {
  variante?: "card" | "banner"
}) {
  const [status, setStatus] = useState<StatusPermissao>("default")
  const [pedindo, setPedindo] = useState(false)

  useEffect(() => {
    setStatus(obterStatusPermissaoNotificacao())
  }, [])

  if (status === "unsupported") {
    return null
  }

  async function handleHabilitar() {
    setPedindo(true)
    try {
      const ok = await solicitarPermissaoNotificacoes()
      const novoStatus = obterStatusPermissaoNotificacao()
      setStatus(novoStatus)
      if (ok) {
        toast.success("Notificações ativadas com sucesso neste aparelho!")
      } else if (novoStatus === "denied") {
        toast.error("Notificações bloqueadas nas permissões do navegador.")
      }
    } finally {
      setPedindo(false)
    }
  }

  async function handleTestar() {
    await dispararNotificacaoNativa(
      "🔔 Teste de Notificação - Toldos Print",
      "Funcionando perfeitamente! Os alertas de novas demandas e avisos chegarão aqui.",
      "/dashboard"
    )
    toast.success("Notificação enviada para o seu aparelho!")
  }

  if (variante === "banner") {
    if (status === "granted") return null

    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/10 p-3 text-xs text-foreground">
        <div className="flex items-center gap-2">
          <BellRing className="h-4 w-4 shrink-0 text-primary" />
          <span>
            {status === "denied"
              ? "Notificações bloqueadas no navegador. Clique no ícone de cadeado na barra de endereço para permitir."
              : "Ative as notificações deste app para receber alertas de novas demandas e avisos no celular."}
          </span>
        </div>
        {status !== "denied" && (
          <Button
            size="sm"
            onClick={handleHabilitar}
            disabled={pedindo}
            className="h-7 px-3 text-xs font-bold gap-1.5"
          >
            <Bell className="h-3 w-3" />
            {pedindo ? "Ativando..." : "Ativar Notificações"}
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3 flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Smartphone className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold leading-tight">
              Notificações no Aparelho (Push / Celular)
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {status === "granted"
                ? "Ativo neste dispositivo"
                : status === "denied"
                ? "Bloqueado pelo navegador"
                : "Ainda não ativado"}
            </p>
          </div>
        </div>

        {status === "granted" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
            <CheckCircle2 className="h-3 w-3" /> Ativo
          </span>
        )}
      </div>

      {status === "default" && (
        <div className="flex flex-col gap-2 pt-1">
          <p className="text-[11px] text-muted-foreground">
            Receba notificações na tela de bloqueio e som de aviso sempre que entrar uma nova demanda ou recado urgente.
          </p>
          <Button
            size="sm"
            onClick={handleHabilitar}
            disabled={pedindo}
            className="w-full h-8 text-xs font-bold gap-1.5"
          >
            <Bell className="h-3.5 w-3.5" />
            {pedindo ? "Solicitando..." : "Habilitar Notificações no Dispositivo"}
          </Button>
        </div>
      )}

      {status === "granted" && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-[11px] text-muted-foreground">
            Você receberá alertas sonoros e visuais neste aparelho.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={handleTestar}
            className="h-7 px-2.5 text-xs font-medium gap-1 shrink-0"
          >
            <Bell className="h-3 w-3" />
            Testar
          </Button>
        </div>
      )}

      {status === "denied" && (
        <div className="flex items-start gap-1.5 rounded-lg bg-destructive/10 p-2 text-[11px] text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            Notificações bloqueadas nas permissões do site. Clique no cadeado 🔒 na barra de endereços do seu navegador e altere para <strong>Permitir</strong>.
          </span>
        </div>
      )}
    </div>
  )
}
