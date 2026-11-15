"use client"

import React from "react"
import Image from "next/image"
import Link from "next/link"
import { ShoppingCart, MessageCircle, Phone, MapPin, ShieldCheck, Award } from "lucide-react"
import { useCarrinho } from "@/context/carrinho-context"

export function Cabecalho() {
  const { totalItens, setCarrinhoAberto } = useCarrinho()

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      {/* Barra de Aviso Superior */}
      <div className="bg-[#003882] text-white text-xs py-1.5 px-4 font-medium">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-yellow-400" />
              <strong className="text-yellow-300">35 Anos de Tradição</strong> em Toldos & Comunicação
            </span>
            <span className="hidden md:inline text-slate-300">•</span>
            <span className="hidden md:flex items-center gap-1 text-slate-200">
              <MapPin className="w-3.5 h-3.5 text-yellow-400" />
              Águia Branca - ES e Região
            </span>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://wa.me/5527997489714"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-yellow-300 transition-colors flex items-center gap-1 text-xs"
            >
              <Phone className="w-3 h-3 text-emerald-400" />
              (27) 99748-9714
            </a>
          </div>
        </div>
      </div>

      {/* Barra Principal de Navegação */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Logomarca */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative w-10 h-10 sm:w-12 sm:h-12 shrink-0">
            <Image
              src="/brand/logo-simbolo.png"
              alt="Toldos Print"
              fill
              className="object-contain group-hover:scale-105 transition-transform"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-lg sm:text-2xl font-black tracking-tight text-[#003882] leading-none">
              TOLDOS<span className="text-amber-500">PRINT</span>
            </span>
            <span className="text-[10px] sm:text-xs font-semibold text-slate-500 tracking-wider uppercase">
              Toldos & Comunicação Visual
            </span>
          </div>
        </Link>

        {/* Links rápidos para desktop */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-semibold text-slate-700">
          <a href="#toldos-coberturas" className="hover:text-[#003882] transition-colors">
            Toldos & Coberturas
          </a>
          <a href="#fachadas-letras" className="hover:text-[#003882] transition-colors">
            Fachadas & Letras 3D
          </a>
          <a href="#comunicacao-visual" className="hover:text-[#003882] transition-colors">
            Comunicação Visual
          </a>
          <a href="#materiais" className="hover:text-[#003882] transition-colors">
            Loja de Materiais
          </a>
        </nav>

        {/* Botões de Ação */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Botão WhatsApp */}
          <a
            href="https://wa.me/5527997489714?text=Ol%C3%A1!%20Acessei%20o%20site%20da%20Toldos%20Print%20e%20gostaria%20de%20um%20or%C3%A7amento."
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Chamar no WhatsApp</span>
          </a>

          {/* Botão Carrinho */}
          <button
            onClick={() => setCarrinhoAberto(true)}
            className="relative flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
            aria-label="Abrir carrinho"
          >
            <ShoppingCart className="w-5 h-5 text-[#003882]" />
            <span className="hidden sm:inline">Pedido</span>
            {totalItens > 0 && (
              <span className="bg-amber-500 text-white font-extrabold text-[11px] w-5 h-5 rounded-full flex items-center justify-center -ml-1">
                {totalItens}
              </span>
            )}
          </button>

          {/* Botão Acessar Sistema */}
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#003882] hover:bg-[#00265c] text-white font-bold text-xs sm:text-sm shadow-xs transition-colors"
          >
            <span>Acessar Sistema</span>
          </Link>
        </div>
      </div>
    </header>
  )
}
