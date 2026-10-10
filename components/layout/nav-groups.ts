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
  BarChart3,
  Bot,
  Users,
  Users2,
  Tv2,
  Megaphone,
  Smartphone,
  type LucideIcon,
} from "lucide-react"
import type { Papel } from "@/lib/types"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  // Quem vê esse item além do "dono" (que sempre vê tudo). Sem essa lista,
  // o item é visível pra qualquer papel.
  papeis?: Papel[]
  externo?: boolean
  // Visível apenas para o dono — escondido de todos os outros papéis.
  donoApenas?: boolean
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

// Estrutura de navegação completa do sistema — usada pela sidebar da loja
// (components/layout/sidebar.tsx) e pelo menu do vendedor
// (components/vendedor/vendedor-shell.tsx), já que o vendedor também é dono
// e precisa acessar tudo, não só a área dele. A filtragem por `papeis` (ver
// usePapelAtivo) só se aplica à loja — o vendedor sempre vê tudo.
export const gruposNavegacao: NavGroup[] = [
  {
    title: "Principal",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Gráfica Rápida", href: "/grafica-rapida", icon: Zap },
      { label: "Novo Orçamento", href: "/orcamentos/novo", icon: FilePlus2 },
      { label: "Área do Vendedor", href: "/vendedor", icon: Smartphone, donoApenas: true },
      {
        label: "Histórico de Orçamentos",
        href: "/orcamentos",
        icon: History,
        papeis: ["financeiro"],
      },
      {
        label: "Produção",
        href: "/producao",
        icon: Factory,
        papeis: ["producao"],
      },
      { label: "Central do Bot", href: "/bot", icon: Bot },
      { label: "Clientes", href: "/clientes", icon: Users },
      { label: "Avisos da TV", href: "/avisos-tv", icon: Megaphone, donoApenas: true },
      { label: "Painel TV", href: "/tv", icon: Tv2, externo: true, donoApenas: true },
      { label: "Equipe", href: "/equipe", icon: Users2, donoApenas: true },
    ],
  },
  {
    title: "Cadastros",
    items: [
      { label: "Materiais", href: "/materiais", icon: Boxes },
      {
        label: "Mão de Obra",
        href: "/mao-de-obra",
        icon: Wrench,
        papeis: ["producao"],
      },
    ],
  },
  {
    title: "Estoque",
    items: [
      {
        label: "Estoque",
        href: "/estoque",
        icon: Warehouse,
        papeis: ["producao"],
      },
    ],
  },
  {
    title: "Financeiro",
    items: [
      {
        label: "Financeiro",
        href: "/financeiro",
        icon: Wallet,
        papeis: ["financeiro"],
      },
      {
        label: "Relatórios",
        href: "/relatorios",
        icon: BarChart3,
        papeis: ["financeiro"],
      },
    ],
  },
]

// "Dono" sempre vê tudo; os demais papéis só veem os itens marcados pra
// eles. Grupos que ficam sem nenhum item visível também são removidos, pra
// não aparecer um título de seção vazio no menu.
export function filtrarGruposPorPapel(
  grupos: NavGroup[],
  papel: Papel
): NavGroup[] {
  return grupos
    .map((grupo) => ({
      ...grupo,
      items: grupo.items.filter((item) => {
        if (item.donoApenas && papel !== "dono") return false
        if (papel === "dono") return true
        return !item.papeis || item.papeis.includes(papel)
      }),
    }))
    .filter((grupo) => grupo.items.length > 0)
}
