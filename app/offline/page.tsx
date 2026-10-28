import type { Metadata } from "next"
import { BotaoTentarNovamente } from "./botao-tentar-novamente"

export const metadata: Metadata = {
  title: "Sem internet — Toldos Print",
}

// Tela pública (sem login) que o service worker mostra quando uma página do
// app não abre por falta de internet. Ela é guardada no aparelho junto com o
// service worker (ver public/sw.js), então não depende de sessão nem do Clerk.
export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15 text-2xl">
        📡
      </div>
      <h1 className="text-xl font-semibold">Modo offline</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Você está sem internet. Esta tela está salva no aparelho e abriu mesmo
        sem sinal. O orçamento offline estará disponível aqui em breve.
      </p>
      <BotaoTentarNovamente />
    </main>
  )
}
