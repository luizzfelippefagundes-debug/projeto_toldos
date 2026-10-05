import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { DataProvider } from "@/context/data-context"
import { PapelAtivoProvider } from "@/context/papel-ativo-context"
import { AppShell } from "@/components/layout/app-shell"
import { Toaster } from "@/components/ui/sonner"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  return (
    <DataProvider>
      <PapelAtivoProvider>
        <AppShell>{children}</AppShell>
        <Toaster richColors position="top-right" />
      </PapelAtivoProvider>
    </DataProvider>
  )
}
