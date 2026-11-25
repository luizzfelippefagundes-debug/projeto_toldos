"use client"

import Link from "next/link"
import { useUser } from "@clerk/nextjs"
import { useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { useData } from "@/context/data-context"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatarData, formatarMoeda } from "@/lib/format"
import { usePapelAtivo } from "@/context/papel-ativo-context"
import { dispararNotificacaoNativa } from "@/lib/notificacoes-app"
import type { Orcamento, Cliente, PedidoRapido, ProdutoRapido, StatusPedidoRapido } from "@/lib/types"
import { cn } from "@/lib/utils"
import { LOGO_PRINT_BASE64 } from "@/lib/logo-data"
import {
  obterPrazoEntregaPedido,
  pedidoRapidoEstaAtrasado,
} from "@/lib/pedidos-rapidos"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  RefreshCw,
  Search,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Package,
  UserRound,
  MessageCircle,
  FileCheck,
  Image as ImageIcon,
  Upload,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  SlidersHorizontal,
  Filter,
  Sparkles,
  EyeOff,
  FileText,
  Pencil,
  Plus,
  Printer,
  Camera,
  Eye,
  Scissors,
  ShieldCheck,
  Calendar,
  Flame,
  Send,
  Info,
  Coins,
  CreditCard,
  History,
} from "lucide-react"
import { HistoricoEntreguesDialog } from "@/components/producao/historico-entregues-dialog"
import { CobrancaCartaoDialog } from "@/components/orcamentos/cobranca-cartao-dialog"
import { comemorarComissao } from "@/lib/som-comissao"
import { linkWhatsapp } from "@/lib/whatsapp"
import { comprimirImagemParaUpload } from "@/lib/comprimir-imagem"
import { toast } from "sonner"

const STATUS_COM_NOTIFICACAO = new Set<StatusPedidoRapido>(["ag_confirmacao", "pronto", "entregue"])

function normalizarTelefone(tel: string): string {
  const digits = tel.replace(/\D/g, "")
  if (digits.startsWith("55") && digits.length >= 12) return digits
  if (digits.length === 11 || digits.length === 10) return `55${digits}`
  return digits
}

function tocarAlertaNovaDemanda() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {})
    }
    const notas = [523.25, 659.25, 783.99, 1046.50]
    notas.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.09
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.35, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.4)
    })
  } catch {}
}

function dispararVibracaoCelular() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator && typeof navigator.vibrate === "function") {
      navigator.vibrate([300, 100, 300, 100, 500])
    }
  } catch {}
}

function mensagemProducao(clienteNome: string, status: StatusPedidoRapido, idItem?: string): string {
  const nome = clienteNome.split(" ")[0] ?? ""
  if (status === "ag_confirmacao") {
    const link = idItem && typeof window !== "undefined"
      ? `${window.location.origin}/arte/${idItem}`
      : ""
    return `Olá${nome ? `, ${nome}` : ""}! 🎨 Sua arte está pronta para aprovação!\n\n${link ? `Você pode conferir e aprovar diretamente pelo link:\n${link}\n\n` : ""}Por favor, *confirme se está tudo certo* para darmos início à produção. Se precisar de algum ajuste, é só me falar. 😊`
  }
  if (status === "pronto") {
    return `Olá${nome ? `, ${nome}` : ""}! 🎉 Seu pedido está *pronto* para retirada/entrega!\n\nQualquer dúvida é só chamar. 😊`
  }
  if (status === "entregue") {
    return `Olá${nome ? `, ${nome}` : ""}! ✅ Confirmamos a entrega do seu pedido.\n\nObrigado pela preferência! Se precisar de algo mais, estamos à disposição. 😊`
  }
  return ""
}

const colunas: {
  status: StatusPedidoRapido
  titulo: string
  cor: string
  corFundo: string
  corBorda: string
  corTexto: string
  badgeFundo: string
}[] = [
  {
    status: "aguardando",
    titulo: "Ag. Assinatura",
    cor: "bg-slate-600",
    corFundo: "bg-slate-100/90 dark:bg-slate-800/40",
    corBorda: "border-slate-300 dark:border-slate-700/60",
    corTexto: "text-slate-800 dark:text-slate-200",
    badgeFundo: "bg-slate-200/90 dark:bg-slate-700/60",
  },
  {
    status: "aprovado",
    titulo: "Produção",
    cor: "bg-blue-600",
    corFundo: "bg-blue-50/90 dark:bg-blue-950/40",
    corBorda: "border-blue-200 dark:border-blue-800/60",
    corTexto: "text-blue-900 dark:text-blue-200",
    badgeFundo: "bg-blue-100 dark:bg-blue-900/60",
  },
  {
    status: "ag_confirmacao",
    titulo: "Arte Enviada",
    cor: "bg-pink-600",
    corFundo: "bg-pink-50/90 dark:bg-pink-950/40",
    corBorda: "border-pink-200 dark:border-pink-800/60",
    corTexto: "text-pink-900 dark:text-pink-200",
    badgeFundo: "bg-pink-100 dark:bg-pink-900/60",
  },
  {
    status: "impressao",
    titulo: "Impressão",
    cor: "bg-orange-600",
    corFundo: "bg-orange-50/90 dark:bg-orange-950/40",
    corBorda: "border-orange-200 dark:border-orange-800/60",
    corTexto: "text-orange-950 dark:text-orange-200",
    badgeFundo: "bg-orange-100 dark:bg-orange-900/60",
  },
  {
    status: "acabamento",
    titulo: "Acabamento",
    cor: "bg-amber-500",
    corFundo: "bg-amber-50/90 dark:bg-amber-950/40",
    corBorda: "border-amber-200 dark:border-amber-800/60",
    corTexto: "text-amber-950 dark:text-amber-200",
    badgeFundo: "bg-amber-100 dark:bg-amber-900/60",
  },
  {
    status: "pronto",
    titulo: "Pronto",
    cor: "bg-emerald-600",
    corFundo: "bg-emerald-50/90 dark:bg-emerald-950/40",
    corBorda: "border-emerald-200 dark:border-emerald-800/60",
    corTexto: "text-emerald-950 dark:text-emerald-200",
    badgeFundo: "bg-emerald-100 dark:bg-emerald-900/60",
  },
  {
    status: "entregue",
    titulo: "Entregue",
    cor: "bg-teal-600",
    corFundo: "bg-teal-50/90 dark:bg-teal-950/40",
    corBorda: "border-teal-200 dark:border-teal-800/60",
    corTexto: "text-teal-950 dark:text-teal-200",
    badgeFundo: "bg-teal-100 dark:bg-teal-900/60",
  },
]

const colunaMap = Object.fromEntries(colunas.map((c) => [c.status, c])) as Record<
  StatusPedidoRapido,
  (typeof colunas)[number]
>
if (!colunaMap.arte) {
  colunaMap.arte = colunaMap.aprovado
}

const PROXIMO_STATUS: Partial<Record<StatusPedidoRapido, StatusPedidoRapido>> = {
  aguardando: "aprovado",
  aprovado: "ag_confirmacao",
  arte: "ag_confirmacao",
  ag_confirmacao: "impressao",
  impressao: "acabamento",
  acabamento: "pronto",
  pronto: "entregue",
}

const statusValidos = new Set<string>(colunas.map((c) => c.status))

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter((p) => /[a-zA-ZÀ-ú]/.test(p[0]))
  if (partes.length === 0) return null
  return partes.slice(0, 2).map((p) => p[0]).join("").toUpperCase()
}

