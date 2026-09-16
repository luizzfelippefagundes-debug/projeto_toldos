"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useData } from "@/context/data-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ClienteQuickAddDialog } from "@/components/orcamento/cliente-quick-add-dialog"
import { Stepper, type StepperStep } from "@/components/orcamento/stepper"
import { calcularOrcamentoCompleto } from "@/lib/calculo"
import { formatarData, formatarMoeda } from "@/lib/format"
import { acabamentosSeed, equipamentosAcessoSeed } from "@/lib/seed-data"
import { toast } from "sonner"
import { Upload, FileCheck2, Printer, ArrowLeft, ArrowRight } from "lucide-react"

const passos: StepperStep[] = [
  { numero: 1, titulo: "Cliente" },
  { numero: 2, titulo: "Produto" },
  { numero: 3, titulo: "Acabamentos" },
  { numero: 4, titulo: "Instalação" },
  { numero: 5, titulo: "Preço" },
  { numero: 6, titulo: "Finalizar" },
]

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

  const [passoAtual, setPassoAtual] = useState(1)

  const [clienteId, setClienteId] = useState("")
  const [materialId, setMaterialId] = useState("")
  const [servicoId, setServicoId] = useState("")
  const [largura, setLargura] = useState("")
  const [altura, setAltura] = useState("")
  const [quantidadeUnidades, setQuantidadeUnidades] = useState("1")
  const [horasEstimadas, setHorasEstimadas] = useState("")
  const [ajusteManual, setAjusteManual] = useState("0")
  const [arquivo, setArquivo] = useState<File | null>(null)

  const [acabamentosAtivos, setAcabamentosAtivos] = useState<
    Record<string, boolean>
  >({})
  const [acabamentosQtd, setAcabamentosQtd] = useState<Record<string, string>>(
    {}
  )

  const [instalacaoIncluida, setInstalacaoIncluida] = useState(false)
  const [horasInstalacao, setHorasInstalacao] = useState("")
  const [custoHoraInstalacao, setCustoHoraInstalacao] = useState("")
  const [numAjudantes, setNumAjudantes] = useState("0")
  const [diariaAjudante, setDiariaAjudante] = useState("")
  const [equipamentoId, setEquipamentoId] = useState(equipamentosAcessoSeed[0].id)

  const [deslocamentoIncluido, setDeslocamentoIncluido] = useState(false)
  const [distanciaKm, setDistanciaKm] = useState("")
  const [custoPorKm, setCustoPorKm] = useState("")
  const [pedagio, setPedagio] = useState("")
  const [alimentacao, setAlimentacao] = useState("")

  const [margemPercent, setMargemPercent] = useState("0")
  const [descontoPercent, setDescontoPercent] = useState("0")
  const [impostoPercent, setImpostoPercent] = useState("6")
  const [validadeDias, setValidadeDias] = useState("7")

  // "Válido até" depende de "hoje" (new Date()) — mesmo cuidado do Dashboard
  // e da Produção: calcular isso direto no render travaria a data numa
  // pré-renderização estática. Começa nulo e só calcula depois de montar.
  const [agora, setAgora] = useState<Date | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAgora(new Date())
  }, [])
  const validoAte = agora
    ? new Date(agora.getTime() + (Number(validadeDias) || 7) * 24 * 60 * 60 * 1000)
    : null

  // `rascunho` vem da tela de Histórico (Duplicar) e só existe uma vez, no
  // momento em que esta página monta — mesmo caso já aceito para o
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
  const equipamento = equipamentosAcessoSeed.find((e) => e.id === equipamentoId)

  const item = useMemo(
    () => ({
      materialId,
      servicoId,
      largura: Number(largura) || 0,
      altura: Number(altura) || 0,
      quantidadeUnidades: Number(quantidadeUnidades) || 0,
      horasEstimadas: Number(horasEstimadas) || 0,
      acabamentos: acabamentosSeed
        .filter((a) => acabamentosAtivos[a.id] && Number(acabamentosQtd[a.id]) > 0)
        .map((a) => ({
          acabamentoId: a.id,
          quantidade: Number(acabamentosQtd[a.id]) || 0,
        })),
      instalacao: {
        incluida: instalacaoIncluida,
        horas: Number(horasInstalacao) || 0,
        custoHora: Number(custoHoraInstalacao) || 0,
        numAjudantes: Number(numAjudantes) || 0,
        diariaAjudante: Number(diariaAjudante) || 0,
        equipamentoId,
      },
      deslocamento: {
        incluido: deslocamentoIncluido,
        distanciaKm: Number(distanciaKm) || 0,
        custoPorKm: Number(custoPorKm) || 0,
        pedagio: Number(pedagio) || 0,
        alimentacao: Number(alimentacao) || 0,
      },
      margemPercent: Number(margemPercent) || 0,
      descontoPercent: Number(descontoPercent) || 0,
      impostoPercent: Number(impostoPercent) || 0,
    }),
    [
      materialId,
      servicoId,
      largura,
      altura,
      quantidadeUnidades,
      horasEstimadas,
      acabamentosAtivos,
      acabamentosQtd,
      instalacaoIncluida,
      horasInstalacao,
      custoHoraInstalacao,
      numAjudantes,
      diariaAjudante,
      equipamentoId,
      deslocamentoIncluido,
      distanciaKm,
      custoPorKm,
      pedagio,
      alimentacao,
      margemPercent,
      descontoPercent,
      impostoPercent,
    ]
  )

  const resultado =
    material && servico
      ? calcularOrcamentoCompleto(
          item,
          material,
          servico,
          Number(ajusteManual) || 0,
          acabamentosSeed,
          equipamentosAcessoSeed
        )
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

  function irPara(passo: number) {
    setPassoAtual(Math.min(Math.max(passo, 1), passos.length))
  }

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
      validadeDias: Number(validadeDias) || 7,
    })
    toast.success(`Orçamento fechado para ${cliente.nome}`)
    router.push("/orcamentos")
  }

  function toggleAcabamento(id: string, ativo: boolean) {
    setAcabamentosAtivos((atual) => ({ ...atual, [id]: ativo }))
  }

  function setQtdAcabamento(id: string, valor: string) {
    setAcabamentosQtd((atual) => ({ ...atual, [id]: valor }))
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <h1 className="text-2xl font-semibold">Novo Orçamento</h1>
        <p className="text-sm text-muted-foreground">
          Preencha os passos abaixo — o valor é calculado automaticamente.
        </p>
      </div>

      <Card className="print:hidden">
        <CardContent className="pt-6">
          <Stepper passos={passos} atual={passoAtual} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2 print:hidden">
          {passoAtual === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Etapa 1 de 6 — Cliente
                </CardTitle>
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
          )}

          {passoAtual === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Etapa 2 de 6 — Produto e medidas
                </CardTitle>
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
              </CardContent>
            </Card>
          )}

          {passoAtual === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Etapa 3 de 6 — Acabamentos
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {acabamentosSeed.map((acabamento) => (
                  <div
                    key={acabamento.id}
                    className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <div className="min-w-32 flex-1">
                      <p className="text-sm font-medium">{acabamento.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatarMoeda(acabamento.precoUnitario)} /{" "}
                        {acabamento.unidade}
                      </p>
                    </div>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Qtd."
                      className="w-24"
                      value={acabamentosQtd[acabamento.id] ?? ""}
                      onChange={(e) =>
                        setQtdAcabamento(acabamento.id, e.target.value)
                      }
                      disabled={!acabamentosAtivos[acabamento.id]}
                    />
                    <Switch
                      checked={Boolean(acabamentosAtivos[acabamento.id])}
                      onCheckedChange={(v) => toggleAcabamento(acabamento.id, v)}
                    />
                  </div>
                ))}
                {resultado && (
                  <div className="flex justify-between border-t border-border pt-3 text-sm">
                    <span className="text-muted-foreground">
                      Subtotal acabamentos
                    </span>
                    <span className="font-medium">
                      {formatarMoeda(resultado.subtotalAcabamentos)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {passoAtual === 4 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Etapa 4 de 6 — Instalação e logística
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        Serviço de instalação
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Mão de obra + ajudantes
                      </p>
                    </div>
                    <Switch
                      checked={instalacaoIncluida}
                      onCheckedChange={setInstalacaoIncluida}
                    />
                  </div>
                  {instalacaoIncluida && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="horasInstalacao">
                          Horas de instalação
                        </Label>
                        <Input
                          id="horasInstalacao"
                          type="number"
                          min="0"
                          value={horasInstalacao}
                          onChange={(e) => setHorasInstalacao(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="custoHoraInstalacao">
                          Custo por hora (R$)
                        </Label>
                        <Input
                          id="custoHoraInstalacao"
                          type="number"
                          min="0"
                          value={custoHoraInstalacao}
                          onChange={(e) =>
                            setCustoHoraInstalacao(e.target.value)
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="numAjudantes">Nº de ajudantes</Label>
                        <Input
                          id="numAjudantes"
                          type="number"
                          min="0"
                          value={numAjudantes}
                          onChange={(e) => setNumAjudantes(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="diariaAjudante">
                          Diária por ajudante (R$)
                        </Label>
                        <Input
                          id="diariaAjudante"
                          type="number"
                          min="0"
                          value={diariaAjudante}
                          onChange={(e) => setDiariaAjudante(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="flex flex-col gap-2">
                  <Label>Equipamento de acesso</Label>
                  <Select
                    value={equipamentoId}
                    onValueChange={(v) => setEquipamentoId(v ?? equipamentoId)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {equipamentosAcessoSeed.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.nome}
                          {e.precoDiaria > 0
                            ? ` — ${formatarMoeda(e.precoDiaria)}/dia`
                            : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        Deslocamento e logística
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Transporte, pedágio, alimentação
                      </p>
                    </div>
                    <Switch
                      checked={deslocamentoIncluido}
                      onCheckedChange={setDeslocamentoIncluido}
                    />
                  </div>
                  {deslocamentoIncluido && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="distanciaKm">
                          Distância (km ida+volta)
                        </Label>
                        <Input
                          id="distanciaKm"
                          type="number"
                          min="0"
                          value={distanciaKm}
                          onChange={(e) => setDistanciaKm(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="custoPorKm">Custo por km (R$)</Label>
                        <Input
                          id="custoPorKm"
                          type="number"
                          min="0"
                          step="0.1"
                          value={custoPorKm}
                          onChange={(e) => setCustoPorKm(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="pedagio">Pedágio (R$)</Label>
                        <Input
                          id="pedagio"
                          type="number"
                          min="0"
                          value={pedagio}
                          onChange={(e) => setPedagio(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="alimentacao">Alimentação (R$)</Label>
                        <Input
                          id="alimentacao"
                          type="number"
                          min="0"
                          value={alimentacao}
                          onChange={(e) => setAlimentacao(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {resultado && (
                  <div className="flex justify-between border-t border-border pt-3 text-sm font-medium">
                    <span>Total instalação + logística</span>
                    <span>
                      {formatarMoeda(
                        resultado.subtotalInstalacao +
                          resultado.subtotalDeslocamento
                      )}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {passoAtual === 5 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Etapa 5 de 6 — Precificação
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="margem">Margem (%)</Label>
                    <Input
                      id="margem"
                      type="number"
                      min="0"
                      value={margemPercent}
                      onChange={(e) => setMargemPercent(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="desconto">Desconto (%)</Label>
                    <Input
                      id="desconto"
                      type="number"
                      min="0"
                      max="100"
                      value={descontoPercent}
                      onChange={(e) => setDescontoPercent(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="ajuste">Ajuste manual (R$)</Label>
                    <Input
                      id="ajuste"
                      type="number"
                      step="0.01"
                      value={ajusteManual}
                      onChange={(e) => setAjusteManual(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label>Imposto</Label>
                    <Select
                      value={impostoPercent}
                      onValueChange={(v) => setImpostoPercent(v ?? impostoPercent)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="6">6%</SelectItem>
                        <SelectItem value="7">7%</SelectItem>
                        <SelectItem value="8">8%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="validade">Validade do orçamento (dias)</Label>
                    <Input
                      id="validade"
                      type="number"
                      min="1"
                      value={validadeDias}
                      onChange={(e) => setValidadeDias(e.target.value)}
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Margem e desconto são aplicados sobre o custo total (material
                  + mão de obra + acabamentos + instalação + logística), o
                  imposto sobre esse valor já com desconto, e o ajuste manual
                  em R$ entra por cima, no final. Depois de {validadeDias || 7}{" "}
                  dias esse orçamento é considerado vencido.
                </p>

                {resultado && (
                  <div className="flex flex-col gap-2 rounded-md border border-border p-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Custo base
                      </span>
                      <span>{formatarMoeda(resultado.custoBase)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Com margem ({margemPercent || 0}%)
                      </span>
                      <span>{formatarMoeda(resultado.comMargem)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Com desconto ({descontoPercent || 0}%)
                      </span>
                      <span>{formatarMoeda(resultado.comDesconto)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Imposto ({impostoPercent || 0}%)
                      </span>
                      <span>{formatarMoeda(resultado.valorImposto)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-base font-semibold">
                      <span>Total</span>
                      <span>{formatarMoeda(resultado.total)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {passoAtual === 6 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Etapa 6 de 6 — Foto ou vídeo do local
                </CardTitle>
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
          )}

          <div className="flex justify-between print:hidden">
            <Button
              variant="outline"
              onClick={() => irPara(passoAtual - 1)}
              disabled={passoAtual === 1}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Anterior
            </Button>
            {passoAtual < passos.length && (
              <Button onClick={() => irPara(passoAtual + 1)}>
                Próximo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <Card className="lg:sticky lg:top-6">
            <CardHeader>
              <CardTitle className="text-base">Resumo do orçamento</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="hidden print:block">
                <p className="font-semibold">Orçamento — Toldos Print</p>
                <p>Cliente: {cliente?.nome ?? "—"}</p>
                <p>Material: {material?.nome ?? "—"}</p>
                <p>Serviço: {servico?.nome ?? "—"}</p>
                <p>Equipamento de acesso: {equipamento?.nome ?? "—"}</p>
                <p>
                  Válido até:{" "}
                  {validoAte ? formatarData(validoAte.toISOString()) : "—"}
                </p>
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
                  {resultado
                    ? formatarMoeda(resultado.subtotalMaoDeObra)
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Acabamentos</span>
                <span>
                  {resultado
                    ? formatarMoeda(resultado.subtotalAcabamentos)
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Instalação</span>
                <span>
                  {resultado
                    ? formatarMoeda(resultado.subtotalInstalacao)
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Deslocamento</span>
                <span>
                  {resultado
                    ? formatarMoeda(resultado.subtotalDeslocamento)
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Imposto ({impostoPercent || 0}%)
                </span>
                <span>
                  {resultado ? formatarMoeda(resultado.valorImposto) : "—"}
                </span>
              </div>

              <Separator />

              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span>
                  {resultado ? formatarMoeda(resultado.total) : formatarMoeda(0)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground print:hidden">
                <span>Válido até</span>
                <span>
                  {validoAte ? formatarData(validoAte.toISOString()) : "—"}
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
