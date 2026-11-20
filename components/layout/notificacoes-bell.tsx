"use client"

import Link from "next/link"
import { useState } from "react"
import { Bell, Check, X, Trash2, RotateCcw } from "lucide-react"
import { useAlertas, type CategoriaAlerta } from "@/hooks/use-alertas"
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
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export function NotificacoesBell() {
  const { papel } = usePapelAtivo()
  const { alertas, secoes, apagarAlerta, limparTodos, restaurarTodos, total, temDispensados } = useAlertas()
  const [aberto, setAberto] = useState(false)
  const [abaAtiva, setAbaAtiva] = useState<"todas" | CategoriaAlerta>("todas")

  // Colaborador não deve ter sininho de notificações de gestão/retornos/financeiro
  if (papel === "operador") return null

  const secoesVisiveis =
    abaAtiva === "todas"
      ? secoes
      : secoes.filter((s) => s.categoria === abaAtiva)

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={<Button variant="ghost" size="icon" />}>
        <span className="relative">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {total > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {total > 9 ? "9+" : total}
            </span>
          )}
        </span>
      </DialogTrigger>
      <DialogContent className="w-[94vw] max-w-sm sm:max-w-md max-h-[85vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="shrink-0 pb-2 border-b border-border/50 pr-8">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <DialogTitle className="flex items-center gap-2 text-base font-bold flex-wrap">
              <span className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary shrink-0" />
                <span>Notificações</span>
              </span>
              {total > 0 && (
                <span className="rounded-full bg-destructive/15 text-destructive font-bold text-xs px-2 py-0.5 shrink-0">
                  {total} {total === 1 ? "alerta" : "alertas"}
                </span>
              )}
            </DialogTitle>

            {total > 0 && (
              <button
                type="button"
                onClick={() => {
                  limparTodos()
                  toast.success("Todas as notificações foram apagadas.")
                }}
                className="text-[11px] font-medium text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors cursor-pointer"
                title="Apagar todas as notificações visíveis"
              >
                <Trash2 className="h-3 w-3" />
                <span>Limpar todas</span>
              </button>
            )}
          </div>
        </DialogHeader>

        {/* Abas de Categorias / Seções */}
        {secoes.length > 1 && (
          <div className="shrink-0 flex items-center gap-1.5 overflow-x-auto pt-1 pb-1 text-xs border-b border-border/40 [scrollbar-width:none]">
            <button
              type="button"
              onClick={() => setAbaAtiva("todas")}
              className={cn(
                "rounded-lg px-2.5 py-1 font-semibold text-xs transition-colors shrink-0 cursor-pointer",
                abaAtiva === "todas"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-muted/70 text-muted-foreground hover:text-foreground"
              )}
            >
              Todas ({total})
            </button>
            {secoes.map((s) => (
              <button
                key={s.categoria}
                type="button"
                onClick={() => setAbaAtiva(s.categoria)}
                className={cn(
                  "rounded-lg px-2.5 py-1 font-semibold text-xs transition-colors shrink-0 flex items-center gap-1 cursor-pointer",
                  abaAtiva === s.categoria
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "bg-muted/70 text-muted-foreground hover:text-foreground"
                )}
              >
                <s.icone className="h-3 w-3" />
                <span>{s.titulo}</span>
                <span className="rounded-full bg-black/20 dark:bg-white/20 px-1 text-[10px]">
                  {s.alertas.length}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Conteúdo com rolagem fluida e responsiva para qualquer celular */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pt-2 pr-1 pb-2 [scrollbar-width:thin]">
          {/* Card para os donos habilitarem notificações no aparelho (push/celular) */}
          <NotificacoesPermissaoCard />

          {total === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <Check className="h-8 w-8 text-emerald-500" />
              <p className="font-medium text-foreground">Tudo em ordem!</p>
              <p className="text-xs">Nenhum alerta pendente no momento.</p>
              {temDispensados && (
                <button
                  type="button"
                  onClick={() => {
                    restaurarTodos()
                    toast.success("Notificações restauradas!")
                  }}
                  className="mt-2 text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Restaurar notificações apagadas</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {secoesVisiveis.map((secao) => (
                <div key={secao.categoria} className="flex flex-col gap-1.5">
                  {/* Cabeçalho da Seção */}
                  <div className="flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <secao.icone className={cn("h-3.5 w-3.5", secao.corTexto)} />
                      <span>{secao.titulo}</span>
                    </span>
                    <span className={cn("rounded-md border px-1.5 py-0.2 text-[10px]", secao.corBadge)}>
                      {secao.alertas.length}
                    </span>
                  </div>

                  {/* Lista de Alertas da Seção */}
                  <div className="flex flex-col gap-1.5">
                    {secao.alertas.map((alerta) => (
                      <div
                        key={alerta.id}
                        className={cn(
                          "group relative flex items-start justify-between gap-2 rounded-xl border p-2.5 text-xs sm:text-sm transition-all hover:shadow-xs active:scale-[0.99]",
                          alerta.categoria === "problema"
                            ? "border-red-500/60 bg-red-500/10 hover:bg-red-500/20 text-red-700 dark:text-red-300 font-bold"
                            : "border-border/80 bg-accent/25 hover:bg-accent/40 text-foreground"
                        )}
                      >
                        <Link
                          href={alerta.href}
                          onClick={() => setAberto(false)}
                          className="flex items-start gap-2 min-w-0 flex-1 pr-1"
                        >
                          <alerta.Icon
                            className={cn(
                              "mt-0.5 h-4 w-4 shrink-0",
                              alerta.categoria === "problema"
                                ? "text-red-600 dark:text-red-400 animate-pulse"
                                : "text-destructive"
                            )}
                          />
                          <span className="leading-snug break-words">{alerta.texto}</span>
                        </Link>

                        <div className="flex items-center gap-1 shrink-0 self-center">
                          <Link
                            href={alerta.href}
                            onClick={() => setAberto(false)}
                            className="text-xs shrink-0 font-bold opacity-80 hover:opacity-100 underline hover:no-underline"
                          >
                            Ver →
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              apagarAlerta(alerta.id)
                              toast.info("Notificação apagada.")
                            }}
                            className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/15 transition-colors cursor-pointer"
                            title="Apagar notificação"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {temDispensados && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      restaurarTodos()
                      toast.success("Notificações restauradas!")
                    }}
                    className="text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Restaurar notificações apagadas</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
