import type { ReactNode } from "react"
import { VendedorAtivoProvider } from "@/context/vendedor-ativo-context"
import { VendedorShell } from "@/components/vendedor/vendedor-shell"

export default function VendedorLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <VendedorAtivoProvider>
      <VendedorShell>{children}</VendedorShell>
    </VendedorAtivoProvider>
  )
}
