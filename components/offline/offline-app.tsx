"use client"

import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import { ModoOfflineContext } from "@/context/modo-offline-context"
import { NovoOrcamentoForm } from "@/components/orcamento/novo-orcamento-form"
import { OfflineDataProvider } from "./offline-data-provider"

function formatarDataHora(iso: string) {
  const d = new Date(iso)
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
}

// Tela mostrada sem internet: faz o orçamento completo com os dados guardados
// no aparelho e põe na fila pra enviar depois.
export function OfflineApp() {
  return (
    <ModoOfflineContext.Provider value={true}>
      <OfflineDataProvider>
        {({ situacao, atualizadoEm }) => (
          <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-4 px-4 py-4">
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm print:hidden">
              <p className="font-medium">Modo offline</p>
              <p className="text-muted-foreground">
                Os orçamentos feitos aqui ficam salvos no aparelho e sobem sozinhos quando
                houver internet (abra o app com sinal).
                {atualizadoEm && ` Dados de ${formatarDataHora(atualizadoEm)}.`}
              </p>
            </div>

            {situacao === "carregando" && (
              <p className="text-sm text-muted-foreground">Carregando dados do aparelho…</p>
            )}

            {situacao === "sem-copia" && (
              <div className="flex flex-col items-start gap-3 rounded-lg border border-border p-4">
                <p className="font-medium">Ainda não há dados guardados neste aparelho.</p>
                <p className="text-sm text-muted-foreground">
                  Abra o sistema com internet pelo menos uma vez para guardar clientes,
                  materiais e serviços. Depois disso o orçamento funciona sem sinal.
                </p>
                {/* Navegação completa de propósito: sai da tela guardada e tenta a rede. */}
                {/* eslint-disable-next-line @next/next/no-location-assign-relative-destination */}
                <Button onClick={() => window.location.assign("/dashboard")}>
                  Tentar abrir o sistema
                </Button>
              </div>
            )}

            {situacao === "pronto" && (
              <Suspense fallback={null}>
                <NovoOrcamentoForm />
              </Suspense>
            )}
          </main>
        )}
      </OfflineDataProvider>
    </ModoOfflineContext.Provider>
  )
}
