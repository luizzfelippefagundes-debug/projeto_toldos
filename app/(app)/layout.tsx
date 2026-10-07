import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { DataProvider } from "@/context/data-context"
import { PapelAtivoProvider } from "@/context/papel-ativo-context"
import { AppShell } from "@/components/layout/app-shell"
import { Toaster } from "@/components/ui/sonner"
import type { Papel } from "@/lib/types"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const user = await currentUser()
  const papel = ((user?.publicMetadata?.papel as Papel) ?? "dono")

  return (
    <DataProvider>
      <PapelAtivoProvider papelInicial={papel}>
        <AppShell>{children}</AppShell>
        <Toaster richColors position="top-right" />
      </PapelAtivoProvider>
    </DataProvider>
  )
}
