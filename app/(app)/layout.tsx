import { currentUser } from "@clerk/nextjs/server"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { DataProvider } from "@/context/data-context"
import { PapelAtivoProvider } from "@/context/papel-ativo-context"
import { AppShell } from "@/components/layout/app-shell"
import { Toaster } from "@/components/ui/sonner"
import { operadorPodeAcessar, resolverPapel } from "@/lib/papel"
import { InstalarApp } from "@/components/instalar-app"
import { RegistrarServiceWorker } from "@/components/registrar-service-worker"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await currentUser()
  if (!user) redirect("/sign-in")

  const papel = resolverPapel(user.publicMetadata?.papel)

  // Operador só vê Produção e Painel TV: qualquer outra página volta pra Produção.
  const pathname = (await headers()).get("x-pathname") ?? ""
  if (papel === "operador" && !operadorPodeAcessar(pathname)) {
    redirect("/producao")
  }

  return (
    <DataProvider>
      <PapelAtivoProvider papelInicial={papel}>
        <AppShell>{children}</AppShell>
        <InstalarApp className="bottom-20 md:bottom-4" />
        <RegistrarServiceWorker />
        <Toaster richColors position="top-right" />
      </PapelAtivoProvider>
    </DataProvider>
  )
}
