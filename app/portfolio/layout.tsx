import type { ReactNode } from "react"

export const metadata = {
  title: "Portfólio — Toldos Print",
  description: "Toldos e comunicação visual — veja nossos trabalhos.",
}

export default function PortfolioLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-background">{children}</div>
}
