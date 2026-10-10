import { currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { DataProvider } from "@/context/data-context"
import { PapelAtivoProvider } from "@/context/papel-ativo-context"
import { AppShell } from "@/components/layout/app-shell"
import { Toaster } from "@/components/ui/sonner"
import { resolverPapel } from "@/lib/papel"
import { InstalarApp } from "@/components/instalar-app"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await currentUser()
  if (!user) redirect("/sign-in")

  const papel = resolverPapel(user.publicMetadata?.papel)

  return (
    <DataProvider>
      <PapelAtivoProvider papelInicial={papel}>
        <AppShell>{children}</AppShell>
        <InstalarApp className="bottom-20 md:bottom-4" />
        <Toaster richColors position="top-right" />
      </PapelAtivoProvider>
    </DataProvider>
  )
}
