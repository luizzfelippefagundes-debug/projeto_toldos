"use client"

import { useState, useRef, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { useData } from "@/context/data-context"
import type { FormaPagamento, LancamentoFinanceiro, TipoLancamento } from "@/lib/types"
import { isPositiveNumberInput } from "@/lib/number"
import { formatarDataInput, interpretarDataLocal } from "@/lib/date"
import { datasMensais, nomeDaParcela } from "@/lib/parcelas"
import { formatarMoeda } from "@/lib/format"
import { Switch } from "@/components/ui/switch"
import { Plus, Copy, Check, Sparkles, Camera, Loader2, ScanLine } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  apenasDigitos,
  formatarLinhaDigitavel,
  interpretarBoleto,
  obterIdentificacaoBoleto,
} from "@/lib/boleto"

function hojeISO() {
  return formatarDataInput(new Date())
}

function normalizarDataParaInput(valor?: string | null): string {
  if (!valor) return hojeISO()
  // Se tem YYYY-MM-DD no início, extrai diretamente os dígitos sem passar por new Date
  const mIso = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor)
  if (mIso) return `${mIso[1]}-${mIso[2]}-${mIso[3]}`
  // Se veio em formato brasileiro DD/MM/YYYY ou DD-MM-YYYY
  const mBr = /^(\d{2})[/-](\d{2})[/-](\d{4})/.exec(valor)
  if (mBr) return `${mBr[3]}-${mBr[2]}-${mBr[1]}`
  return formatarDataInput(interpretarDataLocal(valor))
}

const formasPagamento: { value: FormaPagamento; label: string }[] = [
  { value: "boleto", label: "Boleto" },
  { value: "pix", label: "Pix" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao", label: "Cartão" },
  { value: "transferencia", label: "Transferência" },
]

interface InicialLancamento {
  descricao?: string
  categoria?: string
  valor?: number
  vencimento?: string
  formaPagamento?: string
  numeroBoleto?: string
  despesaFixa?: boolean
  observacoes?: string
  pixCopiaECola?: string
}

export function LancamentoFormDialog({
  lancamento,
  trigger,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  avisos,
  inicial,
}: {
  lancamento?: LancamentoFinanceiro
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  avisos?: string[]
  inicial?: InicialLancamento
}) {
  const [abertoInterno, setAbertoInterno] = useState(false)
  const aberto = openProp !== undefined ? openProp : abertoInterno
  const setAberto = onOpenChangeProp ?? setAbertoInterno

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      {trigger ? (
        <span style={{ display: "contents" }} onClick={() => setAberto(true)}>
          {trigger}
        </span>
      ) : (
        <DialogTrigger render={<Button className="w-full sm:w-auto font-bold gap-2" />}>
          <Plus className="mr-2 h-4 w-4" />
          Novo lançamento
        </DialogTrigger>
      )}
      <DialogContent className="w-[95vw] sm:max-w-lg max-h-[92vh] flex flex-col p-0 overflow-hidden shadow-2xl rounded-2xl border-border/80">
        <LancamentoFormFields
          key={aberto ? "aberto" : "fechado"}
          lancamento={lancamento}
          onFechar={() => setAberto(false)}
          avisos={avisos}
          inicial={inicial}
        />
      </DialogContent>
    </Dialog>
  )
}