export default function ProducaoPage() {
  const { user } = useUser()
  const { papel } = usePapelAtivo()
  const meuNome = useMemo(() => {
    if (!user) return ""
    return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || ""
  }, [user])
  const {
    pedidosRapidos,
    produtosRapidos,
    moverPedidoRapido,
    orcamentos,
    clientes,
    moverOrcamentoProducao,
    salvarArteOrcamento,
    salvarArtePedidoRapido,
    concluirPecaPronta,
    salvarObservacaoOrcamento,
    salvarObservacaoPedidoRapido,
  } = useData()
  const [busca, setBusca] = useState("")
  const [colunaAtiva, setColunaAtiva] = useState<StatusPedidoRapido | "todas">("todas")
  const [ocultarEntregues, setOcultarEntregues] = useState(false)
  const [colunasVisiveis, setColunasVisiveis] = useState<string[]>(() => colunas.map((c) => c.status))
  const [modalHistoricoEntregues, setModalHistoricoEntregues] = useState(false)
  const [filtroPreset, setFiltroPreset] = useState<"todos" | "recentes_5" | "os" | "rapida" | "atrasados" | "hoje">("todos")
  const [ocultarVazias, setOcultarVazias] = useState(false)
  const [arrastandoId, setArrastandoId] = useState<string | null>(null)
  const [abaColaborador, setAbaColaborador] = useState<"fila" | "prontos">("fila")
  const [confirmando, setConfirmando] = useState<{
    clienteNome: string
    clienteTelefone: string | null
    novoStatus: StatusPedidoRapido
    mensagem: string
    enviando: boolean
    executar: () => void
  } | null>(null)
  const [assinaturas, setAssinaturas] = useState<Record<string, { pdfUrl: string | null; assinado: boolean }>>({})
  const [ordemManual, setOrdemManual] = useState<string[]>([])

  // Avisos do Mural da Fábrica (Recados do Kaio / Central Telão)
  const [avisosTv, setAvisosTv] = useState<{
    id: string
    mensagem: string
    criado_em: string
    cor: string
    icone: string
    ativo?: boolean
  }[]>([])

  useEffect(() => {
    function carregarAvisos() {
      fetch("/api/avisos-tv")
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => {
          if (Array.isArray(d)) {
            setAvisosTv(d.filter((item) => item.ativo !== false).slice(0, 3))
          }
        })
        .catch(() => {})
    }
    carregarAvisos()
    const timer = setInterval(carregarAvisos, 20000)
    return () => clearInterval(timer)
  }, [])

  // Modais de Visualizador de Arte, Checklist de Qualidade (QC) e Problema
  const [modalArtePreview, setModalArtePreview] = useState<{ url: string; titulo: string } | null>(null)

  const [modalQcItem, setModalQcItem] = useState<{
    tipo: "pedido" | "orcamento"
    id: string
    numero: number
    clienteNome: string
    clienteTelefone: string | null
    fotoAtual?: string
    comissaoPercent?: number
    valorTotal?: number
    produtoNome?: string
    quantidadeTotal?: number
  } | null>(null)
  const [qcChecks, setQcChecks] = useState({ medidas: true, acabamento: true, visual: true })
  const [qcUploading, setQcUploading] = useState(false)
  const [qcFotomUrl, setQcFotomUrl] = useState<string | null>(null)
  const qcFileInputRef = useRef<HTMLInputElement>(null)
  const qcCameraInputRef = useRef<HTMLInputElement>(null)
  const qcGaleriaInputRef = useRef<HTMLInputElement>(null)
  const [equipeDisponivel, setEquipeDisponivel] = useState<string[]>([
    "Marcos",
    "Lucas",
    "Kaio",
    "Serralheria",
    "Impressão / Acabamento",
  ])
  const [colaboradoresPecas, setColaboradoresPecas] = useState<Record<string, number>>({})

  useEffect(() => {
    fetch("/api/equipe")
      .then((r) => r.json())
      .then((dados) => {
        if (Array.isArray(dados) && dados.length > 0) {
          const nomes = dados.map((u: any) => u.nome).filter(Boolean)
          setEquipeDisponivel((prev) => Array.from(new Set([...prev, ...nomes, ...(meuNome ? [meuNome] : [])])))
        }
      })
      .catch(() => {})
  }, [meuNome])

  const [modalProblemaItem, setModalProblemaItem] = useState<{
    tipo: "pedido" | "orcamento"
    id: string
    numero: number
    clienteNome: string
    obsAtual?: string
  } | null>(null)
  const [motivoProblema, setMotivoProblema] = useState("")
  const [detalheProblema, setDetalheProblema] = useState("")
  const [salvandoProblema, setSalvandoProblema] = useState(false)

  const [modalDetalhesItem, setModalDetalhesItem] = useState<{
    tipo: "pedido" | "orcamento"
    id: string
    numero: number
    clienteNome: string
    clienteTelefone?: string | null
    total?: number
    largura?: number | null
    altura?: number | null
    quantidade?: number
    produtoNome?: string
    varianteNome?: string
    acabamento?: string | null
    observacao?: string
    arteUrl?: string | null
    fotosLocal?: string[]
    status: string
    contratoAssinado?: boolean
    osUrl?: string
    contratoUrl?: string
    dataEmissao?: string | null
    tipoServico?: string
    comissaoPercent?: number
    fotoProntoUrl?: string
  } | null>(null)

  const [abrindoAssinatura, setAbrindoAssinatura] = useState(false)
  const [enviandoCobrancaModal, setEnviandoCobrancaModal] = useState(false)
  const [enviandoOsWhatsapp, setEnviandoOsWhatsapp] = useState(false)
  const [enviandoAssinaturaWhatsapp, setEnviandoAssinaturaWhatsapp] = useState(false)

  // Atualização em tempo real: se o cliente já assinou, o sistema reconhece imediatamente e bloqueia reenviar assinatura
  useEffect(() => {
    if (!modalDetalhesItem || modalDetalhesItem.tipo !== "orcamento") return
    fetch(`/api/assinar/por-orcamento/${modalDetalhesItem.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.assinado) {
          setModalDetalhesItem((prev) =>
            prev && prev.id === modalDetalhesItem.id ? { ...prev, contratoAssinado: true } : prev
          )
        }
      })
      .catch(() => {})
  }, [modalDetalhesItem?.id])

  const handleAbrirOsPdf = (item: typeof modalDetalhesItem) => {
    if (!item) return
    const url = `/api/orcamentos/${item.id}/os/pdf`
    const win = window.open(url, "_blank")
    if (!win) {
      window.location.href = url
    }
  }

  const handleEnviarOsWhatsapp = async (item: typeof modalDetalhesItem) => {
    if (!item) return
    if (!item.clienteTelefone) {
      toast.error("Este cliente não tem telefone cadastrado.")
      return
    }
    setEnviandoOsWhatsapp(true)
    try {
      if (item.tipo === "orcamento") {
        const res = await fetch("/api/whatsapp/enviar-os", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orcamentoId: item.id,
            telefone: normalizarTelefone(item.clienteTelefone),
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data.erro || "Falha no envio automático do bot")
        }
        toast.success("✅ Ordem de Serviço (PDF) enviada automaticamente pelo robô!")
      } else {
        const msg = `Olá, ${item.clienteNome.split(" ")[0]}! Segue a sua Ordem de Serviço #${item.numero} da Toldos Print. 📄✨`
        const resNotif = await fetch("/api/whatsapp/enviar-notificacao", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            telefone: normalizarTelefone(item.clienteTelefone),
            mensagem: msg,
            clienteNome: item.clienteNome,
          }),
        })
        if (!resNotif.ok) throw new Error("Falha no envio automático do robô")
        toast.success("✅ Ordem de Serviço enviada automaticamente pelo robô!")
      }
    } catch (err: any) {
      console.error("Erro ao enviar OS via bot:", err)
      toast.error(err?.message || "Não foi possível enviar a OS pelo robô. Verifique a conexão do bot.")
    } finally {
      setEnviandoOsWhatsapp(false)
    }
  }

  const handleAbrirAssinatura = async (item: typeof modalDetalhesItem) => {
    if (!item) return
    setAbrindoAssinatura(true)
    // Abre a aba imediatamente no clique para garantir que navegadores (Chrome, Safari, Firefox) não bloqueiem como popup
    const popup = window.open("about:blank", "_blank")

    try {
      if (item.tipo === "orcamento") {
        const res = await fetch(`/api/assinar/por-orcamento/${item.id}`)
        const data = res.ok ? await res.json() : null
        if (data?.assinado && data.pdfUrl) {
          if (popup) popup.location.href = data.pdfUrl
          else window.location.href = data.pdfUrl
          return
        }
        if (data?.token) {
          const destino = `/assinar/${data.token}`
          if (popup) popup.location.href = destino
          else window.location.href = destino
          return
        }
        const resCriar = await fetch("/api/assinar/criar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orcamentoId: item.id }),
        })
        if (resCriar.ok) {
          const d = await resCriar.json()
          if (d.url) {
            if (popup) popup.location.href = d.url
            else window.location.href = d.url
            return
          }
        }
      }
      const fallbackUrl = item.contratoUrl || `/orcamentos/${item.id}/contrato`
      if (popup) popup.location.href = fallbackUrl
      else window.location.href = fallbackUrl
    } catch {
      if (popup) popup.close()
      toast.error("Erro ao abrir link de assinatura")
    } finally {
      setAbrindoAssinatura(false)
    }
  }

  const handleEnviarAssinaturaWhatsapp = async (item: typeof modalDetalhesItem) => {
    if (!item) return
    if (!item.clienteTelefone) {
      toast.error("Este cliente não tem telefone cadastrado.")
      return
    }
    setEnviandoAssinaturaWhatsapp(true)
    try {
      if (item.tipo === "orcamento") {
        if (item.contratoAssinado) {
          toast.info("Este contrato já foi assinado digitalmente pelo cliente! Não é necessário reenviar.")
          return
        }

        let linkAssinatura = ""
        const resToken = await fetch("/api/assinar/criar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orcamentoId: item.id }),
        })
        if (resToken.ok) {
          const dToken = await resToken.json()
          linkAssinatura = dToken.url
        }

        const msg = `Olá, ${item.clienteNome.split(" ")[0]}! Segue o link para conferência e assinatura digital da sua Ordem de Serviço nº ${item.numero} da Toldos Print: ✍️📄\n\n👉 ${linkAssinatura || `${window.location.origin}/orcamentos/${item.id}/contrato`}\n\nVocê pode assinar diretamente na tela do seu celular em menos de 1 minuto!`

        const resNotif = await fetch("/api/whatsapp/enviar-notificacao", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            telefone: normalizarTelefone(item.clienteTelefone),
            mensagem: msg,
            clienteNome: item.clienteNome,
          }),
        })

        const dNotif = await resNotif.json().catch(() => ({}))
        if (!resNotif.ok || !dNotif.ok) {
          throw new Error(dNotif?.resultado?.erro || "Falha no envio automático do robô")
        }

        toast.success("✅ Link de assinatura enviado automaticamente pelo robô!")
      } else {
        const msg = `Olá, ${item.clienteNome.split(" ")[0]}! Segue o link para assinar sua OS nº ${item.numero}: ✍️`
        const resNotif = await fetch("/api/whatsapp/enviar-notificacao", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            telefone: normalizarTelefone(item.clienteTelefone),
            mensagem: msg,
            clienteNome: item.clienteNome,
          }),
        })
        if (!resNotif.ok) throw new Error("Falha no envio automático do robô")
        toast.success("✅ Link de assinatura enviado pelo robô!")
      }
    } catch (err: any) {
      console.error("Erro ao enviar assinatura via bot:", err)
      toast.error(err?.message || "Erro ao enviar assinatura pelo robô.")
    } finally {
      setEnviandoAssinaturaWhatsapp(false)
    }
  }

  const handleEnviarCobrancaWhatsapp = async (item: typeof modalDetalhesItem) => {
    if (!item) return
    if (!item.clienteTelefone) {
      toast.error("Este cliente não tem telefone cadastrado.")
      return
    }

    setEnviandoCobrancaModal(true)
    try {
      const res = await fetch("/api/whatsapp/enviar-cobranca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orcamentoId: item.tipo === "orcamento" ? item.id : undefined,
          telefone: normalizarTelefone(item.clienteTelefone),
          clienteNome: item.clienteNome,
          valor: item.total || 0,
          numero: item.numero,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        throw new Error(data.erro || "Falha no envio automático pelo robô")
      }

      toast.success("✅ Cobrança (Pix e Cartão em até 12x) enviada automaticamente pelo robô!")
    } catch (err: any) {
      console.error("Erro ao enviar cobrança via robô:", err)
      toast.error(err?.message || "Não foi possível enviar a cobrança pelo robô. Verifique a conexão do bot.")
    } finally {
      setEnviandoCobrancaModal(false)
    }
  }

  const abrirQc = useCallback(
    (item: {
      tipo: "pedido" | "orcamento"
      id: string
      numero: number
      clienteNome: string
      clienteTelefone: string | null
      fotoAtual?: string
      comissaoPercent?: number
      valorTotal?: number
      produtoNome?: string
      quantidadeTotal?: number
    }) => {
      setModalQcItem(item)
      setQcChecks({ medidas: true, acabamento: true, visual: true })
      setQcFotomUrl(item.fotoAtual || null)
      if (meuNome && equipeDisponivel.includes(meuNome)) {
        setColaboradoresPecas({ [meuNome]: item.quantidadeTotal || 1 })
      } else {
        setColaboradoresPecas({})
      }
    },
    [meuNome, equipeDisponivel]
  )

  const handleUploadQcFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0]
    if (!rawFile) return
    setQcUploading(true)
    const toastId = toast.loading("Otimizando foto de alta resolução...")
    try {
      // Otimiza e comprime fotos gigantes (10MB, 20MB, 50MB) mantendo nitidez HD para inspeção
      const file = await comprimirImagemParaUpload(rawFile)
      toast.loading("Enviando foto da peça...", { id: toastId })
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: form })
      const data = await res.json()
      if (data.url) {
        setQcFotomUrl(data.url)
        toast.success("Foto da peça carregada com sucesso!", { id: toastId })
      } else {
        toast.error(data.error || "Erro ao enviar foto", { id: toastId })
      }
    } catch (err: any) {
      console.error("Erro no upload da foto QC:", err)
      toast.error("Erro de conexão no upload da foto", { id: toastId })
    } finally {
      setQcUploading(false)
      if (qcFileInputRef.current) qcFileInputRef.current.value = ""
      if (qcCameraInputRef.current) qcCameraInputRef.current.value = ""
      if (qcGaleriaInputRef.current) qcGaleriaInputRef.current.value = ""
    }
  }

  const handleConcluirQc = async () => {
    if (!modalQcItem) return
    if (!qcFotomUrl) {
      toast.error("É OBRIGATÓRIO tirar ou anexar a foto da peça pronta para concluir e liberar a comissão!")
      return
    }

    // Se houve comissão configurada (Calculado conforme a quantidade de peças que cada um produziu)
    if (modalQcItem.comissaoPercent && modalQcItem.comissaoPercent > 0) {
      const valorPedidoArredondado = Math.round((modalQcItem.valorTotal || 0) * 100) / 100
      const totalBonusCalculado = Math.round(((valorPedidoArredondado * modalQcItem.comissaoPercent) / 100) * 100) / 100
      comemorarComissao()

      const nomesColabs = Object.keys(colaboradoresPecas)
      const totalPecas = Object.values(colaboradoresPecas).reduce((a, b) => a + b, 0) || 1

      // Mapear cada colaborador com suas respectivas peças e valores proporcionais
      const colabsPayload = nomesColabs.length > 0
        ? nomesColabs.map((nome) => {
            const pecas = colaboradoresPecas[nome] || 1
            const valor = Math.round(((totalBonusCalculado * pecas) / totalPecas) * 100) / 100
            return {
              nome,
              pecas,
              valor,
            }
          })
        : [{ nome: "Equipe de Produção", pecas: 1, valor: totalBonusCalculado }]

      // Persistir no Banco de Comissões & RH da empresa
      fetch("/api/comissoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          colaboradores: colabsPayload,
          origem_tipo: modalQcItem.tipo,
          origem_id: modalQcItem.id,
          numero: modalQcItem.numero,
          cliente_nome: modalQcItem.clienteNome,
          produto_nome: modalQcItem.produtoNome || (modalQcItem.tipo === "pedido" ? "Pedido Rápido" : "Comunicação Visual"),
          valor_pedido: valorPedidoArredondado,
          comissao_percent: modalQcItem.comissaoPercent,
          valor_comissao: totalBonusCalculado,
        }),
      }).catch((err) => console.error("Erro ao registrar comissão no banco:", err))

      if (colabsPayload.length > 0) {
        const resumoToast = colabsPayload
          .map((c) => `${c.nome}: ${c.pecas} ${c.pecas === 1 ? "peça" : "peças"} (R$ ${c.valor.toFixed(2)})`)
          .join(" | ")
        toast.success(`🪙 BÔNUS CREDITADO! ${resumoToast}`, { duration: 6000 })
      }
    }

    const item = modalQcItem
    const fotoConcluida = qcFotomUrl
    setModalQcItem(null)

    // Status "pronto" e foto da peça numa única gravação: em chamadas
    // separadas as duas corriam entre si e a última apagava o campo da
    // outra, deixando a peça presa no status anterior.
    concluirPecaPronta(item.tipo, item.id, fotoConcluida)
    toast.success(`✅ Peça #${item.numero} concluída e foto enviada ao Kaio!`)

    // Opcionalmente abrir confirmação de WhatsApp se for dono/atendimento com telefone
    if (papel !== "operador" && item.clienteTelefone) {
      solicitarConfirmacao(
        item.clienteNome,
        item.clienteTelefone,
        "pronto",
        () => {},
        item.id
      )
    }
  }

  const handleImprimirFicha = (item: any) => {
    if (!item) return

    const dataHoje = new Date().toLocaleDateString("pt-BR")
    const horaHoje = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    const fotoLocal = item.fotosLocal?.[0]
    const arteUrl = item.arteUrl

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Ficha de Produção - #${item.numero} ${item.clienteNome}</title>
        <base href="${typeof window !== 'undefined' ? window.location.origin : ''}/">
        <style>
          @page { size: A4; margin: 12mm; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111; margin: 0; padding: 0; font-size: 13px; line-height: 1.4; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
          .logo { font-size: 20px; font-weight: 900; letter-spacing: -0.5px; }
          .logo span { color: #f59e0b; }
          .badge-os { background: #000; color: #fff; font-size: 15px; font-weight: 800; padding: 4px 10px; border-radius: 6px; }
          .grid-info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
          .box { border: 1px solid #ccc; border-radius: 6px; padding: 8px 10px; background: #fafafa; }
          .box-title { font-size: 10px; text-transform: uppercase; font-weight: bold; color: #666; margin-bottom: 3px; }
          .box-val { font-size: 14px; font-weight: 700; color: #000; }
          .box-destaque { border: 2px solid #000; background: #fffbe6; padding: 10px 12px; margin-bottom: 12px; border-radius: 6px; }
          .dimensoes-title { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #b45309; }
          .dimensoes-val { font-size: 20px; font-weight: 900; color: #000; margin-top: 2px; }
          .instrucoes { border: 1.5px solid #d97706; background: #fffbeb; padding: 10px 12px; border-radius: 6px; margin-bottom: 14px; }
          .instrucoes-title { font-size: 11px; font-weight: 800; color: #b45309; text-transform: uppercase; margin-bottom: 4px; }
          .instrucoes-text { font-size: 13px; font-weight: 600; white-space: pre-wrap; }
          .fotos-container { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
          .foto-box { border: 1px solid #ccc; border-radius: 6px; padding: 6px; text-align: center; }
          .foto-box img { max-width: 100%; max-height: 220px; object-fit: contain; border-radius: 4px; }
          .foto-label { font-size: 11px; font-weight: 700; color: #444; margin-top: 4px; }
          .checklist { border: 1px solid #000; border-radius: 6px; padding: 10px 12px; margin-top: 14px; }
          .check-item { display: inline-block; width: 32%; font-size: 12px; font-weight: 600; }
          .assinaturas { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 30px; }
          .campo-ass { border-top: 1px solid #000; text-align: center; font-size: 11px; font-weight: bold; padding-top: 4px; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img src="${LOGO_PRINT_BASE64}" alt="Toldos Print" style="height: 46px; width: auto; object-fit: contain; display: block;" />
            <div style="border-left: 1.5px solid #ccc; padding-left: 10px;">
              <div style="font-size: 14px; font-weight: 900; color: #111; letter-spacing: -0.3px;">TOLDOS PRINT</div>
              <div style="font-size: 10.5px; color: #555;">toldosprint@outlook.com · Ficha de Instrução para Bancada</div>
            </div>
          </div>
          <div class="badge-os">
            ${item.tipo === "pedido" ? "PEDIDO RAPIDO #" : "ORDEM DE SERVIÇO #"}${item.numero}
          </div>
        </div>

        <div class="grid-info">
          <div class="box">
            <div class="box-title">Cliente</div>
            <div class="box-val">${item.clienteNome}</div>
            <div style="font-size: 11px; color: #555;">${item.clienteTelefone || "Sem telefone"}</div>
          </div>
          <div class="box">
            <div class="box-title">Emissão / Entrada</div>
            <div class="box-val">${item.dataEmissao ? new Date(item.dataEmissao).toLocaleDateString("pt-BR") : dataHoje}</div>
            <div style="font-size: 11px; color: #555;">Impresso em: ${dataHoje} às ${horaHoje}</div>
          </div>
        </div>

        ${
          item.largura != null && item.altura != null
            ? `
          <div class="box-destaque">
            <div class="dimensoes-title">📏 Medidas Exatas para Produção (Trena)</div>
            <div class="dimensoes-val">${item.largura} m (Largura) × ${item.altura} m (Altura) ${item.quantidade && item.quantidade > 1 ? `· ${item.quantidade} unidades` : ""}</div>
          </div>
        `
            : ""
        }

        <div class="grid-info">
          <div class="box">
            <div class="box-title">Produto / Serviço</div>
            <div class="box-val">${item.produtoNome || "Comunicação Visual"}</div>
          </div>
          <div class="box">
            <div class="box-title">Material / Acabamento</div>
            <div class="box-val">${[item.varianteNome, item.acabamento].filter(Boolean).join(" · ") || "Conforme especificação"}</div>
          </div>
        </div>

        ${
          item.observacao
            ? `
          <div class="instrucoes">
            <div class="instrucoes-title">⚠️ Instruções Técnicas da Fábrica / Kaio</div>
            <div class="instrucoes-text">${item.observacao}</div>
          </div>
        `
            : ""
        }

        ${
          fotoLocal || arteUrl
            ? `
          <div class="fotos-container">
            ${
              fotoLocal
                ? `
              <div class="foto-box">
                <img src="${fotoLocal}" alt="Foto do Local" />
                <div class="foto-label">📸 Foto do Local / Fachada (Levantamento)</div>
              </div>
            `
                : `<div class="foto-box" style="display:flex;align-items:center;justify-content:center;color:#888;">Sem foto do local</div>`
            }
            ${
              arteUrl
                ? `
              <div class="foto-box">
                <img src="${arteUrl}" alt="Arte Aprovada" />
                <div class="foto-label">🎨 Arte Aprovada / Layout Final</div>
              </div>
            `
                : `<div class="foto-box" style="display:flex;align-items:center;justify-content:center;color:#888;">Sem arte anexada</div>`
            }
          </div>
        `
            : ""
        }

        <div class="checklist">
          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; margin-bottom: 6px;">
            Conferência de Qualidade de Bancada (QC):
          </div>
          <div class="check-item">[ &nbsp; ] Medidas no Esquadro</div>
          <div class="check-item">[ &nbsp; ] Solda / Acabamento OK</div>
          <div class="check-item">[ &nbsp; ] Limpeza e Sem Riscos</div>
        </div>

        <div class="assinaturas">
          <div class="campo-ass">Colaborador Responsável</div>
          <div class="campo-ass">Visto do Kaio / Conferência</div>
        </div>

        <script>
          setTimeout(function() {
            window.focus();
            window.print();
          }, 350);
        </script>
      </body>
      </html>
    `

    // Método 1: Imprimir via iframe invisível (evita bloqueio de popup em celulares e navegadores)
    try {
      let iframe = document.getElementById("iframe-impressao-ficha") as HTMLIFrameElement
      if (!iframe) {
        iframe = document.createElement("iframe")
        iframe.id = "iframe-impressao-ficha"
        iframe.style.position = "fixed"
        iframe.style.right = "0"
        iframe.style.bottom = "0"
        iframe.style.width = "0"
        iframe.style.height = "0"
        iframe.style.border = "0"
        document.body.appendChild(iframe)
      }

      const doc = iframe.contentWindow?.document || iframe.contentDocument
      if (doc) {
        doc.open()
        doc.write(html)
        doc.close()
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus()
            iframe.contentWindow?.print()
          } catch (e) {
            console.warn("Iframe print error:", e)
          }
        }, 350)
        return
      }
    } catch (e) {
      console.warn("Iframe não suportado, usando fallback:", e)
    }

    // Método 2 (Fallback): Abrir em nova aba com disparo direto do print
    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.open()
      printWindow.document.write(html)
      printWindow.document.close()
      setTimeout(() => {
        try {
          printWindow.focus()
          printWindow.print()
        } catch {}
      }, 400)
    } else {
      toast.error("Permita pop-ups no navegador para imprimir a ficha.")
    }
  }

  const handleRegistrarProblema = async () => {
    if (!modalProblemaItem) return
    if (!motivoProblema.trim() && !detalheProblema.trim()) {
      toast.error("Selecione um motivo ou descreva o problema.")
      return
    }
    setSalvandoProblema(true)
    try {
      const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      const motivoFormatado = motivoProblema ? `[${motivoProblema}]` : ""
      const novoAlerta = `⚠️ ALERTA DA FÁBRICA (${hora}) ${motivoFormatado}: ${detalheProblema.trim()}`
      const obsFinal = modalProblemaItem.obsAtual
        ? `${modalProblemaItem.obsAtual}\n\n${novoAlerta}`
        : novoAlerta

      if (modalProblemaItem.tipo === "pedido") {
        await salvarObservacaoPedidoRapido(modalProblemaItem.id, obsFinal)
      } else {
        await salvarObservacaoOrcamento(modalProblemaItem.id, obsFinal)
      }

      tocarAlertaNovaDemanda()
      dispararVibracaoCelular()
      toast.warning("Alerta de problema registrado no pedido!", {
        description: "A equipe e os donos foram alertados.",
      })
      dispararNotificacaoNativa(
        `⚠️ Problema no #${modalProblemaItem.numero} - ${modalProblemaItem.clienteNome}`,
        novoAlerta,
        "/producao"
      )

      setModalProblemaItem(null)
      setMotivoProblema("")
      setDetalheProblema("")
    } catch {
      toast.error("Erro ao registrar alerta de problema.")
    } finally {
      setSalvandoProblema(false)
    }
  }

  useEffect(() => {
    fetch("/api/producao/ordem")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d?.ordem)) setOrdemManual(d.ordem)
      })
      .catch(() => {})
  }, [])

  const salvarOrdemManual = useCallback(async (novaOrdem: string[]) => {
    setOrdemManual(novaOrdem)
    try {
      await fetch("/api/producao/ordem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordem: novaOrdem }),
      })
    } catch (e) {
      console.error("Erro ao salvar ordem manual:", e)
    }
  }, [])

  const promoverParaPrimeiro = useCallback((id: string) => {
    setOrdemManual((prev) => {
      const filtrado = prev.filter((x) => x !== id)
      const nova = [id, ...filtrado]
      salvarOrdemManual(nova)
      toast.success("Card priorizado como 1º da fila!")
      return nova
    })
  }, [salvarOrdemManual])

  const compararItensFila = useCallback(
    (a: { id: string; dataCriacao: number; numero: number }, b: { id: string; dataCriacao: number; numero: number }) => {
      if (ordemManual.length > 0) {
        const posA = ordemManual.indexOf(a.id)
        const posB = ordemManual.indexOf(b.id)
        if (posA !== -1 && posB !== -1) return posA - posB
        if (posA !== -1 && posB === -1) return -1
        if (posA === -1 && posB !== -1) return 1
      }
      if (a.dataCriacao !== b.dataCriacao) return a.dataCriacao - b.dataCriacao
      return a.numero - b.numero
    },
    [ordemManual]
  )

  useEffect(() => {
    const orcsComOs = orcamentos.filter((o) => o.statusProducao)
    if (orcsComOs.length === 0) return
    Promise.all(
      orcsComOs.map((o) =>
        fetch(`/api/assinar/por-orcamento/${o.id}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d: { pdfUrl: string | null; assinado: boolean } | null) =>
            d ? { id: o.id, pdfUrl: d.pdfUrl, assinado: d.assinado } : null
          )
          .catch(() => null)
      )
    ).then((resultados) => {
      const mapa: Record<string, { pdfUrl: string | null; assinado: boolean }> = {}
      for (const r of resultados) {
        if (r) mapa[r.id] = { pdfUrl: r.pdfUrl, assinado: r.assinado }
      }
      setAssinaturas(mapa)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orcamentos.length])

  const pedidosConhecidosRef = useRef<Set<string> | null>(null)

  useEffect(() => {
    const todosIds = [
      ...pedidosRapidos.map((p) => p.id),
      ...orcamentos.filter((o) => o.statusProducao).map((o) => `orc-${o.id}`),
    ]

    if (pedidosConhecidosRef.current === null) {
      pedidosConhecidosRef.current = new Set(todosIds)
      return
    }

    const novos = todosIds.filter((id) => !pedidosConhecidosRef.current!.has(id))
    if (novos.length > 0) {
      novos.forEach((id) => pedidosConhecidosRef.current!.add(id))
      tocarAlertaNovaDemanda()
      dispararVibracaoCelular()
      toast.info("🔔 Nova Demanda na Produção!", {
        description: `${novos.length} novo(s) item(ns) na fila de produção.`,
      })
      dispararNotificacaoNativa(
        "🔔 Nova Demanda na Produção!",
        `${novos.length} novo(s) item(ns) entraram na fila de produção.`,
        "/producao"
      )
    }
  }, [pedidosRapidos, orcamentos])

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const [hoje, setHoje] = useState<Date | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHoje(new Date())
  }, [])

  function produtoDoPedido(pedido: PedidoRapido) {
    return produtosRapidos.find((p) => p.id === pedido.produtoId)
  }

  function estaAtrasado(pedido: PedidoRapido) {
    if (!hoje) return false
    const produto = produtoDoPedido(pedido)
    return pedidoRapidoEstaAtrasado(pedido, produto?.prazoDias, hoje)
  }

  function itemEParaHoje(dataPrazo: Date | null): boolean {
    if (!dataPrazo || !hoje) return false
    return (
      dataPrazo.getFullYear() === hoje.getFullYear() &&
      dataPrazo.getMonth() === hoje.getMonth() &&
      dataPrazo.getDate() === hoje.getDate()
    )
  }

  function orcamentoEParaHoje(o: Orcamento): boolean {
    if (!hoje) return false
    const dStr = o.fechadoEm || o.osEmitidaEm || o.criadoEm
    if (!dStr) return false
    const d = new Date(dStr)
    return (
      d.getFullYear() === hoje.getFullYear() &&
      d.getMonth() === hoje.getMonth() &&
      d.getDate() === hoje.getDate()
    )
  }

  // Lista unificada ordenada decrescente para cálculo de recentes
  const idsUltimos5Recentes = useMemo(() => {
    const lista: { id: string; tipo: "pedido" | "orcamento"; dataTs: number }[] = []
    for (const p of pedidosRapidos) {
      const ts = p.criadoEm ? new Date(p.criadoEm).getTime() : 0
      lista.push({ id: p.id, tipo: "pedido", dataTs: ts })
    }
    for (const o of orcamentos) {
      if (!o.statusProducao) continue
      const dataStr = o.fechadoEm || o.criadoEm || ""
      const ts = dataStr ? new Date(dataStr).getTime() : 0
      lista.push({ id: o.id, tipo: "orcamento", dataTs: ts })
    }
    lista.sort((a, b) => b.dataTs - a.dataTs)
    return new Set(lista.slice(0, 5).map((item) => (item.tipo === "pedido" ? item.id : `orc-${item.id}`)))
  }, [pedidosRapidos, orcamentos])

  const totalHoje = useMemo(() => {
    const pHoje = pedidosRapidos.filter((p) => {
      const prod = produtoDoPedido(p)
      const prazo = obterPrazoEntregaPedido(p, prod?.prazoDias)
      return itemEParaHoje(prazo) || estaAtrasado(p)
    }).length
    const oHoje = orcamentos.filter((o) => o.statusProducao && orcamentoEParaHoje(o)).length
    return pHoje + oHoje
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidosRapidos, orcamentos, hoje, produtosRapidos])

  const pedidosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return pedidosRapidos.filter((pedido) => {
      if (filtroPreset === "os") return false
      if (filtroPreset === "atrasados" && !estaAtrasado(pedido)) return false
      if (filtroPreset === "recentes_5" && !idsUltimos5Recentes.has(pedido.id)) return false
      if (filtroPreset === "hoje") {
        const prod = produtoDoPedido(pedido)
        const prazo = obterPrazoEntregaPedido(pedido, prod?.prazoDias)
        if (!itemEParaHoje(prazo) && !estaAtrasado(pedido)) return false
      }

      if (!termo) return true
      return (
        pedido.clienteNome.toLowerCase().includes(termo) ||
        String(pedido.numero).includes(termo)
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidosRapidos, busca, filtroPreset, idsUltimos5Recentes, hoje, produtosRapidos])

  const orcamentosEmProducao = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return orcamentos.filter((o) => {
      if (!o.statusProducao) return false
      if (filtroPreset === "rapida") return false
      if (filtroPreset === "atrasados") return false
      if (filtroPreset === "recentes_5" && !idsUltimos5Recentes.has(`orc-${o.id}`)) return false
      if (filtroPreset === "hoje" && !orcamentoEParaHoje(o)) return false

      if (!termo) return true
      const cliente = clientes.find((c) => c.id === o.clienteId)
      return (
        (cliente?.nome ?? "").toLowerCase().includes(termo) ||
        String(o.numero).includes(termo)
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orcamentos, clientes, busca, filtroPreset, idsUltimos5Recentes, hoje])

  const colunasRenderizadas = useMemo(() => {
    return colunas.filter((col) => {
      if (!colunasVisiveis.includes(col.status)) return false
      if (ocultarEntregues && col.status === "entregue") return false
      if (ocultarVazias) {
        const pCount = pedidosFiltrados.filter(
          (p) => p.status === col.status || (col.status === "aprovado" && p.status === "arte")
        ).length
        const oCount = orcamentosEmProducao.filter(
          (o) => o.statusProducao === col.status || (col.status === "aprovado" && o.statusProducao === "arte")
        ).length
        if (pCount + oCount === 0) return false
      }
      return true
    })
  }, [colunasVisiveis, ocultarEntregues, ocultarVazias, pedidosFiltrados, orcamentosEmProducao])

  const emProducao =
    pedidosRapidos.filter((p) =>
      ["aprovado", "arte", "ag_confirmacao", "impressao", "acabamento", "pronto"].includes(p.status)
    ).length +
    orcamentosEmProducao.filter((o) =>
      o.statusProducao &&
      ["aprovado", "arte", "ag_confirmacao", "impressao", "acabamento", "pronto"].includes(o.statusProducao)
    ).length
  const atrasados = pedidosRapidos.filter(estaAtrasado).length
  const prontos =
    pedidosRapidos.filter((p) => p.status === "pronto").length +
    orcamentosEmProducao.filter((o) => o.statusProducao === "pronto").length
  const totalEntregues =
    pedidosFiltrados.filter((p) => p.status === "entregue").length +
    orcamentosEmProducao.filter((o) => o.statusProducao === "entregue").length

  const finalizadosHoje = useMemo(() => {
    if (!hoje) return 0
    const pHoje = pedidosRapidos.filter((p) => {
      if (p.status !== "pronto" && p.status !== "entregue") return false
      if (p.criadoEm) {
        const d = new Date(p.criadoEm)
        if (
          d.getFullYear() === hoje.getFullYear() &&
          d.getMonth() === hoje.getMonth() &&
          d.getDate() === hoje.getDate()
        ) {
          return true
        }
      }
      return p.status === "pronto"
    }).length

    const oHoje = orcamentos.filter((o) => {
      if (o.statusProducao !== "pronto" && o.statusProducao !== "entregue") return false
      if (o.fechadoEm || o.osEmitidaEm) {
        const d = new Date((o.osEmitidaEm || o.fechadoEm)!)
        if (
          d.getFullYear() === hoje.getFullYear() &&
          d.getMonth() === hoje.getMonth() &&
          d.getDate() === hoje.getDate()
        ) {
          return true
        }
      }
      return o.statusProducao === "pronto"
    }).length

    return pHoje + oHoje
  }, [pedidosRapidos, orcamentos, hoje])

  const itensColaborador = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    const pedidos = pedidosRapidos
      .filter((p) => {
        if (p.status === "entregue") return false
        if (abaColaborador === "fila" && p.status === "pronto") return false
        if (abaColaborador === "prontos" && p.status !== "pronto") return false
        if (!termo) return true
        return (
          p.clienteNome.toLowerCase().includes(termo) ||
          String(p.numero).includes(termo)
        )
      })
      .map((p) => ({
        tipo: "pedido" as const,
        id: p.id,
        numero: p.numero,
        clienteNome: p.clienteNome,
        clienteTelefone: p.clienteTelefone,
        produtoNome: p.produtoNome || "Gráfica Rápida",
        varianteNome: p.varianteNome,
        acabamento: p.acabamento,
        largura: null as number | null,
        altura: null as number | null,
        quantidade: 1,
        observacao: p.observacao,
        arteUrl: p.arteUrl,
        fotoProntoUrl: p.fotoProntoUrl,
        fotosLocal: [] as string[],
        status: p.status,
        comissaoPercent: p.comissaoPercent,
        valorTotal: p.total,
        dataCriacao: p.criadoEm ? new Date(p.criadoEm).getTime() : 0,
      }))

    const orcs = orcamentos
      .filter((o) => {
        if (!o.statusProducao || o.statusProducao === "entregue") return false
        if (abaColaborador === "fila" && o.statusProducao === "pronto") return false
        if (abaColaborador === "prontos" && o.statusProducao !== "pronto") return false
        if (!termo) return true
        const cli = clientes.find((c) => c.id === o.clienteId)
        return (
          (cli?.nome || "").toLowerCase().includes(termo) ||
          String(o.numero).includes(termo)
        )
      })
      .map((o) => {
        const cli = clientes.find((c) => c.id === o.clienteId)
        return {
          tipo: "orcamento" as const,
          id: o.id,
          numero: o.numero,
          clienteNome: cli?.nome || "Cliente",
          clienteTelefone: cli?.telefone || null,
          produtoNome:
            o.servicoFechado?.nome ||
            (o.item.servicoId && o.item.servicoId !== "nenhum"
              ? "Serviço + Material"
              : "Comunicação Visual"),
          varianteNome: o.materialFechado?.nome,
          acabamento: null as string | null,
          largura: o.item.largura,
          altura: o.item.altura,
          quantidade: o.item.quantidadeUnidades || 1,
          observacao: o.observacao,
          arteUrl: o.arteUrl || o.anexoUrl || (o.item?.fotos && o.item.fotos.length > 0 ? o.item.fotos[0].url : undefined),
          fotoProntoUrl: o.fotoProntoUrl,
          fotosLocal: o.item.fotos?.map((f) => f.url) || (o.anexoUrl ? [o.anexoUrl] : []),
          status: o.statusProducao as StatusPedidoRapido,
          comissaoPercent: o.item.comissaoPercent,
          valorTotal: o.totalFechado || 0,
          dataCriacao: new Date(o.osEmitidaEm || o.fechadoEm || o.criadoEm || 0).getTime(),
        }
      })

    return [...pedidos, ...orcs].sort(compararItensFila)
  }, [pedidosRapidos, orcamentos, clientes, busca, abaColaborador, compararItensFila])

  const totalFilaColaborador = useMemo(() => {
    const p = pedidosRapidos.filter(
      (item) => item.status !== "pronto" && item.status !== "entregue"
    ).length
    const o = orcamentos.filter(
      (item) => item.statusProducao && item.statusProducao !== "pronto" && item.statusProducao !== "entregue"
    ).length
    return p + o
  }, [pedidosRapidos, orcamentos])

  const totalProntosColaborador = useMemo(() => {
    const p = pedidosRapidos.filter((item) => item.status === "pronto").length
    const o = orcamentos.filter((item) => item.statusProducao === "pronto").length
    return p + o
  }, [pedidosRapidos, orcamentos])

  const pedidoArrastando = arrastandoId && !arrastandoId.startsWith("orc-")
    ? pedidosRapidos.find((p) => p.id === arrastandoId)
    : null
  const orcamentoArrastando = arrastandoId?.startsWith("orc-")
    ? orcamentos.find((o) => o.id === arrastandoId.slice(4))
    : null

  function solicitarConfirmacao(
    clienteNome: string,
    clienteTelefone: string | null,
    novoStatus: StatusPedidoRapido,
    executar: () => void,
    idItem?: string
  ) {
    if (STATUS_COM_NOTIFICACAO.has(novoStatus) && clienteTelefone) {
      setConfirmando({
        clienteNome,
        clienteTelefone,
        novoStatus,
        mensagem: mensagemProducao(clienteNome, novoStatus, idItem),
        enviando: false,
        executar,
      })
    } else {
      executar()
    }
  }

  async function confirmarMudanca(enviarWhatsApp: boolean) {
    if (!confirmando) return
    setConfirmando((c) => c ? { ...c, enviando: true } : null)
    confirmando.executar()
    if (enviarWhatsApp && confirmando.clienteTelefone) {
      await fetch("/api/whatsapp/enviar-notificacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefone: normalizarTelefone(confirmando.clienteTelefone),
          mensagem: confirmando.mensagem,
          clienteNome: confirmando.clienteNome,
        }),
      })
    }
    setConfirmando(null)
  }

  function handleDragStart(event: DragStartEvent) {
    setArrastandoId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setArrastandoId(null)
    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    // Caso 1: Soltou em cima de outro card para reordenar na fila
    if (overId.startsWith("card:")) {
      const targetCardId = overId.replace("card:", "")
      if (activeId === targetCardId) return

      // Descobrir a coluna de destino baseada no card onde foi solto
      let statusDestino: StatusPedidoRapido | null = null
      const targetPedido = pedidosRapidos.find((p) => p.id === targetCardId)
      if (targetPedido) {
        statusDestino = (targetPedido.status === "arte" ? "aprovado" : targetPedido.status) as StatusPedidoRapido
      } else if (targetCardId.startsWith("orc-")) {
        const targetOrc = orcamentos.find((o) => o.id === targetCardId.slice(4))
        if (targetOrc) {
          const st = targetOrc.statusProducao === "arte" ? "aprovado" : targetOrc.statusProducao
          statusDestino = (st as StatusPedidoRapido) || "aprovado"
        }
      }

      // Reordenar no array de prioridades
      setOrdemManual((prev) => {
        const semActive = prev.filter((x) => x !== activeId)
        const idxTarget = semActive.indexOf(targetCardId)
        let nova: string[]
        if (idxTarget === -1) {
          nova = [activeId, targetCardId, ...semActive]
        } else {
          nova = [
            ...semActive.slice(0, idxTarget),
            activeId,
            ...semActive.slice(idxTarget),
          ]
        }
        salvarOrdemManual(nova)
        return nova
      })

      // Se foi arrastado para uma coluna diferente, move também o status
      if (statusDestino && statusValidos.has(statusDestino)) {
        if (activeId.startsWith("orc-")) {
          const orcId = activeId.slice(4)
          const orc = orcamentos.find((o) => o.id === orcId)
          if (orc && orc.statusProducao !== statusDestino) {
            const cli = clientes.find((c) => c.id === orc.clienteId)
            solicitarConfirmacao(
              cli?.nome ?? "Cliente",
              cli?.telefone ?? null,
              statusDestino,
              () => moverOrcamentoProducao(orcId, statusDestino!),
              orcId
            )
          }
        } else {
          const pedido = pedidosRapidos.find((p) => p.id === activeId)
          if (pedido && pedido.status !== statusDestino) {
            solicitarConfirmacao(
              pedido.clienteNome,
              pedido.clienteTelefone,
              statusDestino,
              () => moverPedidoRapido(activeId, statusDestino!),
              activeId
            )
          }
        }
      }
      return
    }

    // Caso 2: Soltou na coluna diretamente
    const novoStatus = overId
    if (!statusValidos.has(novoStatus)) return

    if (activeId.startsWith("orc-")) {
      const orcId = activeId.slice(4)
      const orc = orcamentos.find((o) => o.id === orcId)
      if (!orc || orc.statusProducao === novoStatus) return
      const cli = clientes.find((c) => c.id === orc.clienteId)
      solicitarConfirmacao(
        cli?.nome ?? "Cliente",
        cli?.telefone ?? null,
        novoStatus as StatusPedidoRapido,
        () => moverOrcamentoProducao(orcId, novoStatus as StatusPedidoRapido),
        orcId
      )
    } else {
      const pedido = pedidosRapidos.find((p) => p.id === activeId)
      if (!pedido || pedido.status === novoStatus) return
      solicitarConfirmacao(
        pedido.clienteNome,
        pedido.clienteTelefone,
        novoStatus as StatusPedidoRapido,
        () => moverPedidoRapido(activeId, novoStatus as StatusPedidoRapido),
        activeId
      )
    }
  }

  // Visão Ultralimpa e Direta para o Colaborador (Chão de Fábrica)
  return (
    <>
      {papel === "operador" ? (
        <div className="flex flex-col gap-4 max-w-2xl mx-auto pb-12">
        {/* Header Colaborador */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Fila da Produção</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Demandas da fábrica. Ao finalizar uma peça, marque como pronto.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Atualizar
          </Button>
        </div>

        {/* Mural da Fábrica (Recados do Kaio / Telão) */}
        {avisosTv.length > 0 && (
          <div className="flex flex-col gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 dark:bg-amber-950/20 p-3 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-base">📢</span>
              <h3 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Recados do Kaio / Telão da Fábrica:
              </h3>
            </div>
            <div className="flex flex-col gap-1.5">
              {avisosTv.map((aviso) => (
                <div key={aviso.id} className="rounded-xl border border-amber-500/20 bg-background/90 p-2.5 text-xs text-foreground shadow-2xs">
                  <p className="font-semibold">{aviso.mensagem}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Campo de Busca Simples */}
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente ou número..."
            className="pl-9 pr-7 h-10 text-sm bg-background"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          )}
        </div>

        {/* Abas: Fila vs Prontos */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-muted/60 rounded-xl">
          <button
            type="button"
            onClick={() => setAbaColaborador("fila")}
            className={cn(
              "py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
              abaColaborador === "fila"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>🔥 Fila de Produção</span>
            <span className="rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 px-1.5 py-0.2 text-[10px]">
              {totalFilaColaborador}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setAbaColaborador("prontos")}
            className={cn(
              "py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
              abaColaborador === "prontos"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>✅ Já Prontos</span>
            <span className="rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.2 text-[10px]">
              {totalProntosColaborador}
            </span>
          </button>
        </div>

        {/* Lista de Cards para o Colaborador */}
        <div className="flex flex-col gap-3">
          {itensColaborador.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 p-8 text-center text-sm text-muted-foreground">
              {abaColaborador === "fila" ? "🎉 Nenhuma demanda pendente na fila da fábrica!" : "Nenhuma peça finalizada nesta lista."}
            </div>
          ) : (
            itensColaborador.map((item) => (
              <div
                key={`${item.tipo}-${item.id}`}
                className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm"
              >
                {/* Cabeçalho do Card */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-foreground">
                      #{item.numero}
                    </span>
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {item.tipo === "pedido" ? "Gráfica Rápida" : "Ordem de Serviço"}
                    </span>
                  </div>
                  {item.status === "pronto" && (
                    <span className="rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold px-2 py-0.5 text-xs">
                      ✅ Pronto
                    </span>
                  )}
                </div>

                {/* Cliente */}
                <div>
                  <p className="text-xs text-muted-foreground">Cliente:</p>
                  <p className="text-sm font-bold text-foreground truncate">{item.clienteNome}</p>
                </div>

                {/* Medidas em Destaque */}
                {item.largura != null && item.altura != null && (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                      📏 Medidas: {item.largura}m × {item.altura}m {item.quantidade > 1 ? `(${item.quantidade} unidades)` : ""}
                    </span>
                  </div>
                )}

                {/* Bônus / Comissão do Colaborador (Regra do Kaio: integral para cada um) */}
                {item.comissaoPercent != null && item.comissaoPercent > 0 && (
                  <div className="flex items-center justify-between gap-1.5 p-2 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300 font-bold text-xs shadow-2xs">
                    <span className="flex items-center gap-1.5">
                      <span className="text-sm">🪙</span>
                      <span>BÔNUS DO COLABORADOR: {item.comissaoPercent}%</span>
                    </span>
                    <span className="text-[11px] font-black bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                      R$ {(((item.valorTotal || 0) * item.comissaoPercent) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} cada
                    </span>
                  </div>
                )}

                {/* Produto / Material / Acabamento */}
                <div className="flex flex-col gap-1 text-xs">
                  <p className="font-semibold text-foreground">
                    {item.produtoNome}
                  </p>
                  {(item.varianteNome || item.acabamento) && (
                    <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-muted-foreground">
                      {item.varianteNome && <span>• Material: {item.varianteNome}</span>}
                      {item.acabamento && <span>• Acabamento: {item.acabamento}</span>}
                    </div>
                  )}
                </div>

                {/* Instrução da Fábrica ou Problema Reportado */}
                {item.observacao && (
                  <div
                    className={cn(
                      "rounded-xl p-2.5 text-xs",
                      item.observacao.includes("ALERTA DA FÁBRICA")
                        ? "border-2 border-red-500 bg-red-500/15 text-red-900 dark:text-red-200"
                        : "border border-amber-500/40 bg-amber-500/10 text-foreground/90"
                    )}
                  >
                    <span
                      className={cn(
                        "font-bold flex items-center gap-1 mb-1",
                        item.observacao.includes("ALERTA DA FÁBRICA")
                          ? "text-red-700 dark:text-red-400"
                          : "text-amber-800 dark:text-amber-300"
                      )}
                    >
                      {item.observacao.includes("ALERTA DA FÁBRICA") ? (
                        <>
                          <AlertTriangle className="h-3.5 w-3.5" />
                          ⚠️ PROBLEMA REPORTADO NA PEÇA:
                        </>
                      ) : (
                        <>
                          <FileText className="h-3.5 w-3.5" />
                          Instrução p/ Fábrica:
                        </>
                      )}
                    </span>
                    <p className="whitespace-pre-wrap">{item.observacao}</p>
                  </div>
                )}

                {/* Botões de Ação */}
                <div className="flex flex-col gap-2 pt-1 border-t border-border/60">
                  <div className="flex items-center gap-2">
                    {/* Botão Imprimir Ficha Direto */}
                    <button
                      type="button"
                      onClick={() => handleImprimirFicha(item)}
                      className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                      title="Imprimir Ficha de Bancada imediatamente"
                    >
                      <Printer className="h-4 w-4" />
                      <span>Imprimir Ficha</span>
                    </button>

                    {/* Botão Ver Arte (se houver arte) OU Ver Detalhes (se não houver) */}
                    {item.arteUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          setModalArtePreview({
                            url: item.arteUrl!,
                            titulo: `Arte #${item.numero} - ${item.clienteNome}`,
                          })
                        }
                        className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        title="Ver arte e layout aprovados pelo cliente em tela cheia"
                      >
                        <Eye className="h-4 w-4" />
                        <span>Ver Arte</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setModalDetalhesItem({
                            tipo: item.tipo,
                            id: item.id,
                            numero: item.numero,
                            clienteNome: item.clienteNome,
                            clienteTelefone: item.clienteTelefone,
                            total: item.valorTotal,
                            largura: item.largura,
                            altura: item.altura,
                            quantidade: item.quantidade,
                            produtoNome: item.produtoNome,
                            varianteNome: item.varianteNome,
                            acabamento: item.acabamento,
                            observacao: item.observacao,
                            arteUrl: item.arteUrl,
                            fotoProntoUrl: item.fotoProntoUrl,
                            fotosLocal: item.fotosLocal,
                            status: item.status,
                            comissaoPercent: item.comissaoPercent,
                          })
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-muted/80 hover:bg-muted border border-border/80 text-foreground text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        title="Ver especificações da demanda"
                      >
                        <Info className="h-4 w-4 text-primary" />
                        <span>Ver Detalhes</span>
                      </button>
                    )}

                    {/* Botão Relatar Problema (Sempre disponível se não estiver pronto) */}
                    {item.status !== "pronto" && (
                      <button
                        type="button"
                        onClick={() => {
                          setModalProblemaItem({
                            id: item.id,
                            tipo: item.tipo,
                            numero: item.numero,
                            clienteNome: item.clienteNome,
                            obsAtual: item.observacao,
                          })
                          setMotivoProblema("")
                          setDetalheProblema("")
                        }}
                        className={cn(
                          "py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer",
                          item.arteUrl ? "shrink-0" : "shrink-0",
                          item.observacao?.includes("ALERTA DA FÁBRICA")
                            ? "bg-red-500/15 border-red-500/40 text-red-700 dark:text-red-300 hover:bg-red-500/25"
                            : "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-800 dark:text-amber-300"
                        )}
                        title="Relatar falta de material, problema na arte ou máquina parada"
                      >
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <span>{item.observacao?.includes("ALERTA DA FÁBRICA") ? "Alerta" : "Problema"}</span>
                      </button>
                    )}
                  </div>

                  {/* Se houver arte anexada, mostra a miniatura para o colaborador ver na bancada */}
                  {item.arteUrl && (
                    <div
                      onClick={() =>
                        setModalArtePreview({
                          url: item.arteUrl!,
                          titulo: `Arte #${item.numero} - ${item.clienteNome}`,
                        })
                      }
                      className="flex items-center gap-2.5 p-2 rounded-xl border border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10 cursor-pointer transition-all"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.arteUrl}
                        alt="Arte Aprovada"
                        className="h-12 w-16 object-contain rounded-lg border border-indigo-500/20 bg-black/5 dark:bg-black/30 shrink-0"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                          <Eye className="h-3.5 w-3.5" />
                          <span>Arte Aprovada (Layout)</span>
                        </span>
                        <span className="text-[11px] text-muted-foreground">Toque para abrir a arte em tela cheia</span>
                      </div>
                    </div>
                  )}

                  {/* Se a peça já estiver concluída e tiver foto, mostra a foto anexada */}
                  {item.status === "pronto" && item.fotoProntoUrl && (
                    <div
                      onClick={() =>
                        setModalArtePreview({
                          url: item.fotoProntoUrl!,
                          titulo: `Foto da Peça Concluída #${item.numero} - ${item.clienteNome}`,
                        })
                      }
                      className="flex items-center gap-2.5 p-2 rounded-xl border-2 border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20 cursor-pointer transition-all"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.fotoProntoUrl}
                        alt="Foto da Peça Pronta"
                        className="h-12 w-16 object-cover rounded-lg border border-emerald-500/40 shrink-0"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                          <Camera className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Foto da Peça Pronta (Enviada ao Kaio)</span>
                        </span>
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 underline font-medium">
                          Toque para ampliar foto
                        </span>
                      </div>
                    </div>
                  )}

                  {/* O Botão Principal: Marcar como Pronto (Abre Foto Obrigatória para o Kaio) */}
                  {item.status !== "pronto" ? (
                    <button
                      type="button"
                      onClick={() => {
                        abrirQc({
                          tipo: item.tipo,
                          id: item.id,
                          numero: item.numero,
                          clienteNome: item.clienteNome,
                          clienteTelefone: item.clienteTelefone || null,
                          fotoAtual: item.fotoProntoUrl,
                          comissaoPercent: item.comissaoPercent,
                          valorTotal: item.valorTotal,
                          produtoNome: item.produtoNome,
                          quantidadeTotal: item.quantidade || 1,
                        })
                      }}
                      className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-sm font-bold shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      <Camera className="h-5 w-5" />
                      <span>Marcar como Peça Pronta (Tirar Foto)</span>
                    </button>
                  ) : (
                    <div className="w-full py-2.5 px-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>✅ Peça Pronta (Foto enviada ao Kaio)</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    ) : (
      <div className="flex flex-col gap-4 sm:gap-6">
        {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Produção</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe o fluxo de pedidos e ordens de serviço.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {/* Mural de Avisos da Fábrica (Recados do Kaio / Central Telão) */}
      {avisosTv.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 dark:bg-amber-950/20 p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 text-sm font-bold">
                📢
              </span>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200">
                  Mural da Fábrica & Recados do Telão
                </h3>
                <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                  Avisos importantes enviados diretamente pelo Kaio / Telão para a equipe
                </p>
              </div>
            </div>
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
              {avisosTv.length} ativo{avisosTv.length > 1 ? "s" : ""}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
            {avisosTv.map((aviso) => (
              <div
                key={aviso.id}
                className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-background/80 p-2.5 shadow-2xs"
              >
                <span className="text-base shrink-0">{aviso.icone || "📢"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground leading-snug break-words">
                    {aviso.mensagem}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {aviso.criado_em ? formatarData(aviso.criado_em) : "Recente"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Métricas compactas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3 rounded-xl border border-border bg-card px-2.5 sm:px-4 py-2 sm:py-3">
          <div className="flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/15">
            <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Em produção</p>
            <p className="text-base sm:text-xl font-bold leading-tight">{emProducao}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 rounded-xl border border-border bg-card px-2.5 sm:px-4 py-2 sm:py-3">
          <div className="flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-red-500/15">
            <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Atrasados</p>
            <p className={cn("text-base sm:text-xl font-bold leading-tight", atrasados > 0 && "text-destructive")}>
              {hoje ? atrasados : "—"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 rounded-xl border border-border bg-card px-2.5 sm:px-4 py-2 sm:py-3">
          <div className="flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-green-500/15">
            <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Prontos</p>
            <p className={cn("text-base sm:text-xl font-bold leading-tight", prontos > 0 && "text-green-600")}>
              {prontos}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 rounded-xl border border-border bg-card px-2.5 sm:px-4 py-2 sm:py-3">
          <div className="flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
            <Flame className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Finalizados hoje</p>
            <p className="text-base sm:text-xl font-bold leading-tight text-amber-600 dark:text-amber-400">
              {finalizadosHoje}
            </p>
          </div>
        </div>
      </div>

      {/* Busca e Barra de Ferramentas com Filtros */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Campo de Busca */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente ou número..."
              className="pl-9 pr-7 h-9 text-sm bg-background"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                title="Limpar busca"
              >
                ✕
              </button>
            )}
          </div>

          {/* Seletor de Colunas Visíveis */}
          <Popover>
            <PopoverTrigger
              className={cn(
                "inline-flex items-center justify-center rounded-lg border border-border bg-background px-3 h-9 text-xs font-medium gap-1.5 shrink-0 transition-colors hover:bg-muted cursor-pointer",
                colunasVisiveis.length < colunas.length && "border-primary text-primary font-semibold bg-primary/5"
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Colunas ({colunasVisiveis.length}/{colunas.length})</span>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-3 flex flex-col gap-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <span className="text-xs font-bold text-foreground">Colunas Visíveis</span>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setColunasVisiveis(colunas.map((c) => c.status))}
                    className="text-primary hover:underline font-medium"
                  >
                    Todas
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => {
                      const colunasComCards = colunas
                        .filter((c) => {
                          const count =
                            pedidosRapidos.filter((p) => p.status === c.status || (c.status === "aprovado" && p.status === "arte")).length +
                            orcamentos.filter((o) => o.statusProducao === c.status || (c.status === "aprovado" && o.statusProducao === "arte")).length
                          return count > 0
                        })
                        .map((c) => c.status)
                      setColunasVisiveis(colunasComCards.length > 0 ? colunasComCards : colunas.map((c) => c.status))
                    }}
                    className="text-muted-foreground hover:text-foreground font-medium"
                  >
                    Só com cards
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
                {colunas.map((c) => {
                  const marcada = colunasVisiveis.includes(c.status)
                  const totalCards =
                    pedidosRapidos.filter((p) => p.status === c.status || (c.status === "aprovado" && p.status === "arte")).length +
                    orcamentos.filter((o) => o.statusProducao === c.status || (c.status === "aprovado" && o.statusProducao === "arte")).length

                  return (
                    <label
                      key={c.status}
                      className="flex items-center justify-between p-1.5 rounded-md hover:bg-muted/50 cursor-pointer text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={marcada}
                          onChange={() => {
                            setColunasVisiveis((atuais) => {
                              if (atuais.includes(c.status)) {
                                if (atuais.length === 1) return atuais
                                return atuais.filter((s) => s !== c.status)
                              } else {
                                return [...atuais, c.status]
                              }
                            })
                          }}
                          className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                        />
                        <div className="flex items-center gap-1.5">
                          <span className={cn("h-2 w-2 rounded-full", c.cor)} />
                          <span className={marcada ? "font-medium text-foreground" : "text-muted-foreground"}>
                            {c.titulo}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-semibold px-1 rounded bg-muted">
                        {totalCards}
                      </span>
                    </label>
                  )
                })}
              </div>
            </PopoverContent>
          </Popover>

          {/* Botão Ocultar Entregues */}
          <button
            type="button"
            onClick={() => setOcultarEntregues((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 h-9 text-xs font-medium transition-all shrink-0",
              ocultarEntregues
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            )}
            title="Ocultar coluna de pedidos já entregues"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{ocultarEntregues ? "Entregues Ocultos" : "Ocultar Entregues"}</span>
            <span className="rounded-full bg-muted/80 px-1.5 py-0.2 text-[10px]">
              {totalEntregues}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setModalHistoricoEntregues(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-teal-500/40 bg-teal-500/10 hover:bg-teal-500/20 px-3 h-9 text-xs font-semibold text-teal-700 dark:text-teal-300 transition-all shrink-0 cursor-pointer shadow-2xs"
            title="Abrir histórico com todos os serviços e pedidos já entregues"
          >
            <History className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
            <span>Histórico de Entregas</span>
            <span className="rounded-full bg-teal-600/20 text-teal-800 dark:text-teal-200 px-1.5 py-0.2 text-[10px] font-bold">
              {totalEntregues}
            </span>
          </button>
        </div>

        {/* Linha de Pílulas Rápidas de Filtro */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
            <Filter className="h-3 w-3" /> Filtros:
          </span>

          <button
            type="button"
            onClick={() => setFiltroPreset("todos")}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all shadow-2xs",
              filtroPreset === "todos"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/70 text-muted-foreground hover:text-foreground"
            )}
          >
            Todos ({pedidosRapidos.length + orcamentos.filter((o) => o.statusProducao).length})
          </button>

          <button
            type="button"
            onClick={() => setFiltroPreset(filtroPreset === "hoje" ? "todos" : "hoje")}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all shadow-2xs",
              filtroPreset === "hoje"
                ? "bg-emerald-600 text-white"
                : "bg-muted/70 text-muted-foreground hover:text-foreground"
            )}
            title="Ver pedidos e ordens com prazo de entrega hoje"
          >
            <Calendar className="h-3 w-3" />
            <span>Prazo Hoje ({totalHoje})</span>
          </button>

          <button
            type="button"
            onClick={() => setFiltroPreset(filtroPreset === "recentes_5" ? "todos" : "recentes_5")}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all shadow-2xs",
              filtroPreset === "recentes_5"
                ? "bg-amber-600 text-white"
                : "bg-muted/70 text-muted-foreground hover:text-foreground"
            )}
            title="Ver os 5 cards mais recentes que chegaram"
          >
            <Sparkles className="h-3 w-3" />
            <span>Últimos 5 recentes</span>
          </button>

          <button
            type="button"
            onClick={() => setFiltroPreset(filtroPreset === "os" ? "todos" : "os")}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all shadow-2xs",
              filtroPreset === "os"
                ? "bg-violet-600 text-white"
                : "bg-muted/70 text-muted-foreground hover:text-foreground"
            )}
          >
            <FileCheck className="h-3 w-3" />
            <span>Só OS / Orçamento</span>
          </button>

          <button
            type="button"
            onClick={() => setFiltroPreset(filtroPreset === "rapida" ? "todos" : "rapida")}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all shadow-2xs",
              filtroPreset === "rapida"
                ? "bg-blue-600 text-white"
                : "bg-muted/70 text-muted-foreground hover:text-foreground"
            )}
          >
            <Package className="h-3 w-3" />
            <span>Só Gráfica Rápida</span>
          </button>

          {atrasados > 0 && (
            <button
              type="button"
              onClick={() => setFiltroPreset(filtroPreset === "atrasados" ? "todos" : "atrasados")}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all shadow-2xs",
                filtroPreset === "atrasados"
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-destructive/10 text-destructive hover:bg-destructive/20"
              )}
            >
              <AlertTriangle className="h-3 w-3" />
              <span>Atrasados ({atrasados})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setOcultarVazias((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all shadow-2xs border",
              ocultarVazias
                ? "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            )}
            title="Ocultar colunas sem nenhum card"
          >
            <EyeOff className="h-3 w-3" />
            <span>{ocultarVazias ? "Colunas vazias ocultas" : "Ocultar vazias"}</span>
          </button>

          {/* Botão Limpar / Ver tudo */}
          {(filtroPreset !== "todos" || busca || colunasVisiveis.length < colunas.length || ocultarVazias || ocultarEntregues) && (
            <button
              type="button"
              onClick={() => {
                setFiltroPreset("todos")
                setBusca("")
                setColunasVisiveis(colunas.map((c) => c.status))
                setOcultarVazias(false)
                setOcultarEntregues(false)
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-bold text-foreground hover:bg-muted transition-all shadow-2xs"
            >
              ✕ Ver tudo (Limpar)
            </button>
          )}
        </div>
      </div>

      {/* Mobile: Navegação fixa por abas de estágio */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-background/95 backdrop-blur-md border-b border-border/60 flex items-center gap-1.5 overflow-x-auto md:hidden">
        <button
          onClick={() => setColunaAtiva("todas")}
          className={cn(
            "shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
            colunaAtiva === "todas"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-muted/70 text-muted-foreground hover:text-foreground"
          )}
        >
          Todas ({pedidosFiltrados.length + orcamentosEmProducao.length})
        </button>
        {colunasRenderizadas.map((col) => {
          const qtd =
            pedidosFiltrados.filter((p) => p.status === col.status || (col.status === "aprovado" && p.status === "arte")).length +
            orcamentosEmProducao.filter((o) => o.statusProducao === col.status || (col.status === "aprovado" && o.statusProducao === "arte")).length
          return (
            <button
              key={col.status}
              onClick={() => setColunaAtiva(col.status)}
              className={cn(
                "shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
                colunaAtiva === col.status
                  ? `${col.cor} text-white shadow-xs`
                  : "bg-muted/70 text-muted-foreground hover:text-foreground"
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", colunaAtiva === col.status ? "bg-white" : col.cor)} />
              <span>{col.titulo}</span>
              <span className="opacity-80 text-[11px]">({qtd})</span>
            </button>
          )
        })}
      </div>

      {/* Mobile: lista de cards em coluna única */}
      <div className="flex flex-col gap-4 md:hidden">
        {colunasRenderizadas
          .filter((col) => {
            if (colunaAtiva !== "todas") return col.status === colunaAtiva
            return true
          })
          .map((col) => {
            const pedidosDaColuna = pedidosFiltrados.filter(
              (p) => p.status === col.status || (col.status === "aprovado" && p.status === "arte")
            )
            const orcsDaColuna = orcamentosEmProducao.filter(
              (o) => o.statusProducao === col.status || (col.status === "aprovado" && o.statusProducao === "arte")
            )
            const totalColuna = pedidosDaColuna.length + orcsDaColuna.length
            if (colunaAtiva === "todas" && totalColuna === 0) return null

            const itensDaColuna = [
              ...pedidosDaColuna.map((p) => ({
                tipo: "pedido" as const,
                id: p.id,
                dataCriacao: p.criadoEm ? new Date(p.criadoEm).getTime() : 0,
                numero: p.numero,
                pedido: p,
              })),
              ...orcsDaColuna.map((o) => ({
                tipo: "orcamento" as const,
                id: `orc-${o.id}`,
                dataCriacao: new Date(o.osEmitidaEm || o.fechadoEm || o.criadoEm || 0).getTime(),
                numero: o.numero,
                orcamento: o,
              })),
            ].sort(col.status === "entregue" ? (a, b) => b.dataCriacao - a.dataCriacao || b.numero - a.numero : compararItensFila)

            const itensExibidos = col.status === "entregue" ? itensDaColuna.slice(0, 10) : itensDaColuna

            return (
              <div key={col.status} className="flex flex-col gap-2.5">
                <div className={cn("flex items-center justify-between rounded-lg px-3 py-1.5 border", col.corFundo, col.corBorda)}>
                  <div className="flex items-center gap-2">
                    <div className={cn("h-2.5 w-2.5 rounded-full shrink-0 shadow-2xs", col.cor)} />
                    <span className={cn("text-xs font-bold uppercase tracking-wide", col.corTexto)}>
                      {col.titulo}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {col.status === "entregue" && totalColuna > 10 && (
                      <span className="text-[10px] text-muted-foreground font-semibold">
                        (10 de {totalColuna})
                      </span>
                    )}
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold shadow-2xs", col.badgeFundo, col.corTexto)}>
                      {totalColuna}
                    </span>
                  </div>
                </div>

                {col.status === "entregue" && (
                  <button
                    type="button"
                    onClick={() => setModalHistoricoEntregues(true)}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg border border-teal-300 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200 text-xs font-bold cursor-pointer hover:bg-teal-100 transition-all shadow-2xs"
                  >
                    <span className="flex items-center gap-1.5">
                      <History className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
                      <span>Ver Histórico Geral de Entregas ({totalColuna})</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-teal-500" />
                  </button>
                )}

                {itensExibidos.map((item, idx) => {
                  if (item.tipo === "pedido") {
                    const pedido = item.pedido
                    return (
                      <PedidoCardConteudo
                        key={pedido.id}
                        pedido={pedido}
                        produto={produtoDoPedido(pedido)}
                        atrasado={estaAtrasado(pedido)}
                        coluna={colunaMap[pedido.status]}
                        posicaoFila={idx + 1}
                        onPromoverPrimeiro={() => promoverParaPrimeiro(pedido.id)}
                        onSalvarArte={(url) => salvarArtePedidoRapido(pedido.id, url)}
                        onSalvarObservacao={(obs) => salvarObservacaoPedidoRapido(pedido.id, obs)}
                        onAbrirQc={() =>
                          abrirQc({
                            tipo: "pedido",
                            id: pedido.id,
                            numero: pedido.numero,
                            clienteNome: pedido.clienteNome,
                            clienteTelefone: pedido.clienteTelefone,
                            fotoAtual: pedido.fotoProntoUrl,
                            comissaoPercent: pedido.comissaoPercent,
                            valorTotal: pedido.total,
                            produtoNome: pedido.produtoNome ?? produtoDoPedido(pedido)?.nome,
                            quantidadeTotal: 1,
                          })
                        }
                        onAbrirArte={(url, titulo) => setModalArtePreview({ url, titulo })}
                        onAbrirMaisDetalhes={() =>
                          setModalDetalhesItem({
                            tipo: "pedido",
                            id: pedido.id,
                            numero: pedido.numero,
                            clienteNome: pedido.clienteNome,
                            clienteTelefone: pedido.clienteTelefone,
                            total: pedido.total,
                            produtoNome: pedido.produtoNome ?? produtoDoPedido(pedido)?.nome,
                            varianteNome: pedido.varianteNome,
                            acabamento: pedido.acabamento,
                            observacao: pedido.observacao,
                            arteUrl: pedido.arteUrl,
                            fotoProntoUrl: pedido.fotoProntoUrl,
                            status: pedido.status,
                            dataEmissao: pedido.criadoEm,
                            tipoServico: "Gráfica Rápida",
                            comissaoPercent: pedido.comissaoPercent,
                          })
                        }
                        onAbrirProblema={() =>
                          setModalProblemaItem({
                            tipo: "pedido",
                            id: pedido.id,
                            numero: pedido.numero,
                            clienteNome: pedido.clienteNome,
                            obsAtual: pedido.observacao,
                          })
                        }
                        onMudarStatus={(status) =>
                          solicitarConfirmacao(
                            pedido.clienteNome,
                            pedido.clienteTelefone,
                            status,
                            () => moverPedidoRapido(pedido.id, status),
                            pedido.id
                          )
                        }
                      />
                    )
                  }
                  const orc = item.orcamento
                  const cli = clientes.find((c) => c.id === orc.clienteId)
                  return (
                    <OrcamentoCardConteudo
                      key={`orc-${orc.id}`}
                      orcamento={orc}
                      cliente={cli}
                      coluna={col}
                      posicaoFila={idx + 1}
                      assinatura={assinaturas[orc.id]}
                      onPromoverPrimeiro={() => promoverParaPrimeiro(`orc-${orc.id}`)}
                      onSalvarArte={(url) => salvarArteOrcamento(orc.id, url)}
                      onSalvarObservacao={(obs) => salvarObservacaoOrcamento(orc.id, obs)}
                      onAbrirQc={() =>
                        abrirQc({
                          tipo: "orcamento",
                          id: orc.id,
                          numero: orc.numero,
                          clienteNome: cli?.nome || "Cliente",
                          clienteTelefone: cli?.telefone || null,
                          fotoAtual: orc.fotoProntoUrl,
                          comissaoPercent: orc.item.comissaoPercent,
                          valorTotal: orc.totalFechado || 0,
                          produtoNome: orc.materialFechado?.nome || orc.servicoFechado?.nome || "Comunicação Visual",
                          quantidadeTotal: orc.item.quantidadeUnidades || 1,
                        })
                      }
                      onAbrirArte={(url, titulo) => setModalArtePreview({ url, titulo })}
                      onAbrirMaisDetalhes={() =>
                        setModalDetalhesItem({
                          tipo: "orcamento",
                          id: orc.id,
                          numero: orc.numero,
                          clienteNome: cli?.nome || "Cliente",
                          clienteTelefone: cli?.telefone || null,
                          total: orc.totalFechado,
                          largura: orc.item.largura,
                          altura: orc.item.altura,
                          quantidade: orc.item.quantidadeUnidades,
                          produtoNome:
                            orc.servicoFechado?.nome ||
                            (orc.item.servicoId && orc.item.servicoId !== "nenhum"
                              ? "Serviço + Material"
                              : "Comunicação Visual"),
                          varianteNome: orc.materialFechado?.nome,
                          observacao: orc.observacao,
                          arteUrl: orc.arteUrl,
                          fotoProntoUrl: orc.fotoProntoUrl,
                          fotosLocal: orc.item.fotos?.map((f) => f.url) || (orc.anexoUrl ? [orc.anexoUrl] : []),
                          status: orc.statusProducao || "aprovado",
                          comissaoPercent: orc.item.comissaoPercent,
                          contratoAssinado: assinaturas[orc.id]?.assinado,
                          contratoUrl: `/orcamentos/${orc.id}/contrato`,
                          osUrl: `/orcamentos/${orc.id}/os`,
                          dataEmissao: orc.fechadoEm || orc.criadoEm,
                          tipoServico:
                            orc.item.servicoId && orc.item.servicoId !== "nenhum"
                              ? "Serviço + material"
                              : "Orçamento de serviço",
                        })
                      }
                      onAbrirProblema={() =>
                        setModalProblemaItem({
                          tipo: "orcamento",
                          id: orc.id,
                          numero: orc.numero,
                          clienteNome: cli?.nome || "Cliente",
                          obsAtual: orc.observacao,
                        })
                      }
                      onMudarStatus={(status) =>
                        solicitarConfirmacao(
                          cli?.nome ?? "Cliente",
                          cli?.telefone ?? null,
                          status,
                          () => moverOrcamentoProducao(orc.id, status),
                          orc.id
                        )
                      }
                    />
                  )
                })}
                {col.status === "entregue" && totalColuna > 10 && (
                  <div className="p-3 text-center text-xs text-muted-foreground border border-dashed border-teal-300 dark:border-teal-800 rounded-lg bg-teal-50/50 dark:bg-teal-950/20">
                    <span>Mostrando os 10 mais recentes na coluna.</span>
                    <button
                      type="button"
                      onClick={() => setModalHistoricoEntregues(true)}
                      className="block w-full mt-1.5 text-teal-700 dark:text-teal-300 font-bold hover:underline cursor-pointer"
                    >
                      Abrir histórico com todos os {totalColuna} entregues →
                    </button>
                  </div>
                )}
                {totalColuna === 0 && colunaAtiva !== "todas" && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Nenhum pedido ou orçamento em {col.titulo}.
                  </p>
                )}
              </div>
            )
          })}
        {colunasRenderizadas.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma coluna selecionada nos filtros.
          </p>
        )}
        {colunasRenderizadas.length > 0 && pedidosFiltrados.length === 0 && orcamentosEmProducao.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum pedido ou orçamento encontrado com os filtros atuais.
          </p>
        )}
      </div>

      {/* Desktop: Caixa fixa do Kanban com rolagem interna bi-direcional */}
      <div className="hidden md:flex flex-col rounded-2xl border border-border/80 bg-muted/20 dark:bg-card/30 shadow-xs overflow-hidden">
        {/* Barra superior de status/info da caixa do Kanban */}
        <div className="flex items-center justify-between border-b border-border/60 bg-card/60 px-4 py-2.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">Quadro de Produção</span>
            <span>•</span>
            <span>
              {pedidosFiltrados.length + orcamentosEmProducao.length}{" "}
              {pedidosFiltrados.length + orcamentosEmProducao.length === 1 ? "item" : "itens"} visíveis
            </span>
            {filtroPreset === "recentes_5" && (
              <span className="rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 font-semibold px-2 py-0.5 text-[11px] flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> 5 mais recentes
              </span>
            )}
            {colunasVisiveis.length < colunas.length && (
              <span className="rounded bg-blue-500/15 text-blue-800 dark:text-blue-300 font-semibold px-2 py-0.5 text-[11px]">
                {colunasRenderizadas.length}/{colunas.length} colunas
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span>Arraste os cards para mover de coluna</span>
          </div>
        </div>

        {/* Área interna de rolagem horizontal e vertical */}
        <div className="h-[calc(100vh-290px)] min-h-[500px] max-h-[740px] w-full overflow-auto p-4 custom-scrollbar">
          <DndContext
            sensors={sensores}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {colunasRenderizadas.length === 0 ? (
              <div className="flex flex-col items-center justify-center w-full h-full p-12 text-center text-muted-foreground gap-3">
                <Filter className="h-10 w-10 opacity-30" />
                <p className="text-sm font-medium">Nenhuma coluna visível com os filtros atuais.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setColunasVisiveis(colunas.map((c) => c.status))
                    setOcultarVazias(false)
                    setOcultarEntregues(false)
                    setFiltroPreset("todos")
                    setBusca("")
                  }}
                >
                  Restaurar todas as colunas
                </Button>
              </div>
            ) : (
              <div className="flex gap-3.5 h-full min-w-max items-start">
                {colunasRenderizadas.map((col) => {
                  const pedidosDaColuna = pedidosFiltrados.filter(
                    (p) => p.status === col.status || (col.status === "aprovado" && p.status === "arte")
                  )
                  const orcsDaColuna = orcamentosEmProducao.filter(
                    (o) => o.statusProducao === col.status || (col.status === "aprovado" && o.statusProducao === "arte")
                  )
                  const total = pedidosDaColuna.length + orcsDaColuna.length

                  const itensDaColuna = [
                    ...pedidosDaColuna.map((p) => ({
                      tipo: "pedido" as const,
                      id: p.id,
                      dataCriacao: p.criadoEm ? new Date(p.criadoEm).getTime() : 0,
                      numero: p.numero,
                      pedido: p,
                    })),
                    ...orcsDaColuna.map((o) => ({
                      tipo: "orcamento" as const,
                      id: `orc-${o.id}`,
                      dataCriacao: new Date(o.osEmitidaEm || o.fechadoEm || o.criadoEm || 0).getTime(),
                      numero: o.numero,
                      orcamento: o,
                    })),
                  ].sort(col.status === "entregue" ? (a, b) => b.dataCriacao - a.dataCriacao || b.numero - a.numero : compararItensFila)

                  const itensExibidos = col.status === "entregue" ? itensDaColuna.slice(0, 10) : itensDaColuna

                  return (
                    <ColunaDroppable key={col.status} status={col.status} coluna={col}>
                      {/* Header fixo da coluna */}
                      <div
                        className={cn(
                          "shrink-0 flex items-center justify-between px-3 py-2.5 border-b",
                          col.corFundo,
                          col.corBorda
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div className={cn("h-2.5 w-2.5 rounded-full shrink-0 shadow-2xs", col.cor)} />
                          <span className={cn("text-xs font-bold uppercase tracking-wide", col.corTexto)}>
                            {col.titulo}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {col.status === "entregue" && total > 10 && (
                            <span className="text-[10px] text-muted-foreground font-semibold">
                              (10 de {total})
                            </span>
                          )}
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-bold shadow-2xs",
                              col.badgeFundo,
                              col.corTexto
                            )}
                          >
                            {total}
                          </span>
                        </div>
                      </div>

                      {/* Lista de cartões com rolagem independente */}
                      <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2.5 min-h-0 custom-scrollbar">
                        {col.status === "entregue" && (
                          <button
                            type="button"
                            onClick={() => setModalHistoricoEntregues(true)}
                            className="w-full flex items-center justify-between gap-2 p-2.5 rounded-xl border border-teal-300 dark:border-teal-700/60 bg-teal-50 hover:bg-teal-100/90 dark:bg-teal-950/40 dark:hover:bg-teal-900/60 text-teal-800 dark:text-teal-200 transition-all text-xs font-bold shadow-xs cursor-pointer text-left shrink-0"
                          >
                            <div className="flex items-center gap-2">
                              <History className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" />
                              <div>
                                <div className="font-bold">Histórico Geral ({total})</div>
                                <div className="text-[10px] font-normal text-teal-600 dark:text-teal-400">
                                  {total > 10 ? `Ver todos os ${total} serviços entregues` : "Ver detalhes de todos os entregues"}
                                </div>
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 shrink-0 text-teal-500" />
                          </button>
                        )}
                        {total === 0 && (
                          <div className="rounded-lg border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
                            Vazio
                          </div>
                        )}
                        {itensExibidos.map((item, idx) => {
                          if (item.tipo === "pedido") {
                            const pedido = item.pedido
                            return (
                              <PedidoCardArrastavel key={pedido.id} id={pedido.id}>
                                <PedidoCardConteudo
                                  pedido={pedido}
                                  produto={produtoDoPedido(pedido)}
                                  atrasado={estaAtrasado(pedido)}
                                  coluna={colunaMap[pedido.status]}
                                  posicaoFila={idx + 1}
                                  onPromoverPrimeiro={() => promoverParaPrimeiro(pedido.id)}
                                  onSalvarArte={(url) => salvarArtePedidoRapido(pedido.id, url)}
                                  onSalvarObservacao={(obs) => salvarObservacaoPedidoRapido(pedido.id, obs)}
                                  onAbrirQc={() =>
                                    abrirQc({
                                      tipo: "pedido",
                                      id: pedido.id,
                                      numero: pedido.numero,
                                      clienteNome: pedido.clienteNome,
                                      clienteTelefone: pedido.clienteTelefone,
                                      fotoAtual: pedido.fotoProntoUrl,
                                      comissaoPercent: pedido.comissaoPercent,
                                      valorTotal: pedido.total,
                                      produtoNome: pedido.produtoNome ?? produtoDoPedido(pedido)?.nome,
                                      quantidadeTotal: 1,
                                    })
                                  }
                                  onAbrirArte={(url, titulo) => setModalArtePreview({ url, titulo })}
                                  onAbrirMaisDetalhes={() =>
                                    setModalDetalhesItem({
                                      tipo: "pedido",
                                      id: pedido.id,
                                      numero: pedido.numero,
                                      clienteNome: pedido.clienteNome,
                                      clienteTelefone: pedido.clienteTelefone,
                                      total: pedido.total,
                                      produtoNome: pedido.produtoNome ?? produtoDoPedido(pedido)?.nome,
                                      varianteNome: pedido.varianteNome,
                                      acabamento: pedido.acabamento,
                                      observacao: pedido.observacao,
                                      arteUrl: pedido.arteUrl,
                                      fotoProntoUrl: pedido.fotoProntoUrl,
                                      status: pedido.status,
                                      dataEmissao: pedido.criadoEm,
                                      tipoServico: "Gráfica Rápida",
                                      comissaoPercent: pedido.comissaoPercent,
                                    })
                                  }
                                  onAbrirProblema={() =>
                                    setModalProblemaItem({
                                      tipo: "pedido",
                                      id: pedido.id,
                                      numero: pedido.numero,
                                      clienteNome: pedido.clienteNome,
                                      obsAtual: pedido.observacao,
                                    })
                                  }
                                  onMudarStatus={(status) =>
                                    solicitarConfirmacao(
                                      pedido.clienteNome,
                                      pedido.clienteTelefone,
                                      status,
                                      () => moverPedidoRapido(pedido.id, status),
                                      pedido.id
                                    )
                                  }
                                />
                              </PedidoCardArrastavel>
                            )
                          }
                          const orc = item.orcamento
                          const cli = clientes.find((c) => c.id === orc.clienteId)
                          return (
                            <PedidoCardArrastavel key={`orc-${orc.id}`} id={`orc-${orc.id}`}>
                              <OrcamentoCardConteudo
                                orcamento={orc}
                                cliente={cli}
                                coluna={col}
                                posicaoFila={idx + 1}
                                assinatura={assinaturas[orc.id]}
                                onPromoverPrimeiro={() => promoverParaPrimeiro(`orc-${orc.id}`)}
                                onSalvarArte={(url) => salvarArteOrcamento(orc.id, url)}
                                onSalvarObservacao={(obs) => salvarObservacaoOrcamento(orc.id, obs)}
                                onAbrirQc={() =>
                                  abrirQc({
                                    tipo: "orcamento",
                                    id: orc.id,
                                    numero: orc.numero,
                                    clienteNome: cli?.nome || "Cliente",
                                    clienteTelefone: cli?.telefone || null,
                                    fotoAtual: orc.fotoProntoUrl,
                                    comissaoPercent: orc.item.comissaoPercent,
                                    valorTotal: orc.totalFechado || 0,
                                    produtoNome: orc.materialFechado?.nome || orc.servicoFechado?.nome || "Comunicação Visual",
                                    quantidadeTotal: orc.item.quantidadeUnidades || 1,
                                  })
                                }
                                onAbrirArte={(url, titulo) => setModalArtePreview({ url, titulo })}
                                onAbrirMaisDetalhes={() =>
                                  setModalDetalhesItem({
                                    tipo: "orcamento",
                                    id: orc.id,
                                    numero: orc.numero,
                                    clienteNome: cli?.nome || "Cliente",
                                    clienteTelefone: cli?.telefone || null,
                                    total: orc.totalFechado,
                                    largura: orc.item.largura,
                                    altura: orc.item.altura,
                                    quantidade: orc.item.quantidadeUnidades,
                                    produtoNome:
                                      orc.servicoFechado?.nome ||
                                      (orc.item.servicoId && orc.item.servicoId !== "nenhum"
                                        ? "Serviço + Material"
                                        : "Comunicação Visual"),
                                    varianteNome: orc.materialFechado?.nome,
                                    observacao: orc.observacao,
                                    arteUrl: orc.arteUrl,
                                    fotoProntoUrl: orc.fotoProntoUrl,
                                    fotosLocal: orc.item.fotos?.map((f) => f.url) || (orc.anexoUrl ? [orc.anexoUrl] : []),
                                    status: orc.statusProducao || "aprovado",
                                    contratoAssinado: assinaturas[orc.id]?.assinado,
                                    contratoUrl: `/orcamentos/${orc.id}/contrato`,
                                    osUrl: `/orcamentos/${orc.id}/os`,
                                    dataEmissao: orc.fechadoEm || orc.criadoEm,
                                    tipoServico:
                                      orc.item.servicoId && orc.item.servicoId !== "nenhum"
                                        ? "Serviço + material"
                                        : "Orçamento de serviço",
                                    comissaoPercent: orc.item.comissaoPercent,
                                  })
                                }
                                onAbrirProblema={() =>
                                  setModalProblemaItem({
                                    tipo: "orcamento",
                                    id: orc.id,
                                    numero: orc.numero,
                                    clienteNome: cli?.nome || "Cliente",
                                    obsAtual: orc.observacao,
                                  })
                                }
                                onMudarStatus={(status) =>
                                  solicitarConfirmacao(
                                    cli?.nome ?? "Cliente",
                                    cli?.telefone ?? null,
                                    status,
                                    () => moverOrcamentoProducao(orc.id, status),
                                    orc.id
                                  )
                                }
                              />
                            </PedidoCardArrastavel>
                          )
                        })}
                        {col.status === "entregue" && total > 10 && (
                          <div className="mt-1 p-2 text-center text-xs text-muted-foreground border border-dashed border-teal-300/60 dark:border-teal-800/60 rounded-lg bg-teal-50/50 dark:bg-teal-950/20 shrink-0">
                            <span>Mostrando os 10 mais recentes na coluna.</span>
                            <button
                              type="button"
                              onClick={() => setModalHistoricoEntregues(true)}
                              className="block w-full mt-1 text-teal-700 dark:text-teal-300 font-bold hover:underline cursor-pointer"
                            >
                              Ver todos os {total} entregues →
                            </button>
                          </div>
                        )}
                      </div>
                    </ColunaDroppable>
                  )
                })}
              </div>
            )}

            <DragOverlay>
              {pedidoArrastando ? (
                <div className="w-64 rotate-2 opacity-95 shadow-2xl">
                  <PedidoCardConteudo
                    pedido={pedidoArrastando}
                    produto={produtoDoPedido(pedidoArrastando)}
                    atrasado={estaAtrasado(pedidoArrastando)}
                    coluna={colunaMap[pedidoArrastando.status]}
                    onMudarStatus={() => {}}
                    onSalvarArte={async () => {}}
                  />
                </div>
              ) : orcamentoArrastando ? (
                <div className="w-64 rotate-2 opacity-95 shadow-2xl">
                  <OrcamentoCardConteudo
                    orcamento={orcamentoArrastando}
                    cliente={clientes.find((c) => c.id === orcamentoArrastando.clienteId)}
                    coluna={colunaMap[orcamentoArrastando.statusProducao!]}
                    assinatura={assinaturas[orcamentoArrastando.id]}
                    onMudarStatus={() => {}}
                    onSalvarArte={async () => {}}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>
    </div>
  )}

      {/* Modal de confirmação ao mover para ag_confirmacao/pronto/entregue */}
      <Dialog open={!!confirmando} onOpenChange={(open) => { if (!open && !confirmando?.enviando) setConfirmando(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmando?.novoStatus === "ag_confirmacao" ? "Enviar arte para aprovação?" : confirmando?.novoStatus === "pronto" ? "Marcar como Pronto?" : "Marcar como Entregue?"}
            </DialogTitle>
            <DialogDescription>
              {confirmando?.novoStatus === "ag_confirmacao"
                ? "Deseja enviar uma mensagem ao cliente pedindo aprovação da arte antes de iniciar a produção?"
                : confirmando?.novoStatus === "pronto"
                  ? "Deseja avisar o cliente que o pedido está pronto para retirada/entrega?"
                  : "Deseja enviar uma confirmação de entrega pelo WhatsApp?"}
            </DialogDescription>
          </DialogHeader>

          {confirmando?.clienteTelefone && (
            <div className="flex flex-col gap-2">
              <Label>Mensagem para {confirmando.clienteNome.split(" ")[0]}</Label>
              <Textarea
                rows={4}
                className="resize-none text-sm"
                value={confirmando.mensagem}
                onChange={(e) => setConfirmando((c) => c ? { ...c, mensagem: e.target.value } : null)}
                disabled={confirmando.enviando}
              />
            </div>
          )}

          {!confirmando?.clienteTelefone && (
            <p className="text-sm text-muted-foreground">
              Este cliente não tem telefone cadastrado — não será possível enviar WhatsApp.
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmando(null)} disabled={confirmando?.enviando}>
              Cancelar
            </Button>
            {confirmando?.clienteTelefone && (
              <Button variant="outline" onClick={() => confirmarMudanca(false)} disabled={confirmando?.enviando}>
                Só mover
              </Button>
            )}
            <Button
              onClick={() => confirmarMudanca(!!confirmando?.clienteTelefone)}
              disabled={confirmando?.enviando}
              className={confirmando?.novoStatus === "pronto" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"}
            >
              {confirmando?.enviando
                ? "Enviando…"
                : confirmando?.clienteTelefone
                  ? <><MessageCircle className="mr-1.5 h-4 w-4" />Confirmar e enviar WhatsApp</>
                  : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Visualizador de Arte em Alta Resolução */}
      <Dialog open={!!modalArtePreview} onOpenChange={(open) => { if (!open) setModalArtePreview(null) }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-4 sm:p-6 overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center justify-between gap-2 pr-6">
              <span className="truncate">{modalArtePreview?.titulo || "Visualizador de Imagem"}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-[300px] max-h-[65vh] overflow-auto flex items-center justify-center bg-black/5 dark:bg-black/30 rounded-xl p-2 border border-border/60">
            {modalArtePreview?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={modalArtePreview.url}
                alt={modalArtePreview.titulo}
                className="max-h-full max-w-full object-contain rounded-lg shadow-md"
              />
            ) : null}
          </div>

          <DialogFooter className="flex items-center justify-between gap-2 pt-2 sm:justify-between">
            <Button variant="outline" size="sm" onClick={() => setModalArtePreview(null)}>
              Fechar
            </Button>
            {modalArtePreview?.url && (
              <a
                href={modalArtePreview.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-2xs"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Abrir Original / Baixar</span>
              </a>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Foto da Peça Pronta & Conclusão (Obrigatório para o Kaio) */}
      <Dialog open={!!modalQcItem} onOpenChange={(open) => { if (!open && !qcUploading) setModalQcItem(null) }}>
        <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Camera className="h-5 w-5 text-emerald-600" />
              <span>Foto da Peça Pronta & Conclusão</span>
            </DialogTitle>
            <DialogDescription>
              Tire a foto da peça finalizada #{modalQcItem?.numero} ({modalQcItem?.clienteNome}) para comprovar o serviço e enviar ao Kaio.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            {/* Foto da Peça Pronta (OBRIGATÓRIA PARA O KAIO) - EM DESTAQUE NO TOPO */}
            <div className="flex flex-col gap-2 rounded-2xl border-2 border-dashed border-emerald-500/40 bg-emerald-500/5 p-3.5">
              <span className="text-xs font-bold text-foreground flex items-center justify-between gap-1.5">
                <span className="flex items-center gap-1.5">
                  <Camera className="h-4 w-4 text-emerald-600" />
                  <span className="font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Foto da Peça Pronta (Obrigatório)
                  </span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Visível para o Kaio
                </span>
              </span>
              <p className="text-[11px] text-muted-foreground">
                Tire uma foto clara do produto pronto na bancada antes de entregar ou embalar.
              </p>

              {qcFotomUrl ? (
                <div className="flex flex-col gap-2">
                  <div className="relative group rounded-xl overflow-hidden border-2 border-emerald-500/50 h-52 bg-black/10 flex items-center justify-center shadow-inner">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qcFotomUrl} alt="Foto da peça pronta" className="max-h-full max-w-full object-contain" />
                    <div className="absolute top-2 left-2 bg-emerald-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Foto Anexada
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => qcCameraInputRef.current?.click()}
                      disabled={qcUploading}
                      className="text-xs font-bold gap-1 cursor-pointer"
                    >
                      <Camera className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Câmera</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => qcGaleriaInputRef.current?.click()}
                      disabled={qcUploading}
                      className="text-xs font-bold gap-1 cursor-pointer"
                    >
                      <ImageIcon className="h-3.5 w-3.5 text-blue-600" />
                      <span>Galeria</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => setQcFotomUrl(null)}
                      disabled={qcUploading}
                      className="text-xs font-bold cursor-pointer"
                    >
                      Remover
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Botão 1: Abrir Câmera do Celular */}
                    <button
                      type="button"
                      onClick={() => qcCameraInputRef.current?.click()}
                      disabled={qcUploading}
                      className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-emerald-500 hover:border-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 py-7 px-4 cursor-pointer transition-all active:scale-[0.98] text-center"
                    >
                      {qcUploading ? (
                        <>
                          <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent" />
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Enviando foto...</span>
                        </>
                      ) : (
                        <>
                          <div className="h-12 w-12 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
                            <Camera className="h-6 w-6" />
                          </div>
                          <span className="text-xs sm:text-sm font-black text-emerald-800 dark:text-emerald-200 uppercase tracking-wide">
                            📸 Abrir Câmera
                          </span>
                          <span className="text-[11px] text-muted-foreground font-medium">
                            Tirar foto na bancada agora
                          </span>
                        </>
                      )}
                    </button>

                    {/* Botão 2: Pegar na Galeria / Arquivos */}
                    <button
                      type="button"
                      onClick={() => qcGaleriaInputRef.current?.click()}
                      disabled={qcUploading}
                      className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-blue-500 hover:border-blue-600 bg-blue-500/10 hover:bg-blue-500/20 py-7 px-4 cursor-pointer transition-all active:scale-[0.98] text-center"
                    >
                      {qcUploading ? (
                        <>
                          <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
                          <span className="text-xs font-bold text-blue-700 dark:text-blue-300">Enviando foto...</span>
                        </>
                      ) : (
                        <>
                          <div className="h-12 w-12 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
                            <ImageIcon className="h-6 w-6" />
                          </div>
                          <span className="text-xs sm:text-sm font-black text-blue-800 dark:text-blue-200 uppercase tracking-wide">
                            🖼️ Pegar na Galeria
                          </span>
                          <span className="text-[11px] text-muted-foreground font-medium">
                            Escolher foto salva ou arquivo
                          </span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Input 1: Câmera com capture="environment" */}
                  <input
                    ref={qcCameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    disabled={qcUploading}
                    onChange={handleUploadQcFoto}
                  />

                  {/* Input 2: Galeria / Arquivos sem capture */}
                  <input
                    ref={qcGaleriaInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={qcUploading}
                    onChange={handleUploadQcFoto}
                  />
                </div>
              )}
            </div>

            {/* Gamificação / Comissão do Colaborador (Com divisão por quantidade de peças feitas) */}
            {modalQcItem?.comissaoPercent != null && modalQcItem.comissaoPercent > 0 && (
              <div className="rounded-xl border-2 border-amber-500 bg-gradient-to-br from-amber-500/20 via-yellow-500/10 to-amber-500/25 p-3.5 flex flex-col gap-2.5 shadow-md">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl animate-bounce">🪙</span>
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 block">
                        BÔNUS DA DEMANDA: {modalQcItem.comissaoPercent}%
                      </span>
                      <span className="text-[11px] font-bold text-muted-foreground">
                        Total do bônus: R$ {(((modalQcItem.valorTotal || 0) * modalQcItem.comissaoPercent) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (creditado por peça produzida)
                      </span>
                    </div>
                  </div>
                  <span className="rounded-full bg-amber-500 text-slate-950 font-black text-xs px-2.5 py-1 shadow-xs shrink-0">
                    R$ {(((modalQcItem.valorTotal || 0) * modalQcItem.comissaoPercent) / 100).toFixed(2)} total
                  </span>
                </div>

                <div className="pt-2 border-t border-amber-500/30 flex flex-col gap-2">
                  <span className="text-[11px] font-bold text-foreground">
                    Quem produziu? (Clique para selecionar e informe a quantidade de peças de cada um):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {equipeDisponivel.map((membro) => {
                      const sel = membro in colaboradoresPecas
                      return (
                        <button
                          key={`colab-${membro}`}
                          type="button"
                          onClick={() => {
                            setColaboradoresPecas((prev) => {
                              const novo = { ...prev }
                              if (membro in novo) {
                                delete novo[membro]
                              } else {
                                novo[membro] = 1
                              }
                              return novo
                            })
                          }}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1",
                            sel
                              ? "bg-amber-500 text-slate-950 border-amber-600 shadow-xs"
                              : "bg-background/80 text-foreground border-border hover:bg-muted"
                          )}
                        >
                          <span>{sel ? "✓" : "+"}</span>
                          <span>{membro}</span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Detalhe de Peças por Colaborador selecionado */}
                  {Object.keys(colaboradoresPecas).length > 0 ? (
                    <div className="flex flex-col gap-2 mt-1.5 pt-2 border-t border-amber-500/20">
                      <div className="text-[11px] font-bold text-amber-900 dark:text-amber-200 flex items-center justify-between">
                        <span>Defina as peças produzidas:</span>
                        <span className="text-[10px] text-muted-foreground font-normal">
                          Total de peças: {Object.values(colaboradoresPecas).reduce((a, b) => a + b, 0)}
                        </span>
                      </div>

                      {Object.entries(colaboradoresPecas).map(([membro, qtd]) => {
                        const totalBonus = Math.round(((modalQcItem.valorTotal || 0) * (modalQcItem.comissaoPercent || 0)) / 100 * 100) / 100
                        const totalPecas = Object.values(colaboradoresPecas).reduce((a, b) => a + b, 0) || 1
                        const valorDeste = Math.round(((totalBonus * qtd) / totalPecas) * 100) / 100

                        return (
                          <div
                            key={`pecas-${membro}`}
                            className="flex items-center justify-between p-2 rounded-lg bg-background/95 border border-amber-500/30 shadow-2xs"
                          >
                            <div className="flex flex-col">
                              <span className="text-xs font-extrabold text-foreground">{membro}</span>
                              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                Bônus: {formatarMoeda(valorDeste)} ({qtd} {qtd === 1 ? "peça" : "peças"})
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-muted-foreground font-semibold">Peças:</span>
                              <div className="flex items-center gap-1 border border-border rounded-lg bg-muted/50 p-0.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setColaboradoresPecas((prev) => ({
                                      ...prev,
                                      [membro]: Math.max(1, (prev[membro] || 1) - 1),
                                    }))
                                  }}
                                  className="h-6 w-6 flex items-center justify-center rounded bg-background hover:bg-muted font-black text-xs cursor-pointer"
                                  title="Diminuir peças"
                                >
                                  -
                                </button>
                                <span className="w-8 text-center font-black text-xs text-foreground">
                                  {qtd}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setColaboradoresPecas((prev) => ({
                                      ...prev,
                                      [membro]: (prev[membro] || 1) + 1,
                                    }))
                                  }}
                                  className="h-6 w-6 flex items-center justify-center rounded bg-background hover:bg-muted font-black text-xs cursor-pointer"
                                  title="Aumentar peças"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 italic mt-1">
                      Nenhum colaborador selecionado. Clique em quem produziu para creditar o bônus pelas peças feitas.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Checklist Rápido de Bancada */}
            <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-muted/30 p-3">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                Conferência de Bancada:
              </span>

              <label className="flex items-start gap-2.5 cursor-pointer text-xs font-medium text-foreground hover:text-primary transition-colors">
                <input
                  type="checkbox"
                  checked={qcChecks.medidas}
                  onChange={(e) => setQcChecks((c) => ({ ...c, medidas: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-border text-emerald-600 accent-emerald-600 cursor-pointer"
                />
                <span>📏 Medidas conferidas na trena</span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer text-xs font-medium text-foreground hover:text-primary transition-colors">
                <input
                  type="checkbox"
                  checked={qcChecks.acabamento}
                  onChange={(e) => setQcChecks((c) => ({ ...c, acabamento: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-border text-emerald-600 accent-emerald-600 cursor-pointer"
                />
                <span>✂️ Acabamento OK (solda, corte, ilhós ou verniz)</span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer text-xs font-medium text-foreground hover:text-primary transition-colors">
                <input
                  type="checkbox"
                  checked={qcChecks.visual}
                  onChange={(e) => setQcChecks((c) => ({ ...c, visual: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-border text-emerald-600 accent-emerald-600 cursor-pointer"
                />
                <span>🔍 Inspeção visual OK (sem riscos ou manchas)</span>
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setModalQcItem(null)} disabled={qcUploading}>
              Cancelar
            </Button>
            {qcFotomUrl ? (
              <Button
                onClick={handleConcluirQc}
                disabled={qcUploading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                <span>Concluir Peça & Enviar ao Kaio</span>
              </Button>
            ) : (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  onClick={() => qcCameraInputRef.current?.click()}
                  disabled={qcUploading}
                  className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                >
                  <Camera className="mr-1.5 h-4 w-4" />
                  <span>Abrir Câmera</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => qcGaleriaInputRef.current?.click()}
                  disabled={qcUploading}
                  className="flex-1 sm:flex-none font-bold text-xs border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                >
                  <ImageIcon className="mr-1.5 h-4 w-4" />
                  <span>Pegar na Galeria</span>
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Reportar Problema / Retrabalho */}
      <Dialog open={!!modalProblemaItem} onOpenChange={(open) => { if (!open && !salvandoProblema) setModalProblemaItem(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-destructive">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <span>Reportar Problema na Produção</span>
            </DialogTitle>
            <DialogDescription>
              Informe o que está travando o item #{modalProblemaItem?.numero} ({modalProblemaItem?.clienteNome}).
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-1">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold">Motivo do Problema:</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  "Falta de material / Bobina",
                  "Erro de impressão / Cabeçote",
                  "Medidas incorretas",
                  "Máquina / Plotter parada",
                  "Arquivo de arte corrompido",
                  "Outro problema",
                ].map((motivo) => (
                  <button
                    key={motivo}
                    type="button"
                    onClick={() => setMotivoProblema(motivo)}
                    className={cn(
                      "rounded-lg p-2 text-left text-xs font-medium border transition-colors",
                      motivoProblema === motivo
                        ? "border-destructive bg-destructive/10 text-destructive font-bold"
                        : "border-border/80 bg-background hover:bg-muted text-muted-foreground"
                    )}
                  >
                    {motivo}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold">Detalhes adicionais (opcional):</Label>
              <Textarea
                rows={3}
                placeholder="Ex: lona 440g acabou, necessário pedir reposição ou aguardar entrega..."
                value={detalheProblema}
                onChange={(e) => setDetalheProblema(e.target.value)}
                className="text-xs resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setModalProblemaItem(null)} disabled={salvandoProblema}>
              Cancelar
            </Button>
            <Button
              onClick={handleRegistrarProblema}
              disabled={salvandoProblema || (!motivoProblema && !detalheProblema.trim())}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold"
            >
              <AlertTriangle className="mr-1.5 h-4 w-4" />
              <span>{salvandoProblema ? "Salvando..." : "Emitir Alerta"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Mais Detalhes (Ficha Completa, OS, Contrato, Problema) */}
      <Dialog open={!!modalDetalhesItem} onOpenChange={(open) => { if (!open) setModalDetalhesItem(null) }}>
        <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-bold">
                {modalDetalhesItem?.tipo === "orcamento" ? "Ordem de Serviço" : "Pedido Rápido"} #{modalDetalhesItem?.numero}
              </span>
              {modalDetalhesItem?.tipo === "orcamento" && (
                modalDetalhesItem?.contratoAssinado ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-xs font-bold border border-emerald-500/30">
                    <FileCheck className="h-3.5 w-3.5" />
                    ✓ Documento Assinado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-xs font-bold border border-amber-500/30">
                    <FileCheck className="h-3.5 w-3.5" />
                    ⏳ Ag. Assinatura
                  </span>
                )
              )}
            </div>
            <DialogTitle className="text-base font-bold text-foreground">
              {modalDetalhesItem?.clienteNome || "Cliente"}
            </DialogTitle>
            <DialogDescription>
              Ficha detalhada com especificações técnicas, documentação e suporte.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2 text-xs">
            {/* Medidas e Especificações */}
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs pb-1.5 border-b border-border/40">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Especificações Técnicas
                </span>
                {modalDetalhesItem?.dataEmissao && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    <span>{formatarData(modalDetalhesItem.dataEmissao)}</span>
                  </span>
                )}
              </div>

              {modalDetalhesItem?.tipoServico && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-muted-foreground shrink-0">Tipo:</span>
                  <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                    {modalDetalhesItem.tipoServico}
                  </span>
                </div>
              )}

              {modalDetalhesItem?.largura != null && modalDetalhesItem?.altura != null && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-muted-foreground shrink-0">Medidas:</span>
                  <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 font-bold text-amber-900 dark:text-amber-300">
                    📏 {modalDetalhesItem.largura}m × {modalDetalhesItem.altura}m
                    {modalDetalhesItem.quantidade && modalDetalhesItem.quantidade > 1 ? ` (${modalDetalhesItem.quantidade} un)` : ""}
                  </span>
                </div>
              )}

              {modalDetalhesItem?.produtoNome && (
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-muted-foreground shrink-0">Produto / Serviço:</span>
                  <span className="font-medium text-foreground">{modalDetalhesItem.produtoNome}</span>
                </div>
              )}

              {modalDetalhesItem?.varianteNome && (
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-muted-foreground shrink-0">Material / Variante:</span>
                  <span className="font-bold text-foreground">{modalDetalhesItem.varianteNome}</span>
                </div>
              )}

              {modalDetalhesItem?.acabamento && (
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-muted-foreground shrink-0">Acabamento:</span>
                  <span className="font-medium text-foreground">{modalDetalhesItem.acabamento}</span>
                </div>
              )}

              {modalDetalhesItem?.total != null && (
                <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                  <span className="font-semibold text-muted-foreground">Valor Fechado:</span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {formatarMoeda(modalDetalhesItem.total)}
                  </span>
                </div>
              )}

              {modalDetalhesItem?.comissaoPercent != null && modalDetalhesItem.comissaoPercent > 0 && (
                <div className="flex items-center justify-between gap-1.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-800 dark:text-amber-300">
                  <span className="flex items-center gap-1.5">
                    <span>🪙</span>
                    <span>Bônus do Colaborador: {modalDetalhesItem.comissaoPercent}%</span>
                  </span>
                  <span className="bg-amber-500/20 px-2 py-0.5 rounded text-[11px] font-black">
                    {formatarMoeda(((modalDetalhesItem.total || 0) * modalDetalhesItem.comissaoPercent) / 100)} cada (integral)
                  </span>
                </div>
              )}
            </div>

            {/* Botão Principal de Imprimir Ficha de Produção */}
            <button
              type="button"
              onClick={() => handleImprimirFicha(modalDetalhesItem)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>🖨️ Imprimir Ficha de Produção (Instrução para Bancada)</span>
            </button>

            {/* Foto da Peça Pronta (Evidência enviada pelo Colaborador) */}
            {modalDetalhesItem?.fotoProntoUrl && (
              <div className="flex flex-col gap-2 rounded-2xl border-2 border-emerald-500/60 bg-emerald-500/10 p-3.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <Camera className="h-4 w-4 text-emerald-600" />
                    <span>Foto da Peça Finalizada (Enviada pelo Colaborador)</span>
                  </span>
                  <span className="text-[10px] bg-emerald-500 text-white font-bold px-2 py-0.5 rounded-full shadow-2xs">
                    ✅ Concluído na Fábrica
                  </span>
                </div>
                <div
                  className="relative rounded-xl overflow-hidden border border-emerald-500/40 max-h-64 bg-black/15 flex items-center justify-center cursor-pointer hover:opacity-95 transition-opacity"
                  onClick={() =>
                    setModalArtePreview({
                      url: modalDetalhesItem.fotoProntoUrl!,
                      titulo: `Peça Pronta #${modalDetalhesItem.numero} - ${modalDetalhesItem.clienteNome}`,
                    })
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={modalDetalhesItem.fotoProntoUrl}
                    alt="Foto da Peça Pronta"
                    className="max-h-64 max-w-full object-contain"
                  />
                </div>
                <span className="text-[10px] text-center text-emerald-700 dark:text-emerald-300 font-medium">
                  🔍 Toque na foto para abrir em tela cheia com zoom
                </span>
              </div>
            )}

            {/* Fotos Lado a Lado: Foto do Local (Orçamento) e Arte Aprovada */}
            {((modalDetalhesItem?.fotosLocal && modalDetalhesItem.fotosLocal.length > 0) || modalDetalhesItem?.arteUrl) && (
              <div className="flex flex-col gap-1.5 pt-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Fotos & Referências da Demanda
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {modalDetalhesItem?.fotosLocal && modalDetalhesItem.fotosLocal.length > 0 ? (
                    <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-muted/20 p-2">
                      <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                        <Camera className="h-3 w-3 text-primary" />
                        Foto do Local (Orçamento)
                      </span>
                      <div className="h-36 rounded-lg overflow-hidden bg-black/10 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={modalDetalhesItem.fotosLocal[0]}
                          alt="Foto do Local"
                          className="max-h-full max-w-full object-contain cursor-pointer"
                          onClick={() => setModalArtePreview({ url: modalDetalhesItem.fotosLocal![0], titulo: `Foto do Local - #${modalDetalhesItem.numero}` })}
                        />
                      </div>
                    </div>
                  ) : null}

                  {modalDetalhesItem?.arteUrl ? (
                    <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-muted/20 p-2">
                      <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                        <ImageIcon className="h-3 w-3 text-emerald-600" />
                        Arte Aprovada (Layout)
                      </span>
                      <div className="h-36 rounded-lg overflow-hidden bg-black/10 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={modalDetalhesItem.arteUrl}
                          alt="Arte Aprovada"
                          className="max-h-full max-w-full object-contain cursor-pointer"
                          onClick={() => setModalArtePreview({ url: modalDetalhesItem.arteUrl!, titulo: `Arte Aprovada - #${modalDetalhesItem.numero}` })}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {/* Observações / Instruções da Fábrica */}
            {modalDetalhesItem?.observacao && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 dark:bg-amber-950/20 p-3 flex flex-col gap-1">
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  Instruções e Observações da Fábrica
                </span>
                <p className="font-medium text-foreground whitespace-pre-wrap leading-relaxed">
                  {modalDetalhesItem.observacao}
                </p>
              </div>
            )}

            {/* Documentos, Assinatura & Pagamento */}
            {modalDetalhesItem && (
              <div className="flex flex-col gap-3 pt-1">
                {/* 1. Bloco Ordem de Serviço */}
                <div className="flex flex-col gap-1.5 p-2.5 rounded-xl border border-border/70 bg-muted/20">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-foreground font-semibold">
                      <Printer className="h-3.5 w-3.5 text-primary" />
                      Ordem de Serviço (OS #{modalDetalhesItem.numero})
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium">PDF & WhatsApp</span>
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleAbrirOsPdf(modalDetalhesItem)}
                      className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold border border-border/80 transition-all active:scale-[0.98] cursor-pointer"
                      title="Abrir PDF da Ordem de Serviço para visualizar ou imprimir"
                    >
                      <Printer className="h-4 w-4 text-primary shrink-0" />
                      <span>Imprimir / Abrir PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEnviarOsWhatsapp(modalDetalhesItem)}
                      disabled={enviandoOsWhatsapp}
                      className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all active:scale-[0.98] cursor-pointer"
                      title="Enviar documento PDF da OS diretamente para o WhatsApp do cliente"
                    >
                      <MessageCircle className="h-4 w-4 shrink-0" />
                      <span>{enviandoOsWhatsapp ? "Enviando..." : "Enviar OS no WhatsApp"}</span>
                    </button>
                  </div>
                </div>

                {/* 2. Bloco Assinatura Digital & Contrato */}
                <div className="flex flex-col gap-1.5 p-2.5 rounded-xl border border-border/70 bg-muted/20">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-foreground font-semibold">
                      <FileCheck className="h-3.5 w-3.5 text-amber-500" />
                      Assinatura Digital & Contrato
                    </span>
                    {modalDetalhesItem.contratoAssinado ? (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">✓ Assinado</span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Ag. Assinatura</span>
                    )}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleAbrirAssinatura(modalDetalhesItem)}
                      disabled={abrindoAssinatura}
                      className={cn(
                        "flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold border transition-all active:scale-[0.98] cursor-pointer",
                        modalDetalhesItem?.contratoAssinado
                          ? "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                          : "bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 border-amber-500/30"
                      )}
                      title={modalDetalhesItem?.contratoAssinado ? "Ver o contrato assinado pelo cliente em PDF" : "Abrir tela para o cliente assinar agora na fábrica"}
                    >
                      <FileCheck className="h-4 w-4 shrink-0" />
                      <span>
                        {abrindoAssinatura
                          ? "Abrindo..."
                          : modalDetalhesItem?.contratoAssinado
                          ? "Ver Assinado (PDF)"
                          : "Abrir p/ Assinar na Tela"}
                      </span>
                    </button>
                    {modalDetalhesItem?.contratoAssinado ? (
                      <div
                        className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-500/30"
                        title="O cliente já assinou este contrato digitalmente. Não é permitido nem necessário reenviar."
                      >
                        <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>✓ Já Assinado pelo Cliente</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleEnviarAssinaturaWhatsapp(modalDetalhesItem)}
                        disabled={enviandoAssinaturaWhatsapp}
                        className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all active:scale-[0.98] cursor-pointer"
                        title="Enviar link de assinatura digital para o WhatsApp do cliente"
                      >
                        <MessageCircle className="h-4 w-4 shrink-0" />
                        <span>{enviandoAssinaturaWhatsapp ? "Enviando..." : "Enviar Link no WhatsApp"}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 3. Bloco Cobrança & Formas de Pagamento */}
                <div className="flex flex-col gap-1.5 p-2.5 rounded-xl border border-border/70 bg-muted/20">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-foreground font-semibold">
                      <CreditCard className="h-3.5 w-3.5 text-green-500" />
                      Cobrança (Pix & Cartão em até 12x)
                    </span>
                    <span className="text-[10px] text-muted-foreground font-bold">
                      {(modalDetalhesItem.total || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleEnviarCobrancaWhatsapp(modalDetalhesItem)}
                      disabled={enviandoCobrancaModal}
                      className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition-all active:scale-[0.98] cursor-pointer shadow-xs"
                      title="Enviar mensagem completa com Chave Pix, Copia e Cola e Link do Cartão em 12x"
                    >
                      <MessageCircle className="h-4 w-4 shrink-0" />
                      <span>{enviandoCobrancaModal ? "Enviando..." : "Enviar Pix & Cartão (Zap)"}</span>
                    </button>
                    <CobrancaCartaoDialog
                      orcamentoId={modalDetalhesItem.tipo === "orcamento" ? modalDetalhesItem.id : undefined}
                      numeroOrcamento={modalDetalhesItem.numero}
                      valorTotal={modalDetalhesItem.total || 0}
                      nomeCliente={modalDetalhesItem.clienteNome}
                      telefoneCliente={modalDetalhesItem.clienteTelefone || undefined}
                      trigger={
                        <button
                          type="button"
                          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                          title="Cobrar na Maquininha Point Smart ou copiar link Mercado Pago"
                        >
                          <CreditCard className="h-4 w-4 shrink-0" />
                          <span>Cobrar Cartão / Maquininha</span>
                        </button>
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Botão de Marcar Problema como Resolvido (quando houver alerta ativo) */}
            {temProblemaReportado(modalDetalhesItem?.observacao) && (
              <button
                type="button"
                onClick={async () => {
                  const item = modalDetalhesItem
                  if (!item) return
                  const obsLimpa = limparAlertaProblema(item.observacao)
                  if (item.tipo === "pedido") {
                    await salvarObservacaoPedidoRapido(item.id, obsLimpa)
                  } else {
                    await salvarObservacaoOrcamento(item.id, obsLimpa)
                  }
                  setModalDetalhesItem(null)
                  toast.success("Alerta de problema marcado como resolvido!")
                }}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold transition-all cursor-pointer shadow-md"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Marcar Problema como Resolvido ✓</span>
              </button>
            )}

            {/* Botão de Reportar Problema */}
            <button
              type="button"
              onClick={() => {
                const item = modalDetalhesItem
                setModalDetalhesItem(null)
                if (item) {
                  setModalProblemaItem({
                    tipo: item.tipo,
                    id: item.id,
                    numero: item.numero,
                    clienteNome: item.clienteNome,
                    obsAtual: item.observacao,
                  })
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold border border-red-500/30 transition-colors cursor-pointer"
            >
              <AlertTriangle className="h-4 w-4" />
              <span>Reportar Problema / Retrabalho</span>
            </button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalDetalhesItem(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Histórico Geral de Todos os Serviços Entregues */}
      <HistoricoEntreguesDialog
        open={modalHistoricoEntregues}
        onOpenChange={setModalHistoricoEntregues}
        pedidosRapidos={pedidosRapidos}
        orcamentos={orcamentos}
        clientes={clientes}
        produtosRapidos={produtosRapidos}
        assinaturas={assinaturas}
        onAbrirMaisDetalhes={(item) => {
          if (item.tipo === "pedido" && item.pedidoOriginal) {
            const p = item.pedidoOriginal
            setModalDetalhesItem({
              tipo: "pedido",
              id: p.id,
              numero: p.numero,
              clienteNome: p.clienteNome,
              clienteTelefone: p.clienteTelefone,
              total: p.total,
              produtoNome: p.produtoNome ?? produtoDoPedido(p)?.nome,
              varianteNome: p.varianteNome,
              acabamento: p.acabamento,
              observacao: p.observacao,
              arteUrl: p.arteUrl,
              fotoProntoUrl: p.fotoProntoUrl,
              status: p.status,
              comissaoPercent: p.comissaoPercent,
            })
          } else if (item.tipo === "orcamento" && item.orcamentoOriginal) {
            const o = item.orcamentoOriginal
            const cli = clientes.find((c) => c.id === o.clienteId)
            const ass = assinaturas[o.id]
            setModalDetalhesItem({
              tipo: "orcamento",
              id: o.id,
              numero: o.numero,
              clienteNome: cli?.nome || "Cliente",
              clienteTelefone: cli?.telefone || null,
              total: o.totalFechado || (o.item as any)?.total || 0,
              largura: o.item?.largura,
              altura: o.item?.altura,
              quantidade: o.item?.quantidadeUnidades,
              produtoNome: o.materialFechado?.nome || o.servicoFechado?.nome || "Comunicação Visual",
              observacao: o.observacao,
              arteUrl: o.arteUrl,
              fotoProntoUrl: o.fotoProntoUrl,
              status: o.statusProducao || "entregue",
              contratoAssinado: ass?.assinado,
              contratoUrl: ass?.pdfUrl || undefined,
              osUrl: `/api/orcamentos/${o.id}/os/pdf`,
              dataEmissao: o.osEmitidaEm || o.fechadoEm,
              comissaoPercent: o.comissaoPercent,
            })
          }
        }}
        onMoverStatus={(tipo, id, novoStatus) => {
          if (tipo === "pedido") {
            const ped = pedidosRapidos.find((p) => p.id === id)
            solicitarConfirmacao(
              ped?.clienteNome ?? "Cliente",
              ped?.clienteTelefone ?? null,
              novoStatus,
              () => moverPedidoRapido(id, novoStatus),
              id
            )
          } else {
            const orc = orcamentos.find((o) => o.id === id)
            const cli = clientes.find((c) => c.id === orc?.clienteId)
            solicitarConfirmacao(
              cli?.nome ?? "Cliente",
              cli?.telefone ?? null,
              novoStatus,
              () => moverOrcamentoProducao(id, novoStatus),
              id
            )
          }
        }}
      />
    </>
  )
}

function ColunaDroppable({
  status,
  coluna,
  children,
}: {
  status: StatusPedidoRapido
  coluna: (typeof colunas)[number]
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-64 xl:w-72 shrink-0 flex-col h-full rounded-xl border border-border/80 bg-card shadow-xs overflow-hidden transition-colors",
        isOver && `${coluna.corFundo} ring-2 ring-inset ${coluna.corBorda}`
      )}
    >
      {children}
    </div>
  )
}

function PedidoCardArrastavel({
  id,
  children,
}: {
  id: string
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id,
    data: { tipo: "card", cardId: id },
  })
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `card:${id}`,
    data: { tipo: "card", cardId: id },
  })

  return (
    <div
      ref={(node) => {
        setDragRef(node)
        setDropRef(node)
      }}
      {...listeners}
      {...attributes}
      className={cn(
        "cursor-grab touch-none active:cursor-grabbing transition-all duration-150",
        isDragging && "opacity-30",
        isOver && "ring-2 ring-primary ring-offset-2 scale-[1.01] rounded-xl"
      )}
    >
      {children}
    </div>
  )
}

function ArteCardWidget({
  id,
  arteUrl,
  arteAprovadaEm,
  status,
  clienteNome,
  clienteTelefone,
  onSalvarArte,
  onAbrirArte,
}: {
  id: string
  arteUrl?: string
  arteAprovadaEm?: string
  status: StatusPedidoRapido
  clienteNome: string
  clienteTelefone?: string | null
  onSalvarArte: (url: string | null) => Promise<void>
  onAbrirArte?: (url: string, titulo: string) => void
}) {
  const [enviando, setEnviando] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const rawFile = e.target.files?.[0]
    if (!rawFile) return
    setEnviando(true)
    try {
      const file = await comprimirImagemParaUpload(rawFile)
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: form })
      const data = await res.json()
      if (data.url) {
        await onSalvarArte(data.url)
      }
    } catch (err) {
      console.error("Erro ao enviar arte:", err)
    } finally {
      setEnviando(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  function handleCopiarLink() {
    if (typeof window === "undefined") return
    const link = `${window.location.origin}/arte/${id}`
    navigator.clipboard.writeText(link)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const linkWhatsappAprovacao = clienteTelefone
    ? linkWhatsapp(
        clienteTelefone,
        mensagemProducao(clienteNome, "ag_confirmacao", id)
      )
    : null

  return (
    <div
      className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-muted/20 p-2 text-xs"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="flex items-center gap-1 font-semibold text-muted-foreground text-[11px]">
          <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
          Arte
        </span>
        {arteAprovadaEm ? (
          <span className="flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" /> Aprovada
          </span>
        ) : status === "ag_confirmacao" ? (
          <span className="flex items-center gap-1 rounded bg-pink-500/15 px-1.5 py-0.5 text-[10px] font-bold text-pink-500">
            <Clock className="h-3 w-3" /> Ag. Aprovação
          </span>
        ) : null}
      </div>

      {arteUrl ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="group relative h-9 w-9 shrink-0 overflow-hidden rounded border bg-black/5 cursor-pointer"
              onClick={() => onAbrirArte && onAbrirArte(arteUrl, `Arte - ${clienteNome}`)}
              title="Toque para ampliar"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={arteUrl} alt="Arte" className="h-full w-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity text-white">
                <Eye className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-medium text-foreground truncate">Arte anexada</span>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <button
                  type="button"
                  onClick={handleCopiarLink}
                  className="hover:text-foreground underline underline-offset-2 flex items-center gap-0.5"
                >
                  {copiado ? <Check className="h-2.5 w-2.5 text-emerald-600" /> : <Copy className="h-2.5 w-2.5" />}
                  {copiado ? "Copiado" : "Link"}
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={enviando}
                  className="hover:text-foreground underline underline-offset-2"
                  title="Trocar imagem"
                >
                  Trocar
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => onSalvarArte(null)}
                  disabled={enviando}
                  className="text-destructive/80 hover:text-destructive"
                  title="Remover arte"
                >
                  Remover
                </button>
              </div>
            </div>
          </div>
          {linkWhatsappAprovacao && (
            <a
              href={linkWhatsappAprovacao}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-emerald-700 transition-colors shrink-0"
              title="Enviar para aprovação no WhatsApp"
            >
              <MessageCircle className="h-3 w-3" />
              WhatsApp
            </a>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            disabled={enviando}
            onChange={handleUpload}
          />
        </div>
      ) : (
        <div>
          <label className="flex items-center justify-center gap-1.5 rounded border border-dashed border-border hover:border-violet-500 bg-background/50 hover:bg-violet-500/5 py-1 px-2 text-muted-foreground hover:text-violet-600 dark:hover:text-violet-400 text-[11px] font-medium cursor-pointer transition-colors">
            {enviando ? (
              <>
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span>Enviando...</span>
              </>
            ) : (
              <>
                <Upload className="h-3 w-3" />
                <span>Anexar Arte</span>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              disabled={enviando}
              onChange={handleUpload}
            />
          </label>
        </div>
      )}
    </div>
  )
}

function ObservacaoProducaoWidget({
  observacaoInicial,
  onSalvar,
}: {
  observacaoInicial?: string
  onSalvar: (texto: string) => Promise<void>
}) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(observacaoInicial || "")
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    setTexto(observacaoInicial || "")
  }, [observacaoInicial])

  async function handleSalvar() {
    setSalvando(true)
    try {
      await onSalvar(texto)
      setEditando(false)
      toast.success("Instrução de produção salva!")
    } catch {
      toast.error("Erro ao salvar instrução")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div
      className="flex flex-col text-xs"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {editando ? (
        <div className="flex flex-col gap-1.5 rounded-xl border border-amber-500/50 bg-amber-500/10 dark:bg-amber-950/30 p-2 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold text-amber-700 dark:text-amber-400">
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Instrução pra Fábrica / TV:
            </span>
          </div>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ex: favor fazer estrutura metálica para pintar na cor preta..."
            rows={2}
            className="w-full rounded-lg border border-border/80 bg-background p-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-none focus:ring-1 focus:ring-amber-500"
            autoFocus
          />
          <div className="flex items-center justify-end gap-1.5 pt-0.5">
            <button
              type="button"
              disabled={salvando}
              onClick={() => {
                setTexto(observacaoInicial || "")
                setEditando(false)
              }}
              className="px-2 py-0.5 rounded text-[11px] font-medium text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={salvando}
              onClick={handleSalvar}
              className="px-2.5 py-0.5 rounded bg-amber-600 text-white hover:bg-amber-700 text-[11px] font-bold shadow-2xs transition-colors"
            >
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      ) : observacaoInicial ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 dark:bg-amber-950/20 p-2 text-xs flex flex-col gap-1 shadow-2xs group">
          <div className="flex items-center justify-between text-[11px] font-bold text-amber-700 dark:text-amber-400">
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3 shrink-0" />
              <span>Instrução / Obs Fábrica:</span>
            </span>
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="opacity-70 group-hover:opacity-100 hover:text-amber-900 dark:hover:text-amber-200 transition-opacity p-0.5"
              title="Editar instrução"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
          <p className="text-foreground/90 font-medium break-words whitespace-pre-wrap leading-tight text-xs">
            {observacaoInicial}
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="w-full flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg border border-dashed border-border/80 hover:border-amber-500/60 bg-muted/20 hover:bg-amber-500/5 text-[11px] font-medium text-muted-foreground hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
        >
          <Plus className="h-3 w-3 shrink-0" />
          <span>+ Obs / Instrução pra Fábrica</span>
        </button>
      )}
    </div>
  )
}

function temProblemaReportado(obs?: string): boolean {
  if (!obs) return false
  return obs.includes("ALERTA DA FÁBRICA") || obs.includes("PROBLEMA REPORTADO")
}

function extrairAlertaProblema(obs?: string): string {
  if (!obs) return ""
  const linhas = obs.split("\n")
  const linhasAlerta = linhas.filter(
    (l) => l.includes("ALERTA DA FÁBRICA") || l.includes("PROBLEMA REPORTADO")
  )
  if (linhasAlerta.length > 0) {
    return linhasAlerta.join("\n").trim()
  }
  return obs
}

function limparAlertaProblema(obs?: string): string {
  if (!obs) return ""
  const linhas = obs
    .split("\n")
    .filter((l) => !l.includes("ALERTA DA FÁBRICA") && !l.includes("PROBLEMA REPORTADO"))
  return linhas.join("\n").trim()
}

function PedidoCardConteudo({
  pedido,
  produto,
  atrasado,
  coluna,
  posicaoFila,
  onPromoverPrimeiro,
  onMudarStatus,
  onSalvarArte,
  onSalvarObservacao,
  onAbrirQc,
  onAbrirArte,
  onAbrirMaisDetalhes,
  onAbrirProblema,
}: {
  pedido: PedidoRapido
  produto: ProdutoRapido | undefined
  atrasado: boolean
  coluna: (typeof colunas)[number]
  posicaoFila?: number
  onPromoverPrimeiro?: () => void
  onMudarStatus: (status: StatusPedidoRapido) => void
  onSalvarArte: (url: string | null) => Promise<void>
  onSalvarObservacao?: (obs: string) => Promise<void>
  onAbrirQc?: () => void
  onAbrirArte?: (url: string, titulo: string) => void
  onAbrirMaisDetalhes?: () => void
  onAbrirProblema?: () => void
}) {
  // Colaborador (papel "operador") vê o pedido e instruções, mas não o valor financeiro em reais.
  const { papel } = usePapelAtivo()
  const prazo = obterPrazoEntregaPedido(pedido, produto?.prazoDias)
  const nome = pedido.clienteNome?.trim() || ""
  const ini = nome ? iniciais(nome) : null
  const temProblema = temProblemaReportado(pedido.observacao)

  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-xl border p-3 text-sm shadow-2xs transition-shadow hover:shadow-md",
        temProblema
          ? "border-red-500 ring-2 ring-red-500/50 bg-red-500/5 dark:bg-red-950/20 shadow-md"
          : atrasado
            ? "border-destructive/60 ring-1 ring-destructive/30 bg-card"
            : "border-border/80 bg-card"
      )}
    >
      {/* Topo: avatar + número + preço */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white",
              coluna.cor
            )}
          >
            {ini ?? <UserRound className="h-3.5 w-3.5" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-foreground">
                #{pedido.numero}
              </span>
              <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-semibold text-muted-foreground">
                Rápida
              </span>
              {typeof posicaoFila === "number" && (
                posicaoFila === 1 ? (
                  <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold px-1.5 py-0.2 text-[10px] border border-amber-500/30 shadow-2xs" title="1º lugar da fila">
                    🥇 1º da fila
                  </span>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="rounded bg-primary/10 text-primary font-bold px-1.5 py-0.2 text-[10px]" title="Posição na fila">
                      {posicaoFila}º na fila
                    </span>
                    {onPromoverPrimeiro && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onPromoverPrimeiro()
                        }}
                        className="inline-flex items-center gap-0.5 rounded border border-border/80 bg-background/90 hover:bg-primary hover:text-white px-1.5 py-0.2 text-[9px] font-semibold transition-colors cursor-pointer"
                        title="Priorizar: colocar em 1º lugar"
                      >
                        🔝 1º
                      </button>
                    )}
                  </div>
                )
              )}
              {atrasado && (
                <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
                  Atrasado
                </Badge>
              )}
            </div>
          </div>
        </div>

        {papel !== "operador" && (
          <span className={cn("text-xs font-bold shrink-0", coluna.corTexto)}>
            {formatarMoeda(pedido.total)}
          </span>
        )}
      </div>

      {/* Cliente */}
      <p className="font-semibold text-foreground truncate text-xs leading-tight">
        {nome || <span className="italic text-muted-foreground font-normal">Sem cliente</span>}
      </p>

      {/* Badge de Bônus / Comissão do Colaborador (Regra do Kaio: integral para cada um) */}
      {pedido.comissaoPercent != null && pedido.comissaoPercent > 0 && (
        <div className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300 font-bold text-xs shadow-2xs">
          <span className="flex items-center gap-1.5">
            <span className="text-sm">🪙</span>
            <span>BÔNUS: {pedido.comissaoPercent}%</span>
          </span>
          <span className="text-[11px] font-black bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
            {formatarMoeda((pedido.total * pedido.comissaoPercent) / 100)} cada
          </span>
        </div>
      )}

      {/* Tarja de Alerta de Problema na Peça */}
      {temProblema && (
        <div className="rounded-xl border border-red-500/60 bg-red-500/15 dark:bg-red-950/40 p-2.5 flex flex-col gap-1 text-xs shadow-2xs">
          <div className="flex items-center justify-between gap-1 text-red-600 dark:text-red-400 font-bold text-[11px] uppercase tracking-wide">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 shrink-0 animate-bounce text-red-600 dark:text-red-400" />
              <span>⚠️ PROBLEMA REPORTADO NA PEÇA:</span>
            </span>
            {onSalvarObservacao && (
              <button
                type="button"
                onClick={async (e) => {
                  e.stopPropagation()
                  const obsLimpa = limparAlertaProblema(pedido.observacao)
                  await onSalvarObservacao(obsLimpa)
                  toast.success("Alerta de problema resolvido!")
                }}
                className="text-[10px] bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded px-1.5 py-0.5 font-bold cursor-pointer transition-all shadow-2xs"
                title="Marcar problema como resolvido e remover alerta"
              >
                Resolver ✓
              </button>
            )}
          </div>
          <p className="text-red-700 dark:text-red-300 font-semibold leading-tight text-xs whitespace-pre-wrap">
            {extrairAlertaProblema(pedido.observacao)}
          </p>
        </div>
      )}

      {/* Produto + Especificações + Prazo */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium break-words leading-tight", coluna.corFundo, coluna.corTexto)}>
            {pedido.produtoNome ?? produto?.nome ?? "Produto"}
          </span>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
            <Clock className="h-3 w-3" />
            <span>{prazo ? formatarData(prazo.toISOString()) : "Sem prazo"}</span>
          </div>
        </div>

        {(pedido.varianteNome || pedido.acabamento) && (
          <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
            {pedido.varianteNome && (
              <span className="rounded bg-muted px-1.5 py-0.2 font-medium text-foreground">
                {pedido.varianteNome}
              </span>
            )}
            {pedido.acabamento && (
              <span className="rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 px-1.5 py-0.2 font-medium">
                ✂️ {pedido.acabamento}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Badge de Foto da Peça Pronta (se houver) */}
      {pedido.fotoProntoUrl && (
        <div
          className="flex items-center gap-2.5 p-2 rounded-xl border-2 border-emerald-500/50 bg-emerald-500/10 cursor-pointer transition-all hover:bg-emerald-500/20"
          onClick={() => onAbrirArte && onAbrirArte(pedido.fotoProntoUrl!, `Foto da Peça #${pedido.numero} - ${pedido.clienteNome}`)}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <img src={pedido.fotoProntoUrl} alt="Foto Peça Pronta" className="h-11 w-14 object-cover rounded-lg border border-emerald-500/40 shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
              <Camera className="h-3.5 w-3.5 text-emerald-600" />
              <span>Foto da Peça Pronta</span>
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 underline font-medium">Toque p/ ampliar foto</span>
          </div>
        </div>
      )}

      {/* Widget de Arte */}
      <ArteCardWidget
        id={pedido.id}
        arteUrl={pedido.arteUrl}
        arteAprovadaEm={pedido.arteAprovadaEm}
        status={pedido.status}
        clienteNome={pedido.clienteNome}
        clienteTelefone={pedido.clienteTelefone}
        onSalvarArte={onSalvarArte}
        onAbrirArte={onAbrirArte}
      />

      {/* Widget de Observação / Instrução para Fábrica e TV */}
      {onSalvarObservacao && (
        <ObservacaoProducaoWidget
          observacaoInicial={pedido.observacao}
          onSalvar={onSalvarObservacao}
        />
      )}

      {/* Botão de Avanço Rápido de 1 Toque (Otimizado p/ Chão de Fábrica) */}
      <div className="pt-1 flex flex-col gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
        {pedido.status === "acabamento" ? (
          <button
            type="button"
            onClick={onAbrirQc}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>✅ Concluir / Peça Pronta</span>
          </button>
        ) : pedido.status === "impressao" ? (
          <button
            type="button"
            onClick={() => onMudarStatus("acabamento")}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            <Scissors className="h-4 w-4" />
            <span>✂️ Ir p/ Acabamento</span>
          </button>
        ) : pedido.status === "ag_confirmacao" ? (
          <button
            type="button"
            onClick={() => onMudarStatus("impressao")}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-[0.98] text-white text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>🖨️ Iniciar Impressão</span>
          </button>
        ) : pedido.status === "aprovado" || pedido.status === "arte" ? (
          <button
            type="button"
            onClick={() => onMudarStatus("ag_confirmacao")}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-[0.98] text-white text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            <Send className="h-4 w-4" />
            <span>🎨 Arte Enviada p/ Cliente</span>
          </button>
        ) : pedido.status === "aguardando" ? (
          <button
            type="button"
            onClick={() => onMudarStatus("aprovado")}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            <Flame className="h-4 w-4" />
            <span>🚀 Iniciar Produção</span>
          </button>
        ) : pedido.status === "pronto" ? (
          <div className="flex items-center gap-1.5">
            <span className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
              <CheckCircle2 className="h-3.5 w-3.5" /> Pronto p/ Retirada
            </span>
            <button
              type="button"
              onClick={() => onMudarStatus("entregue")}
              className="py-1.5 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 active:scale-95 text-white text-xs font-bold shadow-2xs transition-all shrink-0 cursor-pointer"
              title="Marcar como entregue ao cliente"
            >
              📦 Entregar
            </button>
          </div>
        ) : null}

        {/* Linha de Ações Rápidas: Ver Arte & Mais Detalhes */}
        <div className="flex items-center gap-1.5">
          {pedido.arteUrl && onAbrirArte && (
            <button
              type="button"
              onClick={() => onAbrirArte(pedido.arteUrl!, `Arte #${pedido.numero} - ${pedido.clienteNome}`)}
              className="flex-1 py-1 px-2 rounded-lg bg-muted/60 hover:bg-muted border border-border/70 text-foreground text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <Eye className="h-3 w-3 text-primary" />
              <span>Ver Arte</span>
            </button>
          )}

          {pedido.fotoProntoUrl && onAbrirArte && (
            <button
              type="button"
              onClick={() => onAbrirArte(pedido.fotoProntoUrl!, `Foto Peça #${pedido.numero} - ${pedido.clienteNome}`)}
              className="py-1 px-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
              title="Ver foto da peça pronta"
            >
              <Camera className="h-3 w-3" />
              <span>Foto</span>
            </button>
          )}

          {onAbrirMaisDetalhes && (
            <button
              type="button"
              onClick={onAbrirMaisDetalhes}
              className="flex-1 py-1 px-2 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/25 text-primary text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
              title="Ver detalhes da peça, OS e reportar problemas"
            >
              <Info className="h-3 w-3" />
              <span>Mais Detalhes</span>
            </button>
          )}
        </div>
      </div>

      {/* Status Bar: Seletor manual para troca livre */}
      <div
        className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-border/60 text-xs"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span className="text-[10px] text-muted-foreground font-medium">Trocar status:</span>
        <Select
          value={pedido.status}
          onValueChange={(val) => onMudarStatus(val as StatusPedidoRapido)}
        >
          <SelectTrigger className="h-6 text-[11px] font-medium px-2 py-0 w-auto min-w-[120px] border-border/80 bg-background/80">
            <div className="flex items-center gap-1.5 truncate">
              <span className={cn("h-2 w-2 rounded-full shrink-0", coluna.cor)} />
              <span className="truncate">{coluna.titulo}</span>
            </div>
          </SelectTrigger>
          <SelectContent>
            {colunas.map((c) => (
              <SelectItem key={c.status} value={c.status} className="text-xs">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full shrink-0", c.cor)} />
                  <span>{c.titulo}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

function OrcamentoCardConteudo({
  orcamento,
  cliente,
  coluna,
  assinatura,
  posicaoFila,
  onPromoverPrimeiro,
  onMudarStatus,
  onSalvarArte,
  onSalvarObservacao,
  onAbrirQc,
  onAbrirArte,
  onAbrirMaisDetalhes,
  onAbrirProblema,
}: {
  orcamento: Orcamento
  cliente: Cliente | undefined
  coluna: (typeof colunas)[number]
  assinatura?: { pdfUrl: string | null; assinado: boolean }
  posicaoFila?: number
  onPromoverPrimeiro?: () => void
  onMudarStatus: (status: StatusPedidoRapido) => void
  onSalvarArte: (url: string | null) => Promise<void>
  onSalvarObservacao?: (obs: string) => Promise<void>
  onAbrirQc?: () => void
  onAbrirArte?: (url: string, titulo: string) => void
  onAbrirMaisDetalhes?: () => void
  onAbrirProblema?: () => void
}) {
  const { papel } = usePapelAtivo()
  const nome = cliente?.nome?.trim() || ""
  const ini = nome ? iniciais(nome) : null
  const statusAtual = (orcamento.statusProducao as StatusPedidoRapido) || "aprovado"
  const temProblema = temProblemaReportado(orcamento.observacao)

  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-xl border p-3 text-sm shadow-2xs transition-shadow hover:shadow-md",
        temProblema
          ? "border-red-500 ring-2 ring-red-500/50 bg-red-500/5 dark:bg-red-950/20 shadow-md"
          : "border-border/80 bg-card ring-1 ring-inset ring-violet-500/20"
      )}
    >
      {/* Topo: avatar + número + preço */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white",
              coluna.cor
            )}
          >
            {ini ?? <UserRound className="h-3.5 w-3.5" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-foreground">
                ORC #{String(orcamento.numero).padStart(4, "0")}
              </span>
              {typeof posicaoFila === "number" && (
                posicaoFila === 1 ? (
                  <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold px-1.5 py-0.2 text-[10px] border border-amber-500/30 shadow-2xs" title="1º lugar da fila">
                    🥇 1º da fila
                  </span>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="rounded bg-primary/10 text-primary font-bold px-1.5 py-0.2 text-[10px]" title="Posição na fila">
                      {posicaoFila}º na fila
                    </span>
                    {onPromoverPrimeiro && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onPromoverPrimeiro()
                        }}
                        className="inline-flex items-center gap-0.5 rounded border border-border/80 bg-background/90 hover:bg-primary hover:text-white px-1.5 py-0.2 text-[9px] font-semibold transition-colors cursor-pointer"
                        title="Priorizar: colocar em 1º lugar"
                      >
                        🔝 1º
                      </button>
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {papel !== "operador" && orcamento.totalFechado != null && (
          <span className={cn("text-xs font-bold shrink-0", coluna.corTexto)}>
            {formatarMoeda(orcamento.totalFechado)}
          </span>
        )}
      </div>

      {/* Cliente */}
      <p className="font-semibold text-foreground truncate text-xs leading-tight">
        {nome || <span className="italic text-muted-foreground font-normal">Sem cliente</span>}
      </p>

      {/* Badge de Bônus / Comissão do Colaborador (Regra do Kaio: integral para cada um) */}
      {orcamento.item.comissaoPercent != null && orcamento.item.comissaoPercent > 0 && (
        <div className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300 font-bold text-xs shadow-2xs">
          <span className="flex items-center gap-1.5">
            <span className="text-sm">🪙</span>
            <span>BÔNUS: {orcamento.item.comissaoPercent}%</span>
          </span>
          <span className="text-[11px] font-black bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
            {formatarMoeda(((orcamento.totalFechado || 0) * orcamento.item.comissaoPercent) / 100)} cada
          </span>
        </div>
      )}

      {/* Tarja de Alerta de Problema na Peça */}
      {temProblema && (
        <div className="rounded-xl border border-red-500/60 bg-red-500/15 dark:bg-red-950/40 p-2.5 flex flex-col gap-1 text-xs shadow-2xs">
          <div className="flex items-center justify-between gap-1 text-red-600 dark:text-red-400 font-bold text-[11px] uppercase tracking-wide">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 shrink-0 animate-bounce text-red-600 dark:text-red-400" />
              <span>⚠️ PROBLEMA REPORTADO NA PEÇA:</span>
            </span>
            {onSalvarObservacao && (
              <button
                type="button"
                onClick={async (e) => {
                  e.stopPropagation()
                  const obsLimpa = limparAlertaProblema(orcamento.observacao)
                  await onSalvarObservacao(obsLimpa)
                  toast.success("Alerta de problema resolvido!")
                }}
                className="text-[10px] bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded px-1.5 py-0.5 font-bold cursor-pointer transition-all shadow-2xs"
                title="Marcar problema como resolvido e remover alerta"
              >
                Resolver ✓
              </button>
            )}
          </div>
          <p className="text-red-700 dark:text-red-300 font-semibold leading-tight text-xs whitespace-pre-wrap">
            {extrairAlertaProblema(orcamento.observacao)}
          </p>
        </div>
      )}

      {/* Medidas Técnicas em Destaque */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-xs font-bold text-amber-900 dark:text-amber-300">
          📏 {orcamento.item.largura}m × {orcamento.item.altura}m
          {orcamento.item.quantidadeUnidades > 1 && ` (${orcamento.item.quantidadeUnidades} un)`}
        </span>
        {orcamento.materialFechado?.nome && (
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground break-words leading-tight" title={orcamento.materialFechado.nome}>
            🧵 {orcamento.materialFechado.nome}
          </span>
        )}
      </div>


      {/* Badge de Foto da Peça Pronta (se houver) */}
      {orcamento.fotoProntoUrl && (
        <div
          className="flex items-center gap-2.5 p-2 rounded-xl border-2 border-emerald-500/50 bg-emerald-500/10 cursor-pointer transition-all hover:bg-emerald-500/20"
          onClick={() => onAbrirArte && onAbrirArte(orcamento.fotoProntoUrl!, `Foto da Peça ORC #${orcamento.numero} - ${cliente?.nome || "Cliente"}`)}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <img src={orcamento.fotoProntoUrl} alt="Foto Peça Pronta" className="h-11 w-14 object-cover rounded-lg border border-emerald-500/40 shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
              <Camera className="h-3.5 w-3.5 text-emerald-600" />
              <span>Foto da Peça Pronta</span>
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 underline font-medium">Toque p/ ampliar foto</span>
          </div>
        </div>
      )}

      {/* Widget de Arte */}
      <ArteCardWidget
        id={orcamento.id}
        arteUrl={orcamento.arteUrl}
        arteAprovadaEm={orcamento.arteAprovadaEm}
        status={statusAtual}
        clienteNome={cliente?.nome || "Cliente"}
        clienteTelefone={cliente?.telefone}
        onSalvarArte={onSalvarArte}
        onAbrirArte={onAbrirArte}
      />

      {/* Widget de Observação / Instrução para Fábrica e TV */}
      {onSalvarObservacao && (
        <ObservacaoProducaoWidget
          observacaoInicial={orcamento.observacao}
          onSalvar={onSalvarObservacao}
        />
      )}

      {/* Botão de Avanço Rápido de 1 Toque (Otimizado p/ Chão de Fábrica) */}
      <div className="pt-1 flex flex-col gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
        {statusAtual === "acabamento" ? (
          <button
            type="button"
            onClick={onAbrirQc}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>✅ Concluir / Peça Pronta</span>
          </button>
        ) : statusAtual === "impressao" ? (
          <button
            type="button"
            onClick={() => onMudarStatus("acabamento")}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            <Scissors className="h-4 w-4" />
            <span>✂️ Ir p/ Acabamento</span>
          </button>
        ) : statusAtual === "ag_confirmacao" ? (
          <button
            type="button"
            onClick={() => onMudarStatus("impressao")}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-[0.98] text-white text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>🖨️ Iniciar Impressão</span>
          </button>
        ) : statusAtual === "aprovado" || statusAtual === "arte" ? (
          <button
            type="button"
            onClick={() => onMudarStatus("ag_confirmacao")}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-[0.98] text-white text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            <Send className="h-4 w-4" />
            <span>🎨 Arte Enviada p/ Cliente</span>
          </button>
        ) : statusAtual === "aguardando" ? (
          <button
            type="button"
            onClick={() => onMudarStatus("aprovado")}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            <Flame className="h-4 w-4" />
            <span>🚀 Iniciar Produção</span>
          </button>
        ) : statusAtual === "pronto" ? (
          <div className="flex items-center gap-1.5">
            <span className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
              <CheckCircle2 className="h-3.5 w-3.5" /> Pronto p/ Retirada
            </span>
            <button
              type="button"
              onClick={() => onMudarStatus("entregue")}
              className="py-1.5 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 active:scale-95 text-white text-xs font-bold shadow-2xs transition-all shrink-0 cursor-pointer"
              title="Marcar como entregue ao cliente"
            >
              📦 Entregar
            </button>
          </div>
        ) : null}

        {/* Linha de Ações Rápidas: Ver Arte & Mais Detalhes */}
        <div className="flex items-center gap-1.5">
          {orcamento.arteUrl && onAbrirArte && (
            <button
              type="button"
              onClick={() => onAbrirArte(orcamento.arteUrl!, `Arte ORC #${orcamento.numero} - ${cliente?.nome || "Cliente"}`)}
              className="flex-1 py-1 px-2 rounded-lg bg-muted/60 hover:bg-muted border border-border/70 text-foreground text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <Eye className="h-3 w-3 text-primary" />
              <span>Ver Arte</span>
            </button>
          )}

          {orcamento.fotoProntoUrl && onAbrirArte && (
            <button
              type="button"
              onClick={() => onAbrirArte(orcamento.fotoProntoUrl!, `Foto Peça ORC #${orcamento.numero} - ${cliente?.nome || "Cliente"}`)}
              className="py-1 px-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
              title="Ver foto da peça pronta"
            >
              <Camera className="h-3 w-3" />
              <span>Foto</span>
            </button>
          )}

          {onAbrirMaisDetalhes && (
            <button
              type="button"
              onClick={onAbrirMaisDetalhes}
              className="flex-1 py-1 px-2 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/25 text-primary text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
              title="Ver detalhes da peça, contrato, OS e reportar problemas"
            >
              <Info className="h-3 w-3" />
              <span>Mais Detalhes</span>
            </button>
          )}
        </div>
      </div>

      {/* Status Bar: Seletor manual para troca livre */}
      <div
        className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-border/60 text-xs"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span className="text-[10px] text-muted-foreground font-medium">Trocar status:</span>
        <Select
          value={statusAtual}
          onValueChange={(val) => onMudarStatus(val as StatusPedidoRapido)}
        >
          <SelectTrigger className="h-6 text-[11px] font-medium px-2 py-0 w-auto min-w-[120px] border-border/80 bg-background/80">
            <div className="flex items-center gap-1.5 truncate">
              <span className={cn("h-2 w-2 rounded-full shrink-0", coluna.cor)} />
              <span className="truncate">{coluna.titulo}</span>
            </div>
          </SelectTrigger>
          <SelectContent>
            {colunas.map((c) => (
              <SelectItem key={c.status} value={c.status} className="text-xs">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full shrink-0", c.cor)} />
                  <span>{c.titulo}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
