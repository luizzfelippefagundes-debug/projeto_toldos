"use client"

import React, { useState } from "react"
import Image from "next/image"
import { MessageCircle, ShoppingCart, Check, Sparkles, Ruler } from "lucide-react"
import { Produto } from "@/lib/produtos"
import { useCarrinho } from "@/context/carrinho-context"

export function CardProduto({ produto }: { produto: Produto }) {
  const { adicionarItem } = useCarrinho()
  const [variacaoSelecionada, setVariacaoSelecionada] = useState(
    produto.opcoesTamanho ? produto.opcoesTamanho[0] : null
  )
  const [adicionadoFeedback, setAdicionadoFeedback] = useState(false)

  const precoAtual = variacaoSelecionada ? variacaoSelecionada.preco : produto.precoBase || 0

  const handleAdicionar = () => {
    adicionarItem({
      produtoId: produto.id,
      nome: produto.nome,
      variacao: variacaoSelecionada?.nome,
      precoUnitario: precoAtual,
      quantidade: 1,
      imagem: produto.imagem,
    })
    setAdicionadoFeedback(true)
    setTimeout(() => setAdicionadoFeedback(false), 2000)
  }

  const linkWhatsApp = `https://wa.me/5527997489714?text=${encodeURIComponent(
    `Olá! Tenho interesse no seguinte produto do site da Toldos Print:\n\n` +
      `• *${produto.nome}*\n` +
      (variacaoSelecionada ? `• Opção: ${variacaoSelecionada.nome} (R$ ${precoAtual},00)\n` : "") +
      `• Categoria: ${produto.categoriaNome}\n\n` +
      `Gostaria de mais informações e como finalizar!`
  )}`

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between group">
      <div>
        {/* Imagem do Produto */}
        <div className="relative w-full h-48 bg-slate-100 overflow-hidden">
          <Image
            src={produto.imagem}
            alt={produto.nome}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
          {produto.destaque && (
            <span className="absolute top-2.5 left-2.5 bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md shadow-xs">
              Destaque
            </span>
          )}
          <span className="absolute bottom-2.5 left-2.5 bg-slate-900/80 backdrop-blur-md text-white font-medium text-[10px] px-2 py-0.5 rounded-md">
            {produto.categoriaNome}
          </span>
        </div>

        {/* Informações */}
        <div className="p-4 sm:p-5 space-y-2.5">
          <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
            {produto.nome}
          </h3>
          <p className="text-xs font-semibold text-amber-600">
            {produto.subtitulo}
          </p>
          <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
            {produto.descricao}
          </p>

          {/* Variações de tamanho/kit se houver */}
          {produto.opcoesTamanho && (
            <div className="pt-2">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Escolha a opção:
              </label>
              <select
                value={variacaoSelecionada?.nome}
                onChange={(e) => {
                  const achado = produto.opcoesTamanho?.find(
                    (opt) => opt.nome === e.target.value
                  )
                  if (achado) setVariacaoSelecionada(achado)
                }}
                className="w-full text-xs font-semibold p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#003882]"
              >
                {produto.opcoesTamanho.map((opt) => (
                  <option key={opt.nome} value={opt.nome}>
                    {opt.nome} — R$ {opt.preco},00
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Preço e Botões de Ação */}
      <div className="p-4 sm:p-5 pt-0 border-t border-slate-100 mt-2 space-y-3">
        {produto.tipo === "sob-medida" ? (
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">
                Fabricação
              </span>
              <p className="text-sm font-black text-[#003882]">Sob Medida</p>
            </div>

            <a
              href={linkWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Pedir Orçamento</span>
            </a>
          </div>
        ) : (
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-xs text-slate-500 font-medium">A partir de</span>
              <span className="text-xl font-black text-slate-900">
                R$ {precoAtual.toLocaleString("pt-BR")},00
                {produto.unidadePreco && (
                  <span className="text-[11px] font-normal text-slate-500 ml-1">
                    /{produto.unidadePreco}
                  </span>
                )}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleAdicionar}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  adicionadoFeedback
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-900"
                }`}
              >
                {adicionadoFeedback ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Adicionado!</span>
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-3.5 h-3.5 text-[#003882]" />
                    <span>Adicionar</span>
                  </>
                )}
              </button>

              <a
                href={linkWhatsApp}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1 py-2.5 px-2 rounded-xl bg-[#003882] hover:bg-[#00265c] text-white font-bold text-xs transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5 text-yellow-300" />
                <span>Comprar</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
