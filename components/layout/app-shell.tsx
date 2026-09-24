"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "./sidebar"

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  // A área do vendedor (/vendedor/*) tem o próprio shell mobile (barra
  // superior + abas embaixo, ver app/vendedor/layout.tsx) — sem a sidebar da
  // loja. Ela ainda usa o mesmo DataProvider da raiz, só não usa este shell.
  if (pathname?.startsWith("/vendedor")) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-x-hidden p-6 md:p-8">
        {children}
      </main>
    </div>
  )
}
