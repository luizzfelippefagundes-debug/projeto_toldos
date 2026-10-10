import type { ReactNode } from "react"
import { VendedorShell } from "@/components/vendedor/vendedor-shell"

export default function VendedorLayout({
  children,
}: {
  children: ReactNode
}) {
  return <VendedorShell>{children}</VendedorShell>
}
