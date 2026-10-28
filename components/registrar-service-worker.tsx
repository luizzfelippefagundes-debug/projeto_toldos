"use client"

import { useEffect } from "react"

// Registra o service worker só em produção (em desenvolvimento ele atrapalha
// o recarregamento automático) e só na área logada.
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Sem service worker o app segue funcionando online, só não abre offline.
    })
  }, [])

  return null
}
