import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Painel TV — Toldos Print",
  description: "Painel de produção em tempo real para Smart TV e fábrica",
  manifest: "/tv.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Painel TV Toldos Print",
    statusBarStyle: "black-translucent",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
}

export const viewport: Viewport = {
  themeColor: "#0f172a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function TvLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen max-h-screen w-screen max-w-full overflow-hidden bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-white">
      {children}
    </div>
  )
}
