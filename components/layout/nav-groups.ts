import {
  LayoutDashboard,
  FilePlus2,
  History,
  Boxes,
  Wrench,
  Warehouse,
  Factory,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

// Estrutura de navegação completa do sistema — usada pela sidebar da loja
// (components/layout/sidebar.tsx) e pelo menu do vendedor
// (components/vendedor/vendedor-shell.tsx), já que o vendedor também é dono
// e precisa acessar tudo, não só a área dele.
export const gruposNavegacao: NavGroup[] = [
  {
    title: "Principal",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Gráfica Rápida", href: "/grafica-rapida", icon: Zap },
      { label: "Novo Orçamento", href: "/orcamentos/novo", icon: FilePlus2 },
      { label: "Histórico de Orçamentos", href: "/orcamentos", icon: History },
      { label: "Produção", href: "/producao", icon: Factory },
    ],
  },
  {
    title: "Cadastros",
    items: [
      { label: "Materiais", href: "/materiais", icon: Boxes },
      { label: "Mão de Obra", href: "/mao-de-obra", icon: Wrench },
    ],
  },
  {
    title: "Estoque",
    items: [{ label: "Estoque", href: "/estoque", icon: Warehouse }],
  },
  {
    title: "Financeiro",
    items: [{ label: "Financeiro", href: "/financeiro", icon: Wallet }],
  },
]
