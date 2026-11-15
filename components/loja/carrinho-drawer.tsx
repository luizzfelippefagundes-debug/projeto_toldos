"use client"

import React, { useState } from "react"
import Image from "next/image"
import { X, Trash2, Plus, Minus, ShoppingBag, MessageCircle, ArrowRight, MapPin } from "lucide-react"
import { useCarrinho } from "@/context/carrinho-context"

export function CarrinhoDrawer() {
  const {
    itens,
    carrinhoAberto,
    setCarrinhoAberto,
    removerItem,
    atualizarQuantidade,
    valorTotal,
    limparCarrinho,
  } = useCarrinho()

  const [nomeCliente, setNomeCliente] = useState("")
  const [opcaoEntrega, setOpcaoEntrega] = useState<"retirada" | "entrega">("retirada")

  if (!carrinhoAberto) return null

  const finalizarPedido = () => {
    const itensTexto = itens
      .map(
        (i) =>
          `• ${i.quantidade}x *${i.nome}*${i.variacao ? ` (${i.variacao})` : ""} — R$ ${(
            i.precoUnitario * i.quantidade
          ).toLocaleString("pt-BR")},00`
      )
      .join("\n")

    const mensagem =
      `Olá! Gostaria de finalizar meu pedido no site da Toldos Print:\n\n` +
      `*DADOS DO CLIENTE:*\n` +
      `• Nome: ${nomeCliente || "Cliente do Site"}\n` +
      `• Entrega: ${
        opcaoEntrega === "retirada"
          ? "Retirar na Fábrica (Águia Branca - ES)"
          : "Entrega / Envio a combinar"
      }\n\n` +
      `*ITENS DO PEDIDO:*\n${itensTexto}\n\n` +
      `*VALOR TOTAL:* R$ ${valorTotal.toLocaleString("pt-BR")},00\n\n` +
      `Como posso fazer o pagamento via Pix para confirmar a produção/separação?`

    window.open(`https://wa.me/5527997489714?text=${encodeURIComponent(mensagem)}`, "_blank")
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        onClick={() => setCarrinhoAberto(false)}
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
      />

      {/* Drawer */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-right duration-300">
        {/* Topo */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#003882]" />
            <h2 className="font-black text-lg text-slate-900">Seu Pedido</h2>
            <span className="text-xs bg-slate-100 font-bold px-2 py-0.5 rounded-full text-slate-600">
              {itens.length} {itens.length === 1 ? "item" : "itens"}
            </span>
          </div>

          <button
            onClick={() => setCarrinhoAberto(false)}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lista de Itens */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {itens.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12 text-slate-400 space-y-3">
              <ShoppingBag className="w-12 h-12 stroke-1" />
              <p className="text-sm font-semibold text-slate-600">Seu carrinho está vazio</p>
              <p className="text-xs max-w-xs">
                Explore nosso catálogo e adicione materiais, banners, lonas ou rótulos ao seu pedido.
              </p>
              <button
                onClick={() => setCarrinhoAberto(false)}
                className="mt-2 text-xs font-bold text-[#003882] underline cursor-pointer"
              >
                Voltar para os produtos
              </button>
            </div>
          ) : (
            itens.map((item) => (
              <div
                key={item.id}
                className="flex gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200"
              >
                <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-slate-200 shrink-0">
                  <Image
                    src={item.imagem}
                    alt={item.nome}
                    fill
                    className="object-cover"
                  />
                </div>

                <div className="flex-1 flex flex-col justify-between">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 leading-tight">
                        {item.nome}
                      </h4>
                      {item.variacao && (
                        <p className="text-[11px] text-amber-600 font-semibold mt-0.5">
                          {item.variacao}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => removerItem(item.id)}
                      className="text-slate-400 hover:text-red-500 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex justify-between items-center mt-2">
                    <span className="font-black text-sm text-slate-900">
                      R$ {(item.precoUnitario * item.quantidade).toLocaleString("pt-BR")},00
                    </span>

                    <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-1.5 py-0.5">
                      <button
                        onClick={() => atualizarQuantidade(item.id, item.quantidade - 1)}
                        className="text-slate-500 hover:text-slate-900 p-0.5"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold w-5 text-center">
                        {item.quantidade}
                      </span>
                      <button
                        onClick={() => atualizarQuantidade(item.id, item.quantidade + 1)}
                        className="text-slate-500 hover:text-slate-900 p-0.5"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Rodapé do Carrinho com Checkout */}
        {itens.length > 0 && (
          <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 space-y-3">
            {/* Dados do Cliente */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Seu Nome (opcional):
              </label>
              <input
                type="text"
                placeholder="Ex: João da Silva"
                value={nomeCliente}
                onChange={(e) => setNomeCliente(e.target.value)}
                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#003882]"
              />
            </div>

            {/* Opção de Retirada / Entrega */}
            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setOpcaoEntrega("retirada")}
                className={`p-2 rounded-lg border text-left cursor-pointer ${
                  opcaoEntrega === "retirada"
                    ? "bg-[#003882] text-white border-[#003882]"
                    : "bg-white text-slate-700 border-slate-300"
                }`}
              >
                <span>Retirar na Fábrica</span>
                <span className="text-[10px] block opacity-80 font-normal">
                  Águia Branca (Grátis)
                </span>
              </button>

              <button
                type="button"
                onClick={() => setOpcaoEntrega("entrega")}
                className={`p-2 rounded-lg border text-left cursor-pointer ${
                  opcaoEntrega === "entrega"
                    ? "bg-[#003882] text-white border-[#003882]"
                    : "bg-white text-slate-700 border-slate-300"
                }`}
              >
                <span>Entrega / Envio</span>
                <span className="text-[10px] block opacity-80 font-normal">
                  A combinar
                </span>
              </button>
            </div>

            {/* Total */}
            <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
              <span className="text-sm font-bold text-slate-600">Total do Pedido:</span>
              <span className="text-2xl font-black text-[#003882]">
                R$ {valorTotal.toLocaleString("pt-BR")},00
              </span>
            </div>

            {/* Botão Finalizar */}
            <button
              onClick={finalizarPedido}
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 transition-all cursor-pointer hover:scale-[1.01]"
            >
              <MessageCircle className="w-5 h-5 text-white" />
              <span>Finalizar Pedido no WhatsApp</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
