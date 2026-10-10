"use client"

import { useState } from "react"
import { useData } from "@/context/data-context"
import { useVendedorAtivo } from "@/context/vendedor-ativo-context"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatarMoeda } from "@/lib/format"
import type { CategoriaProdutoRapido, ProdutoRapido } from "@/lib/types"
import { cn } from "@/lib/utils"
import { MessageCircle, Save, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

const categorias: CategoriaProdutoRapido[] = [
  "Adesivo",
  "Banner",
  "Camiseta",
  "Cartão de Visita",
  "Lona / Faixa",
  "Panfleto / Flyer",
  "Outro",
]

const acabamentosPadrao = ["Brilho", "Fosco"]

export default function NovoOrcamentoVendedorPage() {
  const { produtosRapidos } = useData()
  const [categoriaAtiva, setCategoriaAtiva] = useState<
    CategoriaProdutoRapido | "Todos"
  >("Todos")
  const [produtoSelecionado, setProdutoSelecionado] =
    useState<ProdutoRapido | null>(null)

  const produtosFiltrados =
    categoriaAtiva === "Todos"
      ? produtosRapidos
      : produtosRapidos.filter((p) => p.categoria === categoriaAtiva)

  if (produtoSelecionado) {
    return (
      <CotacaoVendedor
        produto={produtoSelecionado}
        onVoltar={() => setProdutoSelecionado(null)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Novo Orçamento</h1>
        <p className="text-sm text-muted-foreground">
          Escolha um produto do catálogo.
        </p>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <button
          onClick={() => setCategoriaAtiva("Todos")}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-xs",
            categoriaAtiva === "Todos"
              ? "border-primary bg-primary/15 font-medium text-foreground"
              : "border-border text-muted-foreground"
          )}
        >
          Todos
        </button>
        {categorias.map((c) => (
          <button
            key={c}
            onClick={() => setCategoriaAtiva(c)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs",
              categoriaAtiva === c
                ? "border-primary bg-primary/15 font-medium text-foreground"
                : "border-border text-muted-foreground"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {produtosFiltrados.map((produto) => {
          const menorPreco = Math.min(...produto.variantes.map((v) => v.preco))
          return (
            <Card
              key={produto.id}
              className="cursor-pointer active:border-primary"
              onClick={() => setProdutoSelecionado(produto)}
            >
              <CardContent className="flex flex-col gap-1">
                <p className="font-medium">{produto.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {produto.categoria} · Prazo: {produto.prazoDias}{" "}
                  {produto.prazoDias === 1 ? "dia" : "dias"}
                </p>
                <p className="text-sm font-medium text-primary">
                  a partir de {formatarMoeda(menorPreco)}
                </p>
              </CardContent>
            </Card>
          )
        })}
        {produtosFiltrados.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum produto nessa categoria ainda.
          </p>
        )}
      </div>
    </div>
  )
}

function CotacaoVendedor({
  produto,
  onVoltar,
}: {
  produto: ProdutoRapido
  onVoltar: () => void
}) {
  const { addPedidoRapido } = useData()
  const { vendedorId } = useVendedorAtivo()
  const [varianteId, setVarianteId] = useState(produto.variantes[0]?.id ?? "")
  const [acabamento, setAcabamento] = useState<string | null>(
    produto.temAcabamento ? acabamentosPadrao[0] : null
  )
  const [clienteNome, setClienteNome] = useState("")
  const [clienteTelefone, setClienteTelefone] = useState("")
  const [observacao, setObservacao] = useState("")

  const variante = produto.variantes.find((v) => v.id === varianteId)
  const total = variante?.preco ?? 0

  function mensagemWhatsapp() {
    const linhas = [
      `Orçamento — ${produto.nome}`,
      variante ? `Tamanho: ${variante.nome}` : null,
      acabamento ? `Acabamento: ${acabamento}` : null,
      observacao ? `Obs: ${observacao}` : null,
      `Total: ${formatarMoeda(total)}`,
    ].filter(Boolean)
    return linhas.join("\n")
  }

  function abrirWhatsapp() {
    const texto = encodeURIComponent(mensagemWhatsapp())
    const digitos = clienteTelefone.replace(/\D/g, "")
    const numero = digitos ? `55${digitos}` : ""
    window.open(`https://wa.me/${numero}?text=${texto}`, "_blank")
  }

  function salvarPedido(status: "aguardando" | "aprovado") {
    if (!variante) return
    addPedidoRapido({
      produtoId: produto.id,
      varianteId: variante.id,
      acabamento,
      clienteNome: clienteNome.trim(),
      clienteTelefone: clienteTelefone.trim(),
      observacao: observacao.trim(),
      total,
      status,
      vendedorId: vendedorId || undefined,
    })
    toast.success(
      status === "aprovado" ? "Pedido enviado pra produção" : "Orçamento salvo"
    )
    onVoltar()
  }

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" className="self-start" onClick={onVoltar}>
        ← Voltar ao catálogo
      </Button>

      <Card>
        <CardContent className="flex flex-col gap-1">
          <p className="text-lg font-semibold">{produto.nome}</p>
          <p className="text-sm text-muted-foreground">
            {produto.categoria} · Prazo: {produto.prazoDias}{" "}
            {produto.prazoDias === 1 ? "dia" : "dias"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div>
            <Label className="mb-2 block">Tamanho / quantidade</Label>
            <div className="flex flex-wrap gap-2">
              {produto.variantes.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVarianteId(v.id)}
                  className={cn(
                    "flex flex-col items-center rounded-md border px-3 py-2 text-sm",
                    varianteId === v.id
                      ? "border-primary bg-primary/15 font-medium"
                      : "border-border text-muted-foreground"
                  )}
                >
                  <span>{v.nome}</span>
                  <span className="text-xs">{formatarMoeda(v.preco)}</span>
                </button>
              ))}
            </div>
          </div>

          {produto.temAcabamento && (
            <div>
              <Label className="mb-2 block">Acabamento</Label>
              <div className="flex gap-2">
                {acabamentosPadrao.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAcabamento(a)}
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm",
                      acabamento === a
                        ? "border-primary bg-primary/15 font-medium"
                        : "border-border text-muted-foreground"
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm font-medium">Dados do cliente</p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="clienteNome">Cliente</Label>
            <Input
              id="clienteNome"
              placeholder="Nome do cliente"
              value={clienteNome}
              onChange={(e) => setClienteNome(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="clienteTelefone">Telefone / WhatsApp</Label>
            <Input
              id="clienteTelefone"
              placeholder="(11) 99999-9999"
              value={clienteTelefone}
              onChange={(e) => setClienteTelefone(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="observacao">Observação</Label>
            <Textarea
              id="observacao"
              placeholder="Ex: frente e verso, arte inclusa, urgente..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-2xl font-bold text-primary">
              {formatarMoeda(total)}
            </span>
          </div>
          <Button variant="outline" className="w-full" onClick={abrirWhatsapp}>
            <MessageCircle className="mr-2 h-4 w-4" />
            Enviar por WhatsApp
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => salvarPedido("aguardando")}
          >
            <Save className="mr-2 h-4 w-4" />
            Salvar como pendente
          </Button>
          <Button className="w-full" onClick={() => salvarPedido("aprovado")}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Fechar orçamento
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
