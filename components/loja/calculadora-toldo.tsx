"use client"

import React, { useState } from "react"
import { Calculator, MessageCircle, Ruler, Sparkles, Check } from "lucide-react"

export function CalculadoraToldo() {
  const [tipo, setTipo] = useState<"cortina" | "fixo" | "policarbonato">("cortina")
  const [largura, setLargura] = useState("3.00")
  const [altura, setAltura] = useState("2.20")

  const largNum = Math.max(0.5, parseFloat(largura.replace(",", ".")) || 0)
  const altNum = Math.max(0.5, parseFloat(altura.replace(",", ".")) || 0)
  const m2 = Math.round(largNum * altNum * 100) / 100

  // Preços estimados de mercado para simulação rápida
  const precoM2 = tipo === "cortina" ? 140 : tipo === "fixo" ? 160 : 270
  const valorEstimado = Math.round(m2 * precoM2)

  const tiposInfo = {
    cortina: {
      nome: "Toldo Cortina Retrátil (Enrolável)",
      desc: "Lona reforçada Sansuy com visor transparente opcional e manivela ou mola.",
    },
    fixo: {
      nome: "Toldo Fixo Tradicional",
      desc: "Estrutura tubular galvanizada soldada com acabamento em lona premium.",
    },
    policarbonato: {
      nome: "Cobertura de Policarbonato",
      desc: "Chapas alveolares com proteção UV e estrutura metálica resistente.",
    },
  }

  const linkWhatsApp = `https://wa.me/5527997489714?text=${encodeURIComponent(
    `Olá! Fiz uma simulação no site da Toldos Print:\n\n` +
      `• Modelo: ${tiposInfo[tipo].nome}\n` +
      `• Medidas: ${largNum.toFixed(2)}m (largura) × ${altNum.toFixed(2)}m (altura) = ${m2} m²\n` +
      `• Estimativa: R$ ${valorEstimado.toLocaleString("pt-BR")},00\n\n` +
      `Gostaria de confirmar os detalhes e agendar a visita técnica/orçamento!`
  )}`

  return (
    <section id="calculadora" className="py-12 px-4 sm:px-6 bg-slate-900 text-white rounded-3xl my-8 max-w-7xl mx-auto shadow-2xl">
      <div className="max-w-4xl mx-auto">
        <div className="text-center space-y-2 mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold border border-amber-400/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Simulador Online Grátis</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black">
            Quanto custa o seu Toldo ou Cobertura?
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm max-w-lg mx-auto">
            Selecione o modelo e digite as medidas aproximadas para ter uma estimativa imediata na hora.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-slate-800/80 p-5 sm:p-8 rounded-2xl border border-slate-700">
          {/* Seletor de Modelo */}
          <div className="md:col-span-7 space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                1. Escolha o Modelo
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(["cortina", "fixo", "policarbonato"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipo(t)}
                    className={`p-3 rounded-xl text-left border text-xs font-bold transition-all cursor-pointer ${
                      tipo === t
                        ? "bg-amber-400 text-slate-950 border-amber-400 shadow-md"
                        : "bg-slate-900/60 text-slate-300 border-slate-700 hover:border-slate-500"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span>{t === "cortina" ? "Cortina" : t === "fixo" ? "Fixo" : "Policarbonato"}</span>
                      {tipo === t && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <span className="text-[10px] block font-normal opacity-80 leading-tight">
                      {t === "cortina" ? "Retrátil / Enrolar" : t === "fixo" ? "Para portas/janelas" : "Transparente"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Medidas */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                2. Medidas Aproximadas (Metros)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                    Largura (Frente)
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="20"
                      value={largura}
                      onChange={(e) => setLargura(e.target.value)}
                      className="w-full bg-transparent text-lg font-black text-white focus:outline-none"
                    />
                    <span className="text-xs font-bold text-slate-400">metros</span>
                  </div>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                    Altura (Caimento)
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="10"
                      value={altura}
                      onChange={(e) => setAltura(e.target.value)}
                      className="w-full bg-transparent text-lg font-black text-white focus:outline-none"
                    />
                    <span className="text-xs font-bold text-slate-400">metros</span>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-400 italic">
              {tiposInfo[tipo].desc}
            </p>
          </div>

          {/* Resultado / Envio */}
          <div className="md:col-span-5 bg-gradient-to-br from-slate-900 to-[#00265c] p-6 rounded-2xl border border-amber-400/20 flex flex-col justify-between space-y-4">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Área Total Calculada
              </span>
              <div className="text-2xl font-black text-white mt-0.5">
                {m2} m²
              </div>

              <div className="mt-4 pt-4 border-t border-slate-700">
                <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
                  Valor Estimado
                </span>
                <div className="text-3xl sm:text-4xl font-black text-amber-400 mt-1">
                  R$ {valorEstimado.toLocaleString("pt-BR")},00
                </div>
                <span className="text-[11px] text-slate-400 block mt-1">
                  *Podendo variar conforme ferragens, pintura e local de instalação.
                </span>
              </div>
            </div>

            <a
              href={linkWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40 transition-all hover:scale-[1.02]"
            >
              <MessageCircle className="w-5 h-5" />
              <span>Enviar Medidas no WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
