import type { ReactNode } from "react"
import { Sidebar } from "./sidebar"

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-x-hidden p-6 md:p-8">
        {children}
      </main>
    </div>
  )
}
