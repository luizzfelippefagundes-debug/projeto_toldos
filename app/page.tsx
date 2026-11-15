"use client"

import React, { useState } from "react"
import { Cabecalho } from "@/components/loja/cabecalho"
import { HeroBanner } from "@/components/loja/hero-banner"
import { CalculadoraToldo } from "@/components/loja/calculadora-toldo"
import { CardProduto } from "@/components/loja/card-produto"
import { CarrinhoDrawer } from "@/components/loja/carrinho-drawer"
import { Rodape } from "@/components/loja/rodape"
import { CATEGORIAS, PRODUTOS } from "@/lib/produtos"
import { CarrinhoProvider } from "@/context/carrinho-context"
import { MessageCircle, Search, Sparkles, ShieldCheck, Clock, Wrench } from "lucide-react"

export default function HomePage() {
  const [categoriaAtiva, setCategoriaAtiva] = useState("todos")
  const [busca, setBusca] = useState("")

  const produtosFiltrados = PRODUTOS.filter((p) => {
    const bateCategoria =
      categoriaAtiva === "todos" || p.categoria === categoriaAtiva
    const bateBusca =
      !busca ||
      p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      p.subtitulo.toLowerCase().includes(busca.toLowerCase()) ||
      p.descricao.toLowerCase().includes(busca.toLowerCase())
    return bateCategoria && bateBusca
  })

  return (
    <CarrinhoProvider>
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        <Cabecalho />
        <HeroBanner />

        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 w-full py-8 space-y-12">
          {/* Simulador Interativo de Toldos */}
          <CalculadoraToldo />

          {/* Seção Catálogo e E-commerce */}
          <section id="catalogo" className="space-y-6 pt-4">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#003882]/10 text-[#003882] text-xs font-bold mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Catálogo Completo & E-commerce</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                  Nossos Produtos & Serviços
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  Compre materiais e gráfica rápida online ou peça um orçamento sob medida.
                </p>
              </div>

              {/* Barra de Busca */}
              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar produto, lona, toldo..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-[#003882] shadow-xs"
                />
              </div>
            </div>

            {/* Abas de Categorias */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {CATEGORIAS.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoriaAtiva(cat.id)}
                  className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    categoriaAtiva === cat.id
                      ? "bg-[#003882] text-white shadow-md shadow-blue-900/20 scale-[1.02]"
                      : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  {cat.nome}
                </button>
              ))}
            </div>

            {/* Grid de Produtos */}
            {produtosFiltrados.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 space-y-2">
                <p className="font-bold text-slate-700">Nenhum produto encontrado</p>
                <p className="text-xs text-slate-500">Tente buscar por outro termo ou categoria.</p>
                <button
                  onClick={() => {
                    setCategoriaAtiva("todos")
                    setBusca("")
                  }}
                  className="mt-2 text-xs font-bold text-[#003882] underline cursor-pointer"
                >
                  Limpar filtros
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {produtosFiltrados.map((produto) => (
                  <div key={produto.id} id={produto.categoria}>
                    <CardProduto produto={produto} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Faixa de Diferenciais */}
          <section className="bg-gradient-to-br from-blue-900 to-[#00265c] text-white rounded-3xl p-8 sm:p-12 shadow-xl my-12">
            <div className="text-center max-w-2xl mx-auto space-y-3 mb-8">
              <h3 className="text-2xl sm:text-3xl font-black">
                Por que escolher a Toldos Print?
              </h3>
              <p className="text-xs sm:text-sm text-slate-300">
                Mais de três décadas fabricando e entregando soluções duráveis com responsabilidade.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white/10 p-5 rounded-2xl border border-white/10 text-center space-y-2">
                <div className="w-12 h-12 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center mx-auto font-black text-lg">
                  35+
                </div>
                <h4 className="font-bold text-sm text-white">Anos de Experiência</h4>
                <p className="text-xs text-slate-300">
                  Pioneirismo em comunicação e toldos em Águia Branca e região.
                </p>
              </div>

              <div className="bg-white/10 p-5 rounded-2xl border border-white/10 text-center space-y-2">
                <div className="w-12 h-12 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-sm text-white">Garantia e Qualidade</h4>
                <p className="text-xs text-slate-300">
                  Lonas de alta densidade e estruturas metálicas antiferrugem.
                </p>
              </div>

              <div className="bg-white/10 p-5 rounded-2xl border border-white/10 text-center space-y-2">
                <div className="w-12 h-12 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center mx-auto">
                  <Wrench className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-sm text-white">Instalação Própria</h4>
                <p className="text-xs text-slate-300">
                  Equipe técnica especializada que cuida de tudo do início ao fim.
                </p>
              </div>

              <div className="bg-white/10 p-5 rounded-2xl border border-white/10 text-center space-y-2">
                <div className="w-12 h-12 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center mx-auto">
                  <Clock className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-sm text-white">Agilidade na Entrega</h4>
                <p className="text-xs text-slate-300">
                  Prazos rigorosamente cumpridos com comunicação direta via WhatsApp.
                </p>
              </div>
            </div>
          </section>
        </main>

        {/* Botão Flutuante do WhatsApp */}
        <a
          href="https://wa.me/5527997489714?text=Ol%C3%A1!%20Acessei%20o%20site%20da%20Toldos%20Print%20e%20gostaria%20de%20tirar%20uma%20d%C3%BAvida."
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-5 right-5 z-40 bg-emerald-500 hover:bg-emerald-600 text-white p-3.5 sm:p-4 rounded-full shadow-2xl flex items-center gap-2 hover:scale-110 transition-all cursor-pointer group"
          aria-label="Atendimento WhatsApp"
        >
          <MessageCircle className="w-6 h-6 fill-current" />
          <span className="hidden sm:inline-block font-bold text-xs pr-1">
            Falar no WhatsApp
          </span>
        </a>

        <CarrinhoDrawer />
        <Rodape />
      </div>
    </CarrinhoProvider>
  )
}
