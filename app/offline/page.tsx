import type { Metadata } from "next"
import { OfflineApp } from "@/components/offline/offline-app"

export const metadata: Metadata = {
  title: "Sem internet — Toldos Print",
}

// Tela pública (sem login) que o service worker mostra quando uma página do
// app não abre por falta de internet. Fica guardada no aparelho (ver
// public/sw.js) e roda o orçamento completo com os dados salvos no aparelho.
export default function OfflinePage() {
  return <OfflineApp />
}
