"use client"

export type StatusPermissao = "granted" | "denied" | "default" | "unsupported"

export function obterStatusPermissaoNotificacao(): StatusPermissao {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported"
  }
  return Notification.permission
}

export async function solicitarPermissaoNotificacoes(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false
  }

  try {
    const permissao = await Notification.requestPermission()
    if (permissao === "granted") {
      await dispararNotificacaoNativa(
        "🔔 Notificações Ativadas!",
        "Pronto! Você receberá alertas em tempo real de novas demandas, pedidos e comunicados neste aparelho.",
        "/dashboard"
      )
      return true
    }
    return false
  } catch (err) {
    console.error("[notificacoes-app] erro ao pedir permissao:", err)
    return false
  }
}

export async function dispararNotificacaoNativa(
  titulo: string,
  corpo: string,
  url: string = "/dashboard"
): Promise<void> {
  if (typeof window === "undefined" || !("Notification" in window)) return
  if (Notification.permission !== "granted") return

  try {
    // Tenta via Service Worker primeiro (necessário no Android, iOS PWA e segundo plano)
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready.catch(() => null)
      if (reg && "showNotification" in reg) {
        await reg.showNotification(titulo, {
          body: corpo,
          icon: "/icon.png",
          badge: "/icon.png",
          data: { url },
          // @ts-expect-error vibrate suportado em browsers móveis
          vibrate: [200, 100, 200],
        })
        return
      }
    }

    // Fallback para Notification de janela tradicional
    const notif = new Notification(titulo, {
      body: corpo,
      icon: "/icon.png",
    })
    notif.onclick = () => {
      window.focus()
      if (url) window.location.href = url
      notif.close()
    }
  } catch (e) {
    console.warn("[notificacoes-app] falha ao disparar notificacao nativa:", e)
  }
}
