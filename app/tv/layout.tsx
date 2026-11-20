import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Painel TV - Toldos Print",
  manifest: "/tv.webmanifest",
}

export default function TvLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-white">{children}</div>
}
