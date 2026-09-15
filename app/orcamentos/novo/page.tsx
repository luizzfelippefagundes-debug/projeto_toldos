"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useData } from "@/context/data-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ClienteQuickAddDialog } from "@/components/orcamento/cliente-quick-add-dialog"
import { calcularOrcamento } from "@/lib/calculo"
import { formatarMoeda } from "@/lib/format"
import { toast } from "sonner"
import { Upload, FileCheck2, Printer } from "lucide-react"

export default function NovoOrcamentoPage() {
  const {
    clientes,
    materiais,
    servicos,
    rascunho,
    consumirRascunho,
    fecharOrcamento,
  } = useData()
  const router = useRouter()

  const [clienteId, setClienteId] = useState("")
  const [materialId, setMaterialId] = useState("")
  const [servicoId, setServicoId] = useState("")
  const [largura, setLargura] = useState("")
  const [altura, setAltura] = useState("")
  const [quantidadeUnidades, setQuantidadeUnidades] = useState("1")
  const [horasEstimadas, setHorasEstimadas] = useState("")
  const [ajusteManual, setAjusteManual] = useState("0")
  const [arquivo, setArquivo] = useState<File | null>(null)

  // `rascunho` é um sinal vindo de outra tela (Histórico > Duplicar), que
  // navega pra cá e deixa um rascunho pronto no contexto. Diferente do reset
  // de formulário em material-form-dialog.tsx (que é resetar state local a
  // partir de uma prop, resolvido com `key`), aqui é sincronizar com uma
  // fonte de dados externa a este componente que só existe uma vez, no
  // momento em que a página monta — o mesmo tipo de caso já aceito para o
  // localStorage (context/data-context.tsx) e o relógio (dashboard/page.tsx).
  useEffect(() => {
    if (!rascunho) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClienteId(rascunho.clienteId)
    setMaterialId(rascunho.item.materialId)
    setServicoId(rascunho.item.servicoId)
    setLargura(rascunho.item.largura ? String(rascunho.item.largura) : "")
    setAltura(rascunho.item.altura ? String(rascunho.item.altura) : "")
    setQuantidadeUnidades(String(rascunho.item.quantidadeUnidades || 1))
    setHorasEstimadas(
      rascunho.item.horasEstimadas ? String(rascunho.item.horasEstimadas) : ""
    )
    setAjusteManual(String(rascunho.ajusteManual))
    consumirRascunho()
  }, [rascunho, consumirRascunho])

  const material = materiais.find((m) => m.id === materialId)
  const servico = servicos.find((s) => s.id === servicoId)
  const cliente = clientes.find((c) => c.id === clienteId)

  const item = useMemo(
    () => ({
      materialId,
      servicoId,
      largura: Number(largura) || 0,
      altura: Number(altura) || 0,
      quantidadeUnidades: Number(quantidadeUnidades) || 0,
      horasEstimadas: Number(horasEstimadas) || 0,
    }),
    [materialId, servicoId, largura, altura, quantidadeUnidades, horasEstimadas]
  )

  const resultado =
    material && servico
      ? calcularOrcamento(item, material, servico, Number(ajusteManual) || 0)
      : null

  const medidasValidas = material
    ? material.unidade === "m2"
      ? item.largura > 0 && item.altura > 0
      : item.quantidadeUnidades > 0
    : false

  const podeFechar =
    Boolean(cliente) &&
    Boolean(material) &&
    Boolean(servico) &&
    medidasValidas &&
    Boolean(arquivo)

  function handleGerarPdf() {
    if (!cliente || !material || !servico) {
      toast.error("Selecione cliente, material e serviço antes de gerar o PDF")
      return
    }
    window.print()
  }

  function handleFechar() {
    if (!podeFechar || !cliente || !material || !servico || !arquivo) return
    fecharOrcamento({
      clienteId: cliente.id,
      item,
      ajusteManual: Number(ajusteManual) || 0,
      anexoNome: arquivo.name,
    })
    toast.success(`Orçamento fechado para ${cliente.nome}`)
    router.push("/orcamentos")
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <h1 className="text-2xl font-semibold">Novo Orçamento</h1>
        <p className="text-sm text-muted-foreground">
          Escolha o cliente, o produto e as medidas — o valor é calculado
          automaticamente.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2 print:hidden">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cliente</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-4">
              <div className="flex min-w-56 flex-col gap-2">
                <Label>Cliente</Label>
                <Select
                  value={clienteId}
                  onValueChange={(v) => setClienteId(v ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ClienteQuickAddDialog onCriado={(c) => setClienteId(c.id)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Produto e medidas</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Material</Label>
                  <Select
                    value={materialId}
                    onValueChange={(v) => setMaterialId(v ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o material" />
                    </SelectTrigger>
                    <SelectContent>
                      {materiais.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Serviço</Label>
                  <Select
                    value={servicoId}
                    onValueChange={(v) => setServicoId(v ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      {servicos.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {material?.unidade === "m2" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="largura">Largura (m)</Label>
                    <Input
                      id="largura"
                      type="number"
                      min="0"
                      step="0.01"
                      value={largura}
                      onChange={(e) => setLargura(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="altura">Altura (m)</Label>
                    <Input
                      id="altura"
                      type="number"
                      min="0"
                      step="0.01"
                      value={altura}
                      onChange={(e) => setAltura(e.target.value)}
                    />
                  </div>
                </div>
              ) : material ? (
                <div className="flex flex-col gap-2 sm:w-48">
                  <Label htmlFor="quantidade">Quantidade</Label>
                  <Input
                    id="quantidade"
                    type="number"
                    min="0"
                    value={quantidadeUnidades}
                    onChange={(e) => setQuantidadeUnidades(e.target.value)}
                  />
                </div>
              ) : null}

              {servico?.formaCobranca === "hora" && (
                <div className="flex flex-col gap-2 sm:w-48">
                  <Label htmlFor="horas">Horas estimadas</Label>
                  <Input
                    id="horas"
                    type="number"
                    min="0"
                    step="0.5"
                    value={horasEstimadas}
                    onChange={(e) => setHorasEstimadas(e.target.value)}
                  />
                </div>
              )}

              <div className="flex flex-col gap-2 sm:w-48">
                <Label htmlFor="ajuste">Ajuste manual (R$)</Label>
                <Input
                  id="ajuste"
                  type="number"
                  step="0.01"
                  value={ajusteManual}
                  onChange={(e) => setAjusteManual(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">
                  Negativo para desconto, positivo para acréscimo.
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Foto ou vídeo do local</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <label
                htmlFor="anexo"
                className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-border py-8 text-center hover:bg-accent"
              >
                {arquivo ? (
                  <>
                    <FileCheck2 className="h-6 w-6 text-primary" />
                    <span className="text-sm">{arquivo.name}</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Clique para anexar uma foto ou vídeo
                    </span>
                  </>
                )}
              </label>
              <input
                id="anexo"
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                Obrigatório para fechar o orçamento.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="lg:sticky lg:top-6">
            <CardHeader>
              <CardTitle className="text-base">Resumo do orçamento</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="hidden print:block">
                <p className="font-semibold">Orçamento — ToldoSys</p>
                <p>Cliente: {cliente?.nome ?? "—"}</p>
                <p>Material: {material?.nome ?? "—"}</p>
                <p>Serviço: {servico?.nome ?? "—"}</p>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Área</span>
                <span>
                  {resultado ? `${resultado.areaM2.toFixed(2)} m²` : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Material</span>
                <span>
                  {resultado ? formatarMoeda(resultado.subtotalMaterial) : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mão de obra</span>
                <span>
                  {resultado ? formatarMoeda(resultado.subtotalMaoDeObra) : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ajuste</span>
                <span>{formatarMoeda(Number(ajusteManual) || 0)}</span>
              </div>

              <Separator />

              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span>
                  {resultado ? formatarMoeda(resultado.total) : formatarMoeda(0)}
                </span>
              </div>

              <div className="flex flex-col gap-2 pt-4 print:hidden">
                <Button variant="outline" onClick={handleGerarPdf}>
                  <Printer className="mr-2 h-4 w-4" />
                  Gerar PDF
                </Button>
                <Button disabled={!podeFechar} onClick={handleFechar}>
                  Fechar Orçamento
                </Button>
                {!arquivo && (
                  <p className="text-center text-xs text-muted-foreground">
                    Anexe uma foto ou vídeo para liberar o fechamento.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
