import { currentUser } from "@clerk/nextjs/server"
import { SignOutButton } from "@clerk/nextjs"
import { redirect } from "next/navigation"
import Image from "next/image"
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

  const email = user.primaryEmailAddress?.emailAddress
  const papel = resolverPapel(user.publicMetadata?.papel, email)

  if (!papel) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="flex max-w-sm flex-col items-center text-center">
          <Image
            src="/brand/mascote-rosto.png"
            alt="Print, o mascote da Toldos Print"
            width={96}
            height={96}
            className="mb-4 h-24 w-24 rounded-full ring-4 ring-[#ffd400]"
          />
          <h1 className="text-lg font-semibold">Conta aguardando liberação</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua conta ({email}) foi criada. Peça ao responsável para liberar seu
            acesso em Equipe. Depois, recarregue esta página.
          </p>
          <SignOutButton>
            <button className="mt-6 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
              Sair
            </button>
          </SignOutButton>
        </div>
        <InstalarApp />
      </div>
    )
  }

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
