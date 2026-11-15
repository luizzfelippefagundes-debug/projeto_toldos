"use client"

import { useEffect, useRef, useState } from "react"
import { use } from "react"
import { formatarMoeda } from "@/lib/format"
import { Logo } from "@/components/brand/logo"

interface DadosOs {
  assinado: boolean
  assinadoEm: string | null
  orcamentoId?: string
  orcamentoNumero: number
  orcamentoCriadoEm: string
  clienteNome: string
  totalFechado: number | null
}

export default function AssinarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)

  const [dados, setDados] = useState<DadosOs | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [assinando, setAssinando] = useState(false)
  const [concluido, setConcluido] = useState(false)
  const [desenhando, setDesenhando] = useState(false)
  const [temAssinatura, setTemAssinatura] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ultimoPonto = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    fetch(`/api/assinar/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.erro) setErro(d.erro)
        else setDados(d)
      })
      .catch(() => setErro("Erro ao carregar documento"))
  }, [token])

  function getPos(e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ("touches" in e) {
      const t = e.touches[0]
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY }
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  function iniciarDesenho(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    setDesenhando(true)
    ultimoPonto.current = getPos(e, canvas)
  }

  function continuarDesenho(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault()
    if (!desenhando) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx || !ultimoPonto.current) return

    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(ultimoPonto.current.x, ultimoPonto.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = "#1a1a1a"
    ctx.lineWidth = 2.5
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.stroke()
    ultimoPonto.current = pos
    setTemAssinatura(true)
  }

  function encerrarDesenho() {
    setDesenhando(false)
    ultimoPonto.current = null
  }

  function limpar() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setTemAssinatura(false)
  }

  async function confirmarAssinatura() {
    const canvas = canvasRef.current
    if (!canvas || !temAssinatura) return
    setAssinando(true)

    const assinaturaData = canvas.toDataURL("image/png")

    const res = await fetch(`/api/assinar/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assinaturaData }),
    })

    const json = await res.json()
    if (json.ok) {
      setConcluido(true)
    } else {
      setErro(json.erro ?? "Erro ao salvar assinatura")
    }
    setAssinando(false)
  }

  if (erro) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full text-center">
          <div className="text-5xl mb-4">❌</div>
          <h1 className="text-xl font-semibold text-gray-800 mb-2">Link inválido</h1>
          <p className="text-gray-500">{erro}</p>
        </div>
      </div>
    )
  }

  if (!dados) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">Carregando...</div>
      </div>
    )
  }

  if (dados.assinado || concluido) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-white border-b px-4 py-3 flex items-center gap-3 shadow-2xs">
          <Logo className="w-28 py-1 px-2 rounded-md shrink-0 shadow-xs" />
          <div className="border-l border-gray-200 pl-3">
            <div className="font-bold text-gray-900 text-sm leading-tight">Toldos Print</div>
            <div className="text-[11px] text-gray-500 font-medium leading-tight">Assinatura Digital</div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Contrato e OS Assinados!</h1>
            <p className="text-gray-600 text-sm mb-6">
              {dados.assinado
                ? "Este documento já foi assinado digitalmente."
                : "Sua assinatura foi registrada com sucesso! A Toldos Print já foi notificada e seu pedido entrou em produção."}
            </p>
            <div className="flex flex-col gap-2.5">
              {dados.orcamentoId && (
                <a
                  href={`/api/orcamentos/${dados.orcamentoId}/contrato/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors shadow-xs"
                >
                  📑 Baixar Contrato de Serviços Assinado (PDF)
                </a>
              )}
              <a
                href={`/api/assinar/${token}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                📄 Baixar Ordem de Serviço Assinada (PDF)
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const ano = new Date(dados.orcamentoCriadoEm).getFullYear().toString().slice(-2)
  const num = String(dados.orcamentoNumero).padStart(4, "0")
  const nomeOs = `OS-${num}-${ano}`

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Cabeçalho com Logo Oficial */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 shadow-2xs">
        <Logo className="w-28 py-1 px-2 rounded-md shrink-0 shadow-xs" />
        <div className="border-l border-gray-200 pl-3">
          <div className="font-bold text-gray-900 text-sm leading-tight">Toldos Print</div>
          <div className="text-[11px] text-gray-500 font-medium leading-tight">Assinatura Digital</div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Info do documento */}
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Ordem de Serviço</div>
              <div className="text-lg font-bold text-gray-900">{nomeOs}</div>
              <div className="text-sm text-gray-600 mt-1">Cliente: <span className="font-medium">{dados.clienteNome}</span></div>
            </div>
            {dados.totalFechado != null && (
              <div className="text-right">
                <div className="text-xs text-gray-500 mb-1">Total</div>
                <div className="text-lg font-bold text-emerald-600">{formatarMoeda(dados.totalFechado)}</div>
              </div>
            )}
          </div>
        </div>

        {/* Instruções */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-800">
            📋 Leia o documento enviado pelo WhatsApp e, se concordar com os termos,
            assine abaixo com o dedo para confirmar a Ordem de Serviço.
          </p>
        </div>

        {/* Canvas de assinatura */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Sua assinatura</span>
            <button
              onClick={limpar}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Limpar
            </button>
          </div>
          <div className="relative bg-gray-50 mx-4 mb-4 rounded-lg border-2 border-dashed border-gray-200"
            style={{ touchAction: "none" }}
          >
            <canvas
              ref={canvasRef}
              width={600}
              height={200}
              className="w-full h-40 cursor-crosshair"
              onMouseDown={iniciarDesenho}
              onMouseMove={continuarDesenho}
              onMouseUp={encerrarDesenho}
              onMouseLeave={encerrarDesenho}
              onTouchStart={iniciarDesenho}
              onTouchMove={continuarDesenho}
              onTouchEnd={encerrarDesenho}
            />
            {!temAssinatura && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-gray-300 text-sm">✍️ Assine aqui</span>
              </div>
            )}
          </div>
        </div>

        {/* Botão confirmar */}
        <button
          onClick={confirmarAssinatura}
          disabled={!temAssinatura || assinando}
          className="w-full py-4 rounded-xl font-semibold text-white text-base transition-all"
          style={{
            backgroundColor: temAssinatura && !assinando ? "#059669" : "#d1d5db",
            cursor: temAssinatura && !assinando ? "pointer" : "not-allowed",
          }}
        >
          {assinando ? "Salvando..." : "✅ Confirmar assinatura"}
        </button>

        <p className="text-xs text-center text-gray-400 pb-4">
          Ao confirmar, você concorda com os termos da Ordem de Serviço e do Contrato de Prestação de Serviços.
          Sua assinatura e IP serão registrados digitalmente com data e hora.
        </p>
      </div>
    </div>
  )
}
