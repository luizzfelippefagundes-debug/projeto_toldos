"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
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
import { formatarDataInput } from "@/lib/date"
import { Plus } from "lucide-react"

function hojeISO() {
  return formatarDataInput(new Date())
}

const formasPagamento: { value: FormaPagamento; label: string }[] = [
  { value: "boleto", label: "Boleto" },
  { value: "pix", label: "Pix" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao", label: "Cartão" },
  { value: "transferencia", label: "Transferência" },
]

export function LancamentoFormDialog({
  lancamento,
  trigger,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  lancamento?: LancamentoFinanceiro
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [abertoInterno, setAbertoInterno] = useState(false)
  const aberto = openProp !== undefined ? openProp : abertoInterno
  const setAberto = onOpenChangeProp ?? setAbertoInterno

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger render={<Button />}>
          <Plus className="mr-2 h-4 w-4" />
          Novo lançamento
        </DialogTrigger>
      )}
      <DialogContent>
        <LancamentoFormFields
          key={aberto ? "aberto" : "fechado"}
          lancamento={lancamento}
          onFechar={() => setAberto(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function LancamentoFormFields({
  lancamento,
  onFechar,
}: {
  lancamento?: LancamentoFinanceiro
  onFechar: () => void
}) {
  const { addLancamento, updateLancamento, clientes } = useData()

  const [tipo, setTipo] = useState<TipoLancamento>(lancamento?.tipo ?? "despesa")
  const [descricao, setDescricao] = useState(lancamento?.descricao ?? "")
  const [categoria, setCategoria] = useState(lancamento?.categoria ?? "")
  const [valor, setValor] = useState(lancamento ? String(lancamento.valor) : "")
  const [vencimento, setVencimento] = useState(
    lancamento ? formatarDataInput(new Date(lancamento.vencimento)) : hojeISO()
  )
  const [clienteId, setClienteId] = useState<string>(lancamento?.clienteId ?? "nenhum")
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento | "nenhuma">(
    lancamento?.formaPagamento ?? "nenhuma"
  )
  const [numeroBoleto, setNumeroBoleto] = useState(lancamento?.numeroBoleto ?? "")

  const valido =
    descricao.trim().length > 0 &&
    categoria.trim().length > 0 &&
    isPositiveNumberInput(valor) &&
    Boolean(vencimento) &&
    Number.isFinite(new Date(`${vencimento}T00:00:00`).getTime())

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
        formaPagamento === "boleto" && numeroBoleto.trim()
          ? numeroBoleto.trim()
          : undefined,
    }
    if (lancamento) {
      updateLancamento(lancamento.id, dados)
    } else {
      addLancamento(dados)
    }
    onFechar()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{lancamento ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label>Tipo</Label>
          <Select
            value={tipo}
            onValueChange={(v) => setTipo((v as TipoLancamento) ?? tipo)}
          >
            <SelectTrigger>
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

        <div className="flex flex-col gap-2">
          <Label htmlFor="descricao">Descrição</Label>
          <Input
            id="descricao"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: Aluguel do galpão"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="categoria">Categoria</Label>
            <Input
              id="categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Ex: Aluguel, Fornecedor..."
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="valor">Valor (R$)</Label>
            <Input
              id="valor"
              type="number"
              min="0"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="vencimento">Vencimento</Label>
          <Input
            id="vencimento"
            type="date"
            value={vencimento}
            onChange={(e) => setVencimento(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>Cliente (opcional)</Label>
            <Select
              value={clienteId}
              onValueChange={(v) => setClienteId(v ?? "nenhum")}
            >
              <SelectTrigger>
                <SelectValue>
                  {(v: string) =>
                    v === "nenhum"
                      ? "Nenhum"
                      : (clientes.find((c) => c.id === v)?.nome ?? "Nenhum")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Nenhum</SelectItem>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Forma de pagamento (opcional)</Label>
            <Select
              value={formaPagamento}
              onValueChange={(v) =>
                setFormaPagamento((v as FormaPagamento) ?? "nenhuma")
              }
            >
              <SelectTrigger>
                <SelectValue>
                  {(v: string) =>
                    formasPagamento.find((f) => f.value === v)?.label ??
                    "Nenhuma"
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
        </div>

        {formaPagamento === "boleto" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="numeroBoleto">Número do boleto</Label>
            <Input
              id="numeroBoleto"
              value={numeroBoleto}
              onChange={(e) => setNumeroBoleto(e.target.value)}
              placeholder="Ex: 00190.00009 03..."
            />
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onFechar}>
          Cancelar
        </Button>
        <Button disabled={!valido} onClick={salvar}>
          Salvar
        </Button>
      </DialogFooter>
    </>
  )
}
