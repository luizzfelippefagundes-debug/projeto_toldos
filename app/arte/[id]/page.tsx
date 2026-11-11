"use client"

import { useEffect, useState } from "react"
import { use } from "react"
import { formatarMoeda, formatarData } from "@/lib/format"
import { CheckCircle2, AlertCircle, MessageCircle, ExternalLink, ZoomIn, ArrowRight } from "lucide-react"

interface DadosArte {
  tipo: "orcamento" | "pedido"
  id: string
  numero: number
  clienteNome: string
  clienteTelefone: string | null
  arteUrl: string | null
  arteAprovadaEm: string | null
  status: string
  descricao: string
  variante?: string | null
  total: number | null
  criadoEm: string
}

export default function AprovarArtePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [dados, setDados] = useState<DadosArte | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aprovando, setAprovando] = useState(false)
  const [concluido, setConcluido] = useState(false)
  const [zoomModal, setZoomModal] = useState(false)

  useEffect(() => {
    fetch(`/api/arte/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.erro) setErro(d.erro)
        else setDados(d)
      })
      .catch(() => setErro("Erro ao carregar dados da arte"))
  }, [id])

  async function confirmarAprovacao() {
    if (!dados) return
    setAprovando(true)
    try {
      const res = await fetch(`/api/arte/${id}/aprovar`, {
        method: "POST",
      })
      const json = await res.json()
      if (res.ok && json.sucesso) {
        setConcluido(true)
        setDados((d) => d ? { ...d, arteAprovadaEm: json.aprovadoEm, status: "impressao" } : null)
      } else {
        setErro(json.erro ?? "Erro ao aprovar arte")
      }
    } catch {
      setErro("Erro de conexão ao aprovar arte")
    } finally {
      setAprovando(false)
    }
  }

  if (erro) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full text-center bg-white p-6 rounded-2xl border shadow-sm">
          <div className="text-4xl mb-3">⚠️</div>
          <h1 className="text-lg font-bold text-gray-800 mb-1">Não foi possível carregar a arte</h1>
          <p className="text-sm text-gray-500 mb-4">{erro}</p>
          <a
            href="https://wa.me/5511999990000"
            className="inline-flex items-center gap-2 text-sm text-emerald-600 font-medium hover:underline"
          >
            <MessageCircle className="w-4 h-4" />
            Falar com o atendimento
          </a>
        </div>
      </div>
    )
  }

  if (!dados) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-2 text-gray-400 text-sm">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-emerald-600" />
          <span>Carregando arte...</span>
        </div>
      </div>
    )
  }

  const jaAprovado = !!dados.arteAprovadaEm || concluido
  const numeroFormatado = String(dados.numero).padStart(4, "0")
  const tituloPedido = dados.tipo === "orcamento" ? `Orçamento #${numeroFormatado}` : `Pedido #${numeroFormatado}`

  const linkWhatsappAjuste = `https://wa.me/5511999990000?text=${encodeURIComponent(
    `Olá! Estou visualizando a arte do ${tituloPedido} (${dados.clienteNome}) e gostaria de solicitar um ajuste:`
  )}`

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Cabeçalho */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-zinc-900 rounded-lg flex items-center justify-center shadow-xs">
            <span className="text-white text-xs font-black tracking-wider">TP</span>
          </div>
          <div>
            <div className="font-bold text-gray-900 text-sm leading-none">Toldos Print</div>
            <div className="text-[11px] text-gray-500 mt-0.5">Aprovação de Arte</div>
          </div>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-700">
          {tituloPedido}
        </span>
      </header>

      <main className="max-w-xl mx-auto p-4 space-y-4">
        {/* Card de Identificação */}
        <div className="bg-white rounded-2xl border p-4 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Cliente</p>
              <h2 className="text-lg font-bold text-gray-900">{dados.clienteNome}</h2>
              <p className="text-xs text-gray-600 mt-0.5 font-medium">
                {dados.descricao} {dados.variante ? `— ${dados.variante}` : ""}
              </p>
            </div>
            {dados.total != null && (
              <div className="text-right shrink-0">
                <span className="text-xs text-gray-400 block font-medium">Valor Total</span>
                <span className="text-base font-extrabold text-emerald-600">
                  {formatarMoeda(dados.total)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Banner de Status */}
        {jaAprovado ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 shadow-xs flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-emerald-900">Arte Aprovada!</h3>
              <p className="text-xs text-emerald-800 mt-0.5">
                Esta arte foi aprovada para produção e já foi encaminhada para a impressão.
                {dados.arteAprovadaEm && (
                  <span className="block mt-1 text-[11px] text-emerald-700">
                    Aprovado em: {formatarData(dados.arteAprovadaEm)}
                  </span>
                )}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-xs flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <strong className="font-semibold block mb-0.5">Atenção aos detalhes:</strong>
              Revise atentamente ortografia, telefones, medidas e cores antes de aprovar. Após a aprovação, o material entra diretamente em produção.
            </div>
          </div>
        )}

        {/* Visualização da Arte */}
        <div className="bg-white rounded-2xl border shadow-xs overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between bg-zinc-50/50">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
              Pré-visualização da Arte
            </span>
            {dados.arteUrl && (
              <button
                onClick={() => setZoomModal(true)}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-semibold"
              >
                <ZoomIn className="w-3.5 h-3.5" />
                Ampliar
              </button>
            )}
          </div>

          <div className="p-4 bg-zinc-100/60 flex items-center justify-center min-h-[260px]">
            {dados.arteUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={dados.arteUrl}
                alt="Arte para aprovação"
                onClick={() => setZoomModal(true)}
                className="max-h-[380px] w-auto max-w-full rounded-lg shadow-sm border border-zinc-200 cursor-zoom-in object-contain bg-white transition-transform hover:scale-[1.01]"
              />
            ) : (
              <div className="text-center p-8 text-gray-400">
                <p className="text-sm font-medium">Nenhuma arte anexada ainda.</p>
                <p className="text-xs mt-1">Aguardando a equipe de criação anexar o arquivo final.</p>
              </div>
            )}
          </div>

          {dados.arteUrl && (
            <div className="p-3 border-t bg-white flex justify-end">
              <a
                href={dados.arteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-900 font-medium"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir arquivo original em nova aba
              </a>
            </div>
          )}
        </div>

        {/* Ações de Aprovação ou Ajuste */}
        {!jaAprovado && (
          <div className="bg-white rounded-2xl border p-4 shadow-xs space-y-3">
            <button
              onClick={confirmarAprovacao}
              disabled={aprovando || !dados.arteUrl}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-sm shadow-md transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {aprovando ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Registrando aprovação...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Aprovar Arte e Iniciar Produção
                  <ArrowRight className="w-4 h-4 ml-1 opacity-80" />
                </>
              )}
            </button>

            <a
              href={linkWhatsappAjuste}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-semibold text-xs transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              Preciso de alterações / Falar com o Designer
            </a>
          </div>
        )}

        {/* Modal de Zoom */}
        {zoomModal && dados.arteUrl && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs"
            onClick={() => setZoomModal(false)}
          >
            <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={dados.arteUrl}
                alt="Arte ampliada"
                className="max-h-[85vh] max-w-full rounded-lg shadow-2xl object-contain"
              />
              <button
                onClick={() => setZoomModal(false)}
                className="mt-3 px-4 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-semibold backdrop-blur-md transition-colors"
              >
                Fechar visualização
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