function LancamentoFormFields({
  lancamento,
  onFechar,
  avisos,
  inicial,
}: {
  lancamento?: LancamentoFinanceiro
  onFechar: () => void
  avisos?: string[]
  inicial?: InicialLancamento
}) {
  const { addLancamento, updateLancamento, clientes } = useData()

  const [tipo, setTipo] = useState<TipoLancamento>(lancamento?.tipo ?? "despesa")
  const [descricao, setDescricao] = useState(lancamento?.descricao ?? inicial?.descricao ?? "")
  const [categoria, setCategoria] = useState(lancamento?.categoria ?? inicial?.categoria ?? "")
  const [valor, setValor] = useState(
    lancamento
      ? Number(lancamento.valor).toFixed(2)
      : inicial?.valor != null
      ? Number(inicial.valor).toFixed(2)
      : ""
  )
  const [vencimento, setVencimento] = useState(
    lancamento
      ? normalizarDataParaInput(lancamento.vencimento)
      : inicial?.vencimento
      ? normalizarDataParaInput(inicial.vencimento)
      : hojeISO()
  )
  const [clienteId, setClienteId] = useState<string>(lancamento?.clienteId ?? "nenhum")
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento | "nenhuma">(
    lancamento?.formaPagamento ?? (inicial?.formaPagamento as FormaPagamento | undefined) ?? "nenhuma"
  )
  const [numeroBoleto, setNumeroBoleto] = useState(lancamento?.numeroBoleto ?? inicial?.numeroBoleto ?? "")
  const [escanandoCodigo, setEscanandoCodigo] = useState(false)
  const inputScanCamera = useRef<HTMLInputElement>(null)
  const [pessoal, setPessoal] = useState(lancamento?.pessoal ?? false)
  const [despesaFixa, setDespesaFixa] = useState(lancamento?.despesaFixa ?? inicial?.despesaFixa ?? false)
  const [meses, setMeses] = useState("1")
  const [jaPagas, setJaPagas] = useState("0")
  const [copiado, setCopiado] = useState(false)
  const [observacoes, setObservacoes] = useState(
    lancamento?.observacoes ?? inicial?.observacoes ?? ""
  )
  const [pixCopiaECola, setPixCopiaECola] = useState(
    lancamento?.pixCopiaECola ?? inicial?.pixCopiaECola ?? ""
  )
  const [pixCopiado, setPixCopiado] = useState(false)

  const infoBoleto = useMemo(() => {
    if (!numeroBoleto) return null
    const d = interpretarBoleto(numeroBoleto)
    if (d && d.valido) {
      return { decod: d, nome: obterIdentificacaoBoleto(d) }
    }
    return null
  }, [numeroBoleto])

  function handleNumeroBoletoChange(texto: string) {
    setNumeroBoleto(texto)
    const limpo = apenasDigitos(texto)
    if (limpo.length === 44 || limpo.length === 47 || limpo.length === 48) {
      const decod = interpretarBoleto(limpo)
      if (decod && decod.valido) {
        setNumeroBoleto(formatarLinhaDigitavel(decod.linhaDigitavel))
        setFormaPagamento("boleto")
        if (decod.valor != null && (!valor || valor === "" || Number(valor) === 0)) {
          setValor(decod.valor.toFixed(2))
        }
        if (decod.vencimento && (!vencimento || vencimento === hojeISO())) {
          setVencimento(decod.vencimento)
        }
        const bancoInfo = obterIdentificacaoBoleto(decod)
        toast.success(`${bancoInfo} reconhecido! Dados preenchidos.`)
      }
    }
  }

  async function escanearCodigoBarrasDireto(arquivo?: File) {
    if (!arquivo) return
    setEscanandoCodigo(true)
    try {
      const form = new FormData()
      form.append("file", arquivo)
      form.append("modo", "codigo_barras")
      const res = await fetch("/api/boleto/ler", { method: "POST", body: form })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.campos) {
        toast.error(json?.erro ?? "Não foi possível ler o código. Aproxime a câmera e tente novamente.")
        return
      }
      const c = json.campos
      setFormaPagamento("boleto")
      if (c.numeroBoleto) {
        setNumeroBoleto(c.numeroBoleto)
      }
      if (c.valor != null && Number(c.valor) > 0) {
        setValor(Number(c.valor).toFixed(2))
      }
      if (c.vencimento) {
        setVencimento(normalizarDataParaInput(c.vencimento))
      }
      if (c.beneficiario && !descricao) {
        setDescricao(`Boleto — ${c.beneficiario}`)
      }
      if (c.pixCopiaECola && !pixCopiaECola) {
        setPixCopiaECola(c.pixCopiaECola)
      }
      if (c.observacoes && !observacoes) {
        setObservacoes(c.observacoes)
      }
      toast.success("Código de barras lido com sucesso!")
    } catch {
      toast.error("Erro ao enviar imagem. Verifique a conexão.")
    } finally {
      setEscanandoCodigo(false)
    }
  }

  const quantidadeMeses = Number(meses)
  const mesesValidos =
    Boolean(lancamento) ||
    (Number.isInteger(quantidadeMeses) && quantidadeMeses >= 1 && quantidadeMeses <= 60)
  const repetir = !lancamento && mesesValidos && quantidadeMeses > 1
  const datasRepeticao = repetir ? datasMensais(vencimento, quantidadeMeses) : []
  const quantidadeJaPagas = Number(jaPagas)
  const jaPagasValidas =
    !repetir ||
    (Number.isInteger(quantidadeJaPagas) && quantidadeJaPagas >= 0 && quantidadeJaPagas <= quantidadeMeses)

  const valido =
    descricao.trim().length > 0 &&
    categoria.trim().length > 0 &&
    isPositiveNumberInput(valor) &&
    Boolean(vencimento) &&
    Number.isFinite(new Date(`${vencimento}T00:00:00`).getTime()) &&
    mesesValidos &&
    jaPagasValidas

  function copiarCodigo() {
    if (!numeroBoleto) return
    const limpo = numeroBoleto.replace(/\D/g, "")
    navigator.clipboard.writeText(limpo)
    setCopiado(true)
    toast.success("Código de barras copiado!")
    setTimeout(() => setCopiado(false), 2000)
  }

  function copiarPix() {
    if (!pixCopiaECola) return
    navigator.clipboard.writeText(pixCopiaECola.trim())
    setPixCopiado(true)
    toast.success("Código Pix Copia e Cola copiado!")
    setTimeout(() => setPixCopiado(false), 2000)
  }

  function salvar() {
    const dados = {
      descricao: descricao.trim(),
      tipo,
      categoria: categoria.trim(),
      valor: Number(valor),
      vencimento: new Date(`${vencimento}T00:00:00`).toISOString(),
      status: lancamento?.status ?? ("pendente" as const),
      pagoEm: lancamento?.pagoEm,
      origem: lancamento?.origem ?? ("manual" as const),
      origemId: lancamento?.origemId ?? null,
      clienteId: clienteId !== "nenhum" ? clienteId : undefined,
      formaPagamento: formaPagamento !== "nenhuma" ? formaPagamento : undefined,
      numeroBoleto:
        formaPagamento === "boleto" && numeroBoleto.trim() && !repetir
          ? numeroBoleto.trim()
          : undefined,
      parcela: lancamento?.parcela,
      pessoal: tipo === "despesa" && pessoal ? true : undefined,
      despesaFixa: tipo === "despesa" && despesaFixa ? true : undefined,
      observacoes: observacoes.trim() || undefined,
      pixCopiaECola: pixCopiaECola.trim() || undefined,
    }
    if (lancamento) {
      updateLancamento(lancamento.id, dados)
    } else if (repetir) {
      datasRepeticao.forEach((data, i) =>
        addLancamento({
          ...dados,
          descricao: nomeDaParcela(dados.descricao, i, datasRepeticao.length),
          vencimento: new Date(`${data}T00:00:00`).toISOString(),
          ...(i < quantidadeJaPagas
            ? { status: "pago" as const, pagoEm: new Date(`${data}T12:00:00`).toISOString() }
            : {}),
        })
      )
    } else {
      addLancamento(dados)
    }
    onFechar()
  }

  return (
    <>
      {/* CABEÇALHO FIXO */}
      <div className="p-4 sm:p-5 pb-3 border-b border-border/80 shrink-0 bg-card">
        <DialogTitle className="text-lg font-black tracking-tight text-foreground">
          {lancamento ? "Editar lançamento" : "Novo lançamento"}
        </DialogTitle>
        {inicial && (
          <div className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary">
            <Check className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="font-medium">
              Dados lidos do boleto. Confira os campos antes de confirmar.
            </span>
          </div>
        )}
      </div>

      {/* CORPO ROLÁVEL TOTALMENTE RESPONSIVO */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {avisos && avisos.length > 0 && (
          <div className="flex flex-col gap-1 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-800 dark:text-amber-200">
            {avisos.map((a, i) => (
              <p key={i} className="font-medium">
                {a}
              </p>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold text-foreground">Tipo</Label>
          <Select
            value={tipo}
            onValueChange={(v) => setTipo((v as TipoLancamento) ?? tipo)}
          >
            <SelectTrigger className="h-11 sm:h-10 text-base sm:text-sm">
              <SelectValue>
                {(v: TipoLancamento) =>
                  v === "despesa" ? "Despesa (a pagar)" : "Receita (a receber)"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="despesa">Despesa (a pagar)</SelectItem>
              <SelectItem value="receita">Receita (a receber)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="descricao" className="text-xs font-semibold text-foreground">
            Descrição
          </Label>
          <Input
            id="descricao"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: EDP Espírito Santo, Aluguel, Compra de Alumínio..."
            className="h-11 sm:h-10 text-base sm:text-sm font-medium"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="categoria" className="text-xs font-semibold text-foreground">
              Categoria
            </Label>
            <Input
              id="categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Ex: Energia Elétrica, Fornecedor..."
              className="h-11 sm:h-10 text-base sm:text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="valor" className="text-xs font-semibold text-foreground">
                Valor (R$)
              </Label>
              {valor && isPositiveNumberInput(valor) && (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {formatarMoeda(Number(valor))}
                </span>
              )}
            </div>
            <Input
              id="valor"
              type="number"
              min="0"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              onBlur={() => {
                if (valor && !isNaN(Number(valor)) && Number(valor) > 0) {
                  setValor(Number(valor).toFixed(2))
                }
              }}
              placeholder="0,00"
              className="h-11 sm:h-10 text-base sm:text-sm font-black text-emerald-600 dark:text-emerald-400"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vencimento" className="text-xs font-semibold text-foreground">
            Vencimento
          </Label>
          <Input
            id="vencimento"
            type="date"
            value={vencimento}
            onChange={(e) => setVencimento(e.target.value)}
            className="h-11 sm:h-10 text-base sm:text-sm"
          />
        </div>

        {/* Campo de Código de Barras / Boleto */}
        {!repetir && (formaPagamento === "boleto" || Boolean(numeroBoleto) || tipo === "despesa") && (
          <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-muted/40 border border-border">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label htmlFor="numeroBoleto" className="text-xs font-bold text-foreground">
                Código de Barras / Linha Digitável
              </Label>
              {numeroBoleto && (
                <span
                  className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-md",
                    numeroBoleto.replace(/\D/g, "").length === 47
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300"
                      : numeroBoleto.replace(/\D/g, "").length === 48
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300"
                  )}
                >
                  {numeroBoleto.replace(/\D/g, "").length === 47
                    ? "47 dígitos (Boleto)"
                    : numeroBoleto.replace(/\D/g, "").length === 48
                    ? "48 dígitos (Concessionária)"
                    : `${numeroBoleto.replace(/\D/g, "").length} dígitos`}
                </span>
              )}
            </div>

            <div className="flex gap-2 items-center">
              <Input
                id="numeroBoleto"
                value={numeroBoleto}
                onChange={(e) => handleNumeroBoletoChange(e.target.value)}
                placeholder="Cole os números ou escaneie o código"
                className="h-11 sm:h-10 font-mono text-xs sm:text-sm flex-1"
              />
              <Button
                type="button"
                variant="outline"
                disabled={escanandoCodigo}
                onClick={() => inputScanCamera.current?.click()}
                className="h-11 sm:h-10 px-3 font-bold gap-1.5 text-xs shrink-0 border-primary/40 text-primary hover:bg-primary/10 cursor-pointer active:scale-95"
              >
                {escanandoCodigo ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Lendo...</span>
                  </>
                ) : (
                  <>
                    <ScanLine className="w-4 h-4" />
                    <span>{numeroBoleto ? "Escanear de novo" : "Escanear código"}</span>
                  </>
                )}
              </Button>
            </div>

            {infoBoleto && (
              <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
                <div className="flex items-center gap-1.5 truncate">
                  <Check className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="truncate">
                    {infoBoleto.nome}
                    {infoBoleto.decod.valor != null ? ` • R$ ${infoBoleto.decod.valor.toFixed(2)}` : ""}
                    {infoBoleto.decod.vencimento ? ` • Venc: ${infoBoleto.decod.vencimento.split("-").reverse().join("/")}` : ""}
                  </span>
                </div>
                {numeroBoleto && (
                  <button
                    type="button"
                    onClick={copiarCodigo}
                    className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
                  >
                    {copiado ? "Copiado!" : "Copiar"}
                  </button>
                )}
              </div>
            )}

            <input
              ref={inputScanCamera}
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                escanearCodigoBarrasDireto(e.target.files?.[0])
                e.target.value = ""
              }}
            />
          </div>
        )}

        {(pixCopiaECola || formaPagamento === "pix") && !repetir && (
          <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/60">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="pixCopiaECola" className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                Código Pix Copia e Cola
              </Label>
              {pixCopiaECola && (
                <button
                  type="button"
                  onClick={copiarPix}
                  className="flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 bg-emerald-100/80 dark:bg-emerald-900/60 px-2.5 py-1 rounded-lg border border-emerald-300/60 dark:border-emerald-700/60 cursor-pointer active:scale-95 transition-all"
                >
                  {pixCopiado ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Pix</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <Input
              id="pixCopiaECola"
              value={pixCopiaECola}
              onChange={(e) => setPixCopiaECola(e.target.value)}
              placeholder="Cole ou leia a chave Pix Copia e Cola aqui..."
              className="h-10 font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Para pagar escaneando ou colando o código Pix no app do banco.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="observacoes" className="text-xs font-semibold text-foreground">
            Observações / Detalhes (opcional)
          </Label>
          <textarea
            id="observacoes"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Ex: Ref: 10/2026, Fatura #984521, CNPJ 00.000.000/0001-00, juros de 1%..."
            rows={2}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-2xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
          />
        </div>

        {tipo === "despesa" && (
          <div className="flex flex-col gap-2.5 pt-1">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/80 p-3 bg-card hover:bg-muted/30 transition-colors">
              <Switch checked={despesaFixa} onCheckedChange={setDespesaFixa} className="mt-0.5" />
              <div className="text-sm">
                <span className="font-bold text-foreground block">Despesa fixa mensal</span>
                <span className="text-xs text-muted-foreground block leading-relaxed">
                  Aluguel, luz, internet, etc. Fica visível separada no filtro de custos fixos.
                </span>
              </div>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/80 p-3 bg-card hover:bg-muted/30 transition-colors">
              <Switch checked={pessoal} onCheckedChange={setPessoal} className="mt-0.5" />
              <div className="text-sm">
                <span className="font-bold text-foreground block">Despesa pessoal</span>
                <span className="text-xs text-muted-foreground block leading-relaxed">
                  Gasto particular — não entra nos totais do financeiro da empresa.
                </span>
              </div>
            </label>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-foreground">Forma de pagamento</Label>
            <Select
              value={formaPagamento}
              onValueChange={(v) =>
                setFormaPagamento((v as FormaPagamento) ?? "nenhuma")
              }
            >
              <SelectTrigger className="h-11 sm:h-10 text-base sm:text-sm">
                <SelectValue>
                  {(v: string) =>
                    formasPagamento.find((f) => f.value === v)?.label ?? "Nenhuma"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma">Nenhuma</SelectItem>
                {formasPagamento.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-foreground">Cliente (opcional)</Label>
            <Select
              value={clienteId}
              onValueChange={(v) => setClienteId(v ?? "nenhum")}
            >
              <SelectTrigger className="h-11 sm:h-10 text-base sm:text-sm">
                <SelectValue>
                  {(v: string) =>
                    v === "nenhum"
                      ? "Nenhum"
                      : (clientes.find((c) => c.id === v)?.nome ?? "Nenhum")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma">Nenhum</SelectItem>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!lancamento && (
          <div className="flex flex-col gap-1.5 pt-1">
            <Label htmlFor="meses" className="text-xs font-semibold text-foreground">
              Repetir por quantos meses?
            </Label>
            <Input
              id="meses"
              type="number"
              min="1"
              max="60"
              step="1"
              className="h-11 sm:h-10 w-full sm:w-40 text-base sm:text-sm"
              value={meses}
              onChange={(e) => setMeses(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {repetir
                ? `Cria ${quantidadeMeses} lançamentos de ${
                    isPositiveNumberInput(valor) ? formatarMoeda(Number(valor)) : "R$ 0,00"
                  }, todo mês no mesmo dia — de ${datasRepeticao[0].split("-").reverse().join("/")} até ${datasRepeticao[datasRepeticao.length - 1].split("-").reverse().join("/")}. O valor acima é o de cada parcela.`
                : "1 = lançamento único. Use pra financiamento, aluguel e contas que se repetem: o valor acima é o de cada mês."}
            </p>
          </div>
        )}

        {repetir && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ja-pagas" className="text-xs font-semibold text-foreground">
              Dessas, quantas já foram pagas?
            </Label>
            <Input
              id="ja-pagas"
              type="number"
              min="0"
              max={quantidadeMeses}
              step="1"
              className="h-11 sm:h-10 w-full sm:w-40 text-base sm:text-sm"
              value={jaPagas}
              onChange={(e) => setJaPagas(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {quantidadeJaPagas > 0 && jaPagasValidas
                ? `As ${quantidadeJaPagas} primeiras parcelas (até ${datasRepeticao[quantidadeJaPagas - 1].split("-").reverse().join("/")}) entram como pagas e o resto fica pendente. Se a primeira parcela já passou, coloque a data dela no vencimento.`
                : "Deixe 0 se nenhuma foi paga. Se já pagou as primeiras, coloque aqui — sem precisar marcar uma por uma."}
            </p>
          </div>
        )}
      </div>

      {/* RODAPÉ FIXO NA PARTE INFERIOR COM BOTÕES GRANDES PARA O POLEGAR */}
      <div className="p-4 sm:p-5 pt-3 border-t border-border/80 bg-muted/30 shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
        <Button
          type="button"
          variant="outline"
          onClick={onFechar}
          className="w-full sm:w-auto h-12 sm:h-10 text-sm font-semibold rounded-xl"
        >
          Cancelar
        </Button>
        <Button
          type="button"
          disabled={!valido}
          onClick={salvar}
          className="w-full sm:w-auto h-12 sm:h-10 text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-sm"
        >
          Salvar
        </Button>
      </div>
    </>
  )
}
