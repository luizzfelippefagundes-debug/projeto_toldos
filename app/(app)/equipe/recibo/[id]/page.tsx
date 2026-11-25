"use client"

import { use, useEffect, useState, useRef } from "react"
import Link from "next/link"
import { Printer, ArrowLeft, CheckCircle2, MessageSquare, PenTool, Eraser, Download, ShieldCheck } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { formatarMoeda, formatarData } from "@/lib/format"
import { LOGO_PRINT_BASE64 } from "@/lib/logo-data"

interface ReciboData {
  id: string
  numero_recibo: string
  colaborador_id: string | null
  colaborador_nome: string
  periodo_inicio: string | null
  periodo_fim: string | null
  valor_total: number
  valor_extenso: string | null
  forma_pagamento: string
  tipo_assinatura: string
  assinatura_digital: string | null
  assinado_em: string | null
  observacoes: string | null
  pago_por: string | null
  criado_em: string
}

interface ItemComissao {
  id: string
  numero: string
  cliente_nome: string
  produto_nome: string
  valor_pedido: number
  comissao_percent: number
  valor_comissao: number
  criado_em: string
}

interface EmpresaInfo {
  nome: string
  cnpj: string
  endereco: readonly string[]
  email: string
  contato: string
}

export default function ReciboPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [carregando, setCarregando] = useState(true)
  const [recibo, setRecibo] = useState<ReciboData | null>(null)
  const [itens, setItens] = useState<ItemComissao[]>([])
  const [empresa, setEmpresa] = useState<EmpresaInfo | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  // Modal de Assinatura Digital na Tela
  const [dialogAssinaturaAberto, setDialogAssinaturaAberto] = useState(false)
  const [salvandoAssinatura, setSalvandoAssinatura] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [estaDesenhando, setEstaDesenhando] = useState(false)
  const [temTraco, setTemTraco] = useState(false)

  const carregarRecibo = async () => {
    try {
      setCarregando(true)
      const res = await fetch(`/api/comissoes/recibo/${id}`)
      if (!res.ok) throw new Error("Recibo não encontrado")
      const data = await res.json()
      setRecibo(data.recibo)
      setItens(data.itens || [])
      setEmpresa(data.empresa)
    } catch (err: any) {
      setErro(err.message || "Erro ao carregar recibo")
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarRecibo()
  }, [id])

  // Canvas Handlers para Assinatura Touch/Mouse
  const iniciarDesenho = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    setEstaDesenhando(true)
    const rect = canvas.getBoundingClientRect()
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY

    ctx.beginPath()
    ctx.moveTo(clientX - rect.left, clientY - rect.top)
  }

  const desenhar = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!estaDesenhando) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY

    ctx.lineWidth = 2.5
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = "#0f172a"
    ctx.lineTo(clientX - rect.left, clientY - rect.top)
    ctx.stroke()
    setTemTraco(true)
  }

  const pararDesenho = () => {
    setEstaDesenhando(false)
  }

  const limparCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setTemTraco(false)
  }

  const salvarAssinaturaDigital = async () => {
    const canvas = canvasRef.current
    if (!canvas || !temTraco) return

    try {
      setSalvandoAssinatura(true)
      const dataUrl = canvas.toDataURL("image/png")
      const res = await fetch(`/api/comissoes/recibo/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assinatura_digital: dataUrl }),
      })
      if (!res.ok) throw new Error("Erro ao salvar assinatura")
      setDialogAssinaturaAberto(false)
      await carregarRecibo()
    } catch (err: any) {
      alert(err.message || "Erro ao salvar")
    } finally {
      setSalvandoAssinatura(false)
    }
  }

  const enviarWhatsApp = () => {
    if (!recibo) return
    const total = formatarMoeda(Number(recibo.valor_total))
    const linkRecibo = window.location.href
    const msg = `*TOLDOS PRINT — COMPROVANTE DE BONIFICAÇÃO*\n\n` +
      `Olá, *${recibo.colaborador_nome}*!\n` +
      `Seu repasse de produção foi processado com sucesso.\n\n` +
      `📄 *Recibo:* ${recibo.numero_recibo}\n` +
      `💰 *Valor Líquido:* ${total}\n` +
      `💳 *Forma de Pagamento:* ${recibo.forma_pagamento.toUpperCase()}\n` +
      `📦 *Peças Produzidas:* ${itens.length} itens\n\n` +
      `Você pode visualizar e salvar seu recibo completo no link abaixo:\n` +
      `${linkRecibo}\n\n` +
      `Agradecemos pela sua dedicação e pelo excelente trabalho na produção!`

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`
    window.open(url, "_blank")
  }

  if (carregando) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-bold text-muted-foreground">Carregando recibo...</p>
        </div>
      </div>
    )
  }

  if (erro || !recibo) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg font-bold text-destructive">{erro || "Recibo não encontrado"}</p>
        <Link href="/equipe" className={buttonVariants({ variant: "outline" })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Equipe & RH
        </Link>
      </div>
    )
  }

  const totalNum = Number(recibo.valor_total) || 0
  const rotuloForma =
    recibo.forma_pagamento === "pix" ? "PIX" :
    recibo.forma_pagamento === "dinheiro" ? "Dinheiro em Espécie" :
    recibo.forma_pagamento === "deposito" ? "Depósito Bancário / Transferência" : "Outro"

  return (
    <div className="min-h-screen bg-slate-100/80 dark:bg-slate-950/80 py-4 sm:py-8 px-2 sm:px-4">
      {/* Barra de Ações Superior (Oculta na Impressão) */}
      <div className="no-print mx-auto max-w-4xl mb-6 flex flex-wrap items-center justify-between gap-3 bg-card p-4 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-2">
          <Link href="/equipe" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Equipe & RH
          </Link>
          <div className="h-4 w-px bg-border" />
          <span className="font-black text-sm text-foreground tracking-tight">
            Recibo {recibo.numero_recibo}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDialogAssinaturaAberto(true)}
            className="text-primary border-primary/30 hover:bg-primary/10"
          >
            <PenTool className="mr-1.5 h-4 w-4" />
            {recibo.assinatura_digital ? "Refazer Assinatura Digital" : "Assinar na Tela"}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={enviarWhatsApp}
            className="text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
          >
            <MessageSquare className="mr-1.5 h-4 w-4" />
            Enviar WhatsApp
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => window.print()}
            className="bg-primary text-primary-foreground shadow-xs font-bold"
          >
            <Printer className="mr-1.5 h-4 w-4" />
            Imprimir Recibo (A4)
          </Button>
        </div>
      </div>

      {/* Folha de Recibo A4 Oficial */}
      <div className="recibo-sheet mx-auto max-w-4xl bg-white text-slate-950 p-6 sm:p-10 rounded-2xl border border-slate-300 shadow-md">
        {/* Cabeçalho da Empresa */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b-2 border-slate-900 pb-5">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={LOGO_PRINT_BASE64}
              alt="Toldos Print"
              className="h-14 w-auto object-contain shrink-0"
            />
            <div className="border-l-2 border-slate-400 pl-3.5">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 uppercase leading-none">
                {empresa?.nome || "TOLDOS PRINT"}
              </h1>
              <p className="text-xs sm:text-sm font-bold text-slate-700 tracking-wide mt-1">
                INDÚSTRIA DE TOLDOS & COMUNICAÇÃO VISUAL
              </p>
              <p className="text-[11px] text-slate-600 mt-1 font-medium">
                {empresa?.cnpj || "CNPJ: 63.177.134/0001-00"}
              </p>
              <p className="text-[11px] text-slate-600 font-medium">
                {empresa?.endereco?.[0] || "Avenida João Quiuqui"} • {empresa?.endereco?.[1] || "Águia Branca/ES"} • Tel: (27) 99748-9714
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right flex flex-col items-start sm:items-end">
            <span className="inline-block rounded-md bg-slate-900 text-white px-3 py-1 text-xs font-black tracking-wider uppercase">
              Recibo de Bonificação
            </span>
            <span className="text-lg font-black text-slate-900 mt-1.5 tracking-tight">
              {recibo.numero_recibo}
            </span>
            <span className="text-xs text-slate-600 font-medium">
              Emissão: {formatarData(recibo.criado_em)}
            </span>
          </div>
        </div>

        {/* Informações do Pagamento e Colaborador */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div>
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-500 block">
              Favorecido / Colaborador:
            </span>
            <p className="text-base font-black text-slate-950 mt-0.5">
              {recibo.colaborador_nome}
            </p>
            {recibo.periodo_inicio && recibo.periodo_fim && (
              <p className="text-xs text-slate-600 font-medium mt-1">
                Período de Produção: {formatarData(recibo.periodo_inicio)} até {formatarData(recibo.periodo_fim)}
              </p>
            )}
          </div>

          <div className="sm:text-right">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-500 block">
              Forma de Pagamento:
            </span>
            <p className="text-sm font-black text-slate-900 mt-0.5 flex items-center sm:justify-end gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-600 inline-block" />
              {rotuloForma}
            </p>
            <p className="text-xs text-slate-600 font-medium mt-1">
              Responsável pelo Repasse: {recibo.pago_por || "Administração"}
            </p>
          </div>
        </div>

        {/* Tabela Discriminada de Serviços Produzidos */}
        <div className="my-6">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2.5 flex items-center justify-between">
            <span>Discriminação dos Serviços Produzidos ({itens.length} itens):</span>
            <span className="text-[11px] font-bold text-slate-500">Valores integrais por colaborador</span>
          </h2>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-900">
              <thead className="bg-slate-100 text-[10px] uppercase tracking-wider font-black text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Item / Data</th>
                  <th className="py-2.5 px-3">OS / Pedido</th>
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3">Serviço / Produto</th>
                  <th className="py-2.5 px-3 text-right">Valor da OS</th>
                  <th className="py-2.5 px-3 text-right">Bônus Ganho</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {itens.map((item, idx) => (
                  <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                    <td className="py-2 px-3 text-slate-500 font-medium">
                      {formatarData(item.criado_em)}
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-950">
                      OS #{item.numero}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-800">
                      {item.cliente_nome}
                    </td>
                    <td className="py-2 px-3 text-slate-700">
                      {item.produto_nome}
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-slate-600">
                      {formatarMoeda(Number(item.valor_pedido) || 0)}
                    </td>
                    <td className="py-2 px-3 text-right font-black text-emerald-800">
                      {formatarMoeda(Number(item.valor_comissao) || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-black border-t-2 border-slate-300">
                <tr>
                  <td colSpan={5} className="py-3 px-3 text-right uppercase text-slate-800">
                    Total Líquido da Bonificação:
                  </td>
                  <td className="py-3 px-3 text-right text-base text-slate-950 font-black">
                    {formatarMoeda(totalNum)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Destaque do Valor por Extenso */}
        <div className="my-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-950 text-xs">
          <span className="font-bold uppercase tracking-wider text-[10px] text-amber-800 block">
            Importância Líquida:
          </span>
          <p className="text-sm font-black mt-0.5">
            {formatarMoeda(totalNum)} ({recibo.valor_extenso || "valor por extenso"})
          </p>
        </div>

        {/* Termo de Quitação Formal */}
        <div className="my-6 text-justify text-xs text-slate-700 leading-relaxed bg-slate-50/80 p-4 rounded-xl border border-slate-200">
          <p>
            Declaro ter recebido da empresa <strong>{empresa?.nome || "TOLDOSPRINT"}</strong> a importância líquida de{" "}
            <strong>{formatarMoeda(totalNum)} ({recibo.valor_extenso})</strong>, através de <strong>{rotuloForma}</strong>,
            referente à bonificação por produtividade das ordens de serviço acima discriminadas, dando à referida empresa plena, rasa e irrevogável quitação de todos os valores decorrentes da fabricação dos referidos serviços.
          </p>
        </div>

        {/* Campos de Assinaturas */}
        <div className="mt-12 pt-8 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-8">
          {/* Assinatura da Empresa */}
          <div className="flex flex-col items-center justify-end text-center">
            <div className="w-56 h-12 flex items-center justify-center">
              <span className="text-xs italic text-slate-500 font-serif">Toldos Print — Administração</span>
            </div>
            <div className="w-64 border-t border-slate-800 mt-1" />
            <span className="text-xs font-black text-slate-900 mt-1 uppercase">
              {empresa?.nome || "TOLDOSPRINT"}
            </span>
            <span className="text-[10px] text-slate-500">Administração & Repasses</span>
          </div>

          {/* Assinatura do Colaborador (Física ou Digital) */}
          <div className="flex flex-col items-center justify-end text-center">
            {recibo.assinatura_digital ? (
              <div className="w-56 h-12 flex flex-col items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={recibo.assinatura_digital}
                  alt="Assinatura Digital"
                  className="max-h-12 object-contain"
                />
              </div>
            ) : (
              <div className="w-56 h-12 flex items-center justify-center">
                <span className="text-[10px] text-slate-400 italic">
                  (Assinatura com caneta)
                </span>
              </div>
            )}
            <div className="w-64 border-t border-slate-800 mt-1" />
            <span className="text-xs font-black text-slate-900 mt-1">
              {recibo.colaborador_nome}
            </span>
            <span className="text-[10px] text-slate-500">
              {recibo.assinado_em
                ? `Assinado digitalmente em ${formatarData(recibo.assinado_em)}`
                : "Assinatura do Colaborador"}
            </span>
          </div>
        </div>

        {/* Rodapé do Recibo */}
        <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
          <span>Autenticador ID: {recibo.id}</span>
          <span>Sistema Integrado Toldos Print • Via Única</span>
        </div>
      </div>

      {/* Modal para Assinatura na Tela (Canvas Touch/Mouse) */}
      <Dialog open={dialogAssinaturaAberto} onOpenChange={setDialogAssinaturaAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5 text-primary" />
              Assinatura na Tela
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2">
            <p className="text-xs text-muted-foreground">
              Peça para <strong>{recibo.colaborador_nome}</strong> assinar com o dedo ou mouse no quadro abaixo:
            </p>

            <div className="relative rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-1">
              <canvas
                ref={canvasRef}
                width={380}
                height={160}
                className="w-full h-40 touch-none cursor-crosshair bg-white rounded-lg"
                onMouseDown={iniciarDesenho}
                onMouseMove={desenhar}
                onMouseUp={pararDesenho}
                onMouseLeave={pararDesenho}
                onTouchStart={iniciarDesenho}
                onTouchMove={desenhar}
                onTouchEnd={pararDesenho}
              />
              {!temTraco && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400 italic">
                  Assine com o dedo ou mouse aqui...
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={limparCanvas}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <Eraser className="mr-1 h-3.5 w-3.5" /> Limpar
              </Button>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogAssinaturaAberto(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={salvarAssinaturaDigital}
              disabled={!temTraco || salvandoAssinatura}
              className="bg-primary text-primary-foreground font-bold"
            >
              {salvandoAssinatura ? "Salvando..." : "Confirmar e Gravar no Recibo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regras CSS de Impressão A4 */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .recibo-sheet {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
        }
      `}</style>
    </div>
  )
}
