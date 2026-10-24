import type { ReactNode } from "react"

export default function TvLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-white">{children}</div>
}
