import React from "react"
import { ShieldCheck, Sparkles, Phone, Calculator, ArrowDown, Award, CheckCircle2 } from "lucide-react"

export function HeroBanner() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#00265c] via-[#003882] to-[#00183b] text-white py-12 md:py-20 px-4 sm:px-6">
      {/* Detalhe de fundo com brilho sutil */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="flex flex-col items-center text-center max-w-3xl mx-auto space-y-6">
          {/* Badge de Tradição */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-yellow-300 text-xs sm:text-sm font-bold shadow-inner">
            <Award className="w-4 h-4 text-yellow-400" />
            <span>São 35 Anos de Histórias e Qualidade Comprovada</span>
          </div>

          {/* Título Principal */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.1]">
            Toldos, Coberturas e{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-400">
              Comunicação Visual
            </span>
          </h1>

          {/* Descrição */}
          <p className="text-base sm:text-lg text-slate-200 font-normal leading-relaxed max-w-2xl">
            Tudo o que você precisa para dar <strong>máxima visibilidade, proteção contra sol/chuva e elegância</strong> para sua empresa, residência ou evento.
          </p>

          {/* Destaques / Benefícios rápidos */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs sm:text-sm font-semibold text-slate-200">
            <div className="flex items-center justify-center gap-1.5 bg-white/5 py-2 px-3 rounded-lg border border-white/10">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Fabricação Própria</span>
            </div>
            <div className="flex items-center justify-center gap-1.5 bg-white/5 py-2 px-3 rounded-lg border border-white/10">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Instalação Especializada</span>
            </div>
            <div className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 bg-white/5 py-2 px-3 rounded-lg border border-white/10">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Pagamento Facilitado</span>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 w-full sm:w-auto">
            <a
              href="#calculadora"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm sm:text-base shadow-lg shadow-amber-400/20 transition-all hover:scale-[1.02] cursor-pointer"
            >
              <Calculator className="w-5 h-5 text-slate-900" />
              <span>Simular Preço do Toldo</span>
            </a>

            <a
              href="#catalogo"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-sm sm:text-base transition-colors"
            >
              <ArrowDown className="w-4 h-4" />
              <span>Ver Produtos & Materiais</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
