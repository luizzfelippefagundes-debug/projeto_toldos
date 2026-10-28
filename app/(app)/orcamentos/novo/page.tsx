"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
import { cn } from "@/lib/utils"
import { ClienteQuickAddDialog } from "@/components/orcamento/cliente-quick-add-dialog"
import { Stepper, type StepperStep } from "@/components/orcamento/stepper"
import { calcularOrcamentoCompleto, quantidadeMaterialConsumida } from "@/lib/calculo"
import { formatarData, formatarMoeda } from "@/lib/format"
import { acabamentosSeed, equipamentosAcessoSeed } from "@/lib/seed-data"
import {
  isFiniteNumberInput,
  isNonNegativeNumberInput,
  isPositiveNumberInput,
} from "@/lib/number"
import { toast } from "sonner"
import { Upload, FileCheck2, Printer, ArrowLeft, ArrowRight, Plus, X } from "lucide-react"
import type { FotoOrcamento } from "@/lib/types"
import { entradaEfetiva, textoCondicoesPagamento } from "@/lib/parcelas"
import { OrcamentoOficial } from "@/components/orcamentos/orcamento-oficial"
import { ItemAdicionalCard } from "@/components/orcamento/item-adicional-card"
import {
  formParaItem,
  formVazio,
  itemParaForm,
  pendenciasItem,
  type ItemAdicionalForm,
} from "@/lib/item-adicional-form"
import { ehImagem, formatarNumeroOrcamento, gerarLinhasOrcamento } from "@/lib/orcamento-pdf"

function numeroOuZero(valor: string): number {
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : 0
}

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
    orcamentos,
    rascunho,
    consumirRascunho,
    fecharOrcamento,
    updateOrcamento,
  } = useData()
  const router = useRouter()
  const searchParams = useSearchParams()
  const editarId = searchParams.get("editar")
  const orcamentoEditando = editarId
    ? orcamentos.find((o) => o.id === editarId && o.status !== "cancelado")
    : null
  const modoEdicao = Boolean(orcamentoEditando)

  const [passoAtual, setPassoAtual] = useState(1)

  const [clienteId, setClienteId] = useState("")
  const [materialId, setMaterialId] = useState("")
  const [servicoId, setServicoId] = useState("")
  const [largura, setLargura] = useState("")
  const [altura, setAltura] = useState("")
  const [quantidadeUnidades, setQuantidadeUnidades] = useState("1")
  const [horasEstimadas, setHorasEstimadas] = useState("")
  // Itens a mais do orçamento (além do principal, que usa os campos acima).
  const [extras, setExtras] = useState<ItemAdicionalForm[]>([])
  const [ajusteManual, setAjusteManual] = useState("0")
  const [arquivo, setArquivo] = useState<File | null>(null)
  // Entrada cobrada ao fechar; o restante fica pra entrega. Vazio ou 0 = à vista.
  const [entradaPercent, setEntradaPercent] = useState("50")
  // Vazio = o texto das condições segue a entrada automaticamente.
  const [condicoesPagamento, setCondicoesPagamento] = useState("")
  const [fotos, setFotos] = useState<FotoOrcamento[]>([])
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const [enviando, setEnviando] = useState(false)

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
  const validadeTimestamp = agora
    ? agora.getTime() + Number(validadeDias) * 24 * 60 * 60 * 1000
    : Number.NaN
  const validoAte = Number.isFinite(validadeTimestamp)
    ? new Date(validadeTimestamp)
    : null

  // Carrega orçamento em edição nos campos do formulário
  useEffect(() => {
    if (!orcamentoEditando) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClienteId(orcamentoEditando.clienteId)
    setMaterialId(orcamentoEditando.item.materialId)
    setServicoId(orcamentoEditando.item.servicoId)
    setLargura(orcamentoEditando.item.largura ? String(orcamentoEditando.item.largura) : "")
    setAltura(orcamentoEditando.item.altura ? String(orcamentoEditando.item.altura) : "")
    setQuantidadeUnidades(String(orcamentoEditando.item.quantidadeUnidades || 1))
    setHorasEstimadas(orcamentoEditando.item.horasEstimadas ? String(orcamentoEditando.item.horasEstimadas) : "")
    setAjusteManual(String(orcamentoEditando.ajusteManual))
    setValidadeDias(String(orcamentoEditando.validadeDias ?? 7))
    const acabamentos = orcamentoEditando.item.acabamentos ?? []
    setAcabamentosAtivos(Object.fromEntries(acabamentos.map(({ acabamentoId }) => [acabamentoId, true])))
    setAcabamentosQtd(Object.fromEntries(acabamentos.map(({ acabamentoId, quantidade }) => [acabamentoId, String(quantidade)])))
    const instalacao = orcamentoEditando.item.instalacao
    setInstalacaoIncluida(instalacao?.incluida ?? false)
    setHorasInstalacao(instalacao ? String(instalacao.horas) : "")
    setCustoHoraInstalacao(instalacao ? String(instalacao.custoHora) : "")
    setNumAjudantes(instalacao ? String(instalacao.numAjudantes) : "0")
    setDiariaAjudante(instalacao ? String(instalacao.diariaAjudante) : "")
    setEquipamentoId(instalacao?.equipamentoId ?? equipamentosAcessoSeed[0].id)
    const deslocamento = orcamentoEditando.item.deslocamento
    setDeslocamentoIncluido(deslocamento?.incluido ?? false)
    setDistanciaKm(deslocamento ? String(deslocamento.distanciaKm) : "")
    setCustoPorKm(deslocamento ? String(deslocamento.custoPorKm) : "")
    setPedagio(deslocamento ? String(deslocamento.pedagio) : "")
    setAlimentacao(deslocamento ? String(deslocamento.alimentacao) : "")
    setMargemPercent(String(orcamentoEditando.item.margemPercent ?? 0))
    setDescontoPercent(String(orcamentoEditando.item.descontoPercent ?? 0))
    setImpostoPercent(String(orcamentoEditando.item.impostoPercent ?? 0))
    setCondicoesPagamento(orcamentoEditando.item.condicoesPagamento ?? "")
    setEntradaPercent(String(orcamentoEditando.item.entradaPercent ?? 100))
    setFotos(orcamentoEditando.item.fotos ?? [])
    setExtras((orcamentoEditando.item.itensAdicionais ?? []).map(itemParaForm))
  // Os orçamentos chegam do servidor depois da página montar; roda de novo
  // quando o orçamento aparece, mas não a cada mudança na lista.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editarId, orcamentoEditando?.id])

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
    const acabamentos = rascunho.item.acabamentos ?? []
    setAcabamentosAtivos(
      Object.fromEntries(acabamentos.map(({ acabamentoId }) => [acabamentoId, true]))
    )
    setAcabamentosQtd(
      Object.fromEntries(
        acabamentos.map(({ acabamentoId, quantidade }) => [
          acabamentoId,
          String(quantidade),
        ])
      )
    )

    const instalacao = rascunho.item.instalacao
    setInstalacaoIncluida(instalacao?.incluida ?? false)
    setHorasInstalacao(instalacao ? String(instalacao.horas) : "")
    setCustoHoraInstalacao(instalacao ? String(instalacao.custoHora) : "")
    setNumAjudantes(instalacao ? String(instalacao.numAjudantes) : "0")
    setDiariaAjudante(instalacao ? String(instalacao.diariaAjudante) : "")
    setEquipamentoId(instalacao?.equipamentoId ?? equipamentosAcessoSeed[0].id)

    const deslocamento = rascunho.item.deslocamento
    setDeslocamentoIncluido(deslocamento?.incluido ?? false)
    setDistanciaKm(deslocamento ? String(deslocamento.distanciaKm) : "")
    setCustoPorKm(deslocamento ? String(deslocamento.custoPorKm) : "")
    setPedagio(deslocamento ? String(deslocamento.pedagio) : "")
    setAlimentacao(deslocamento ? String(deslocamento.alimentacao) : "")
    setMargemPercent(String(rascunho.item.margemPercent ?? 0))
    setDescontoPercent(String(rascunho.item.descontoPercent ?? 0))
    setImpostoPercent(String(rascunho.item.impostoPercent ?? 0))
    setCondicoesPagamento(rascunho.item.condicoesPagamento ?? "")
    setEntradaPercent(String(rascunho.item.entradaPercent ?? 100))
    setFotos(rascunho.item.fotos ?? [])
    setExtras((rascunho.item.itensAdicionais ?? []).map(itemParaForm))
    consumirRascunho()
  }, [rascunho, consumirRascunho])

  const material = materiais.find((m) => m.id === materialId)
  const servico = servicos.find((s) => s.id === servicoId)
  const cliente = clientes.find((c) => c.id === clienteId)

  const item = useMemo(
    () => ({
      materialId,
      servicoId,
      largura: numeroOuZero(largura),
      altura: numeroOuZero(altura),
      quantidadeUnidades: numeroOuZero(quantidadeUnidades),
      horasEstimadas: numeroOuZero(horasEstimadas),
      acabamentos: acabamentosSeed
        .filter(
          (a) =>
            acabamentosAtivos[a.id] &&
            isPositiveNumberInput(acabamentosQtd[a.id] ?? "")
        )
        .map((a) => ({
          acabamentoId: a.id,
          quantidade: numeroOuZero(acabamentosQtd[a.id] ?? ""),
        })),
      instalacao: {
        incluida: instalacaoIncluida,
        horas: numeroOuZero(horasInstalacao),
        custoHora: numeroOuZero(custoHoraInstalacao),
        numAjudantes: numeroOuZero(numAjudantes),
        diariaAjudante: numeroOuZero(diariaAjudante),
        equipamentoId,
      },
      deslocamento: {
        incluido: deslocamentoIncluido,
        distanciaKm: numeroOuZero(distanciaKm),
        custoPorKm: numeroOuZero(custoPorKm),
        pedagio: numeroOuZero(pedagio),
        alimentacao: numeroOuZero(alimentacao),
      },
      margemPercent: numeroOuZero(margemPercent),
      descontoPercent: numeroOuZero(descontoPercent),
      impostoPercent: numeroOuZero(impostoPercent),
      condicoesPagamento: condicoesPagamento.trim() || undefined,
      entradaPercent: numeroOuZero(entradaPercent),
      fotos: fotos.length > 0 ? fotos : undefined,
      itensAdicionais: extras.length > 0 ? extras.map(formParaItem) : undefined,
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
      condicoesPagamento,
      entradaPercent,
      fotos,
      extras,
    ]
  )

  const resultado = material
    ? calcularOrcamentoCompleto(
        item,
        material,
        servico ?? null,
        Number(ajusteManual) || 0,
        acabamentosSeed,
        equipamentosAcessoSeed,
        { materiais, servicos }
      )
    : null

  const dimensoesValidas =
    isPositiveNumberInput(largura) && isPositiveNumberInput(altura)
  const quantidadeValida =
    isPositiveNumberInput(quantidadeUnidades) &&
    Number.isInteger(Number(quantidadeUnidades))
  const medidasValidas =
    Boolean(material) &&
    (material?.unidade !== "m2" || dimensoesValidas) &&
    quantidadeValida &&
    (servico?.formaCobranca !== "m2" || dimensoesValidas)

  const camposNaoNegativos = [
    horasEstimadas,
    margemPercent,
    descontoPercent,
    impostoPercent,
    horasInstalacao,
    custoHoraInstalacao,
    numAjudantes,
    diariaAjudante,
    distanciaKm,
    custoPorKm,
    pedagio,
    alimentacao,
  ]
  const camposOpcionaisValidos = camposNaoNegativos.every(
    (valor) =>
      valor.trim() === "" || isNonNegativeNumberInput(valor)
  )
  const acabamentosValidos = acabamentosSeed.every(
    (acabamento) =>
      !acabamentosAtivos[acabamento.id] ||
      isPositiveNumberInput(acabamentosQtd[acabamento.id] ?? "")
  )
  const entradaValida =
    entradaPercent.trim() === "" ||
    (isNonNegativeNumberInput(entradaPercent) && Number(entradaPercent) <= 100)
  const validadeValida =
    isPositiveNumberInput(validadeDias) &&
    Number.isInteger(Number(validadeDias)) &&
    Number.isFinite(validadeTimestamp)
  const horasEstimadasValidas =
    servico?.formaCobranca !== "hora" ||
    isPositiveNumberInput(horasEstimadas)
  const descontoValido =
    Number(descontoPercent) >= 0 && Number(descontoPercent) <= 100
  const pendenciasExtras = extras.flatMap((form, i) =>
    pendenciasItem(form, materiais, servicos, i + 2)
  )
  const extrasValidos = pendenciasExtras.length === 0
  const dadosValidos =
    Boolean(cliente) &&
    Boolean(material) &&
    medidasValidas &&
    camposOpcionaisValidos &&
    acabamentosValidos &&
    extrasValidos &&
    validadeValida &&
    entradaValida &&
    descontoValido &&
    horasEstimadasValidas &&
    Number.isInteger(Number(numAjudantes)) &&
    isFiniteNumberInput(ajusteManual) &&
    Boolean(resultado) &&
    Number.isFinite(resultado?.total) &&
    (resultado?.total ?? -1) >= 0

  // Lista do que falta — mostrada perto do botão "Fechar Orçamento" quando
  // ele estiver desabilitado, pra nunca ficar travado sem explicação.
  const pendencias = [
    !cliente && "selecione o cliente",
    !material && "selecione o material",
    material && !medidasValidas && "preencha as medidas corretamente",
    ...pendenciasExtras,
    !camposOpcionaisValidos && "revise os campos de instalação/deslocamento",
    !acabamentosValidos && "informe a quantidade dos acabamentos marcados",
    !validadeValida && "informe a validade do orçamento",
    !entradaValida && "a entrada deve ficar entre 0% e 100%",
    !descontoValido && "o desconto deve ficar entre 0% e 100%",
    !horasEstimadasValidas && "informe as horas estimadas do serviço",
    !Number.isInteger(Number(numAjudantes)) && "revise o número de ajudantes",
    !isFiniteNumberInput(ajusteManual) && "revise o ajuste manual",
  ].filter((p): p is string => Boolean(p))
  const podeFechar = dadosValidos

  // Pendências por etapa: no passo a passo o "Próximo" só libera quando a
  // etapa atual está certa, pra ninguém chegar no fim sem saber o que faltou.
  const pendenciasPorPasso: Record<number, (string | false | undefined)[]> = {
    1: [!cliente && "selecione o cliente"],
    2: [
      !material && "selecione o material",
      material && !medidasValidas && "preencha as medidas corretamente",
      !horasEstimadasValidas && "informe as horas estimadas do serviço",
      ...pendenciasExtras,
    ],
    3: [!acabamentosValidos && "informe a quantidade dos acabamentos marcados"],
    4: [
      !camposOpcionaisValidos && "revise os campos de instalação/deslocamento",
      !Number.isInteger(Number(numAjudantes)) && "revise o número de ajudantes",
    ],
    5: [
      !validadeValida && "informe a validade do orçamento",
      !entradaValida && "a entrada deve ficar entre 0% e 100%",
      !descontoValido && "o desconto deve ficar entre 0% e 100%",
      !isFiniteNumberInput(ajusteManual) && "revise o ajuste manual",
    ],
  }
  const pendenciasPassoAtual = (pendenciasPorPasso[passoAtual] ?? []).filter(
    (p): p is string => Boolean(p)
  )

  // Dados do PDF oficial. Orçamento novo ainda não tem número: usa o próximo
  // da sequência (mesma regra do data-context), que é o que ele vai receber.
  const dataPdf = orcamentoEditando?.criadoEm ?? new Date().toISOString()
  const numeroPdf = formatarNumeroOrcamento(
    orcamentoEditando?.numero ??
      orcamentos.reduce((max, o) => Math.max(max, o.numero), 1000) + 1,
    dataPdf
  )
  const [urlAnexoLocal, setUrlAnexoLocal] = useState<string | null>(null)
  useEffect(() => {
    if (!arquivo || !ehImagem(arquivo.type)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUrlAnexoLocal(null)
      return
    }
    const url = URL.createObjectURL(arquivo)
    setUrlAnexoLocal(url)
    return () => URL.revokeObjectURL(url)
  }, [arquivo])
  const urlAnexoPdf =
    urlAnexoLocal ??
    (!arquivo && orcamentoEditando?.anexoUrl && ehImagem(orcamentoEditando.anexoNome)
      ? orcamentoEditando.anexoUrl
      : null)
  const fotosPdf = [...(urlAnexoPdf ? [{ url: urlAnexoPdf, legenda: "" }] : []), ...fotos]

  const linhasPdf =
    material && resultado
      ? gerarLinhasOrcamento({
          item,
          nomeMaterial: material.nome,
          unidadeMaterial: material.unidade,
          acabamentosDisponiveis: acabamentosSeed,
          resultado,
          total: resultado.total,
          adicionais: extras.map((form) => {
            const materialExtra = materiais.find((m) => m.id === form.materialId)
            return {
              item: formParaItem(form),
              nomeMaterial: materialExtra?.nome ?? "Material removido",
              unidadeMaterial: materialExtra?.unidade ?? ("unidade" as const),
            }
          }),
        })
      : []

  function irPara(passo: number) {
    if (passo > passoAtual && pendenciasPassoAtual.length > 0) {
      toast.error(`Falta: ${pendenciasPassoAtual.join(", ")}`)
      return
    }
    setPassoAtual(Math.min(Math.max(passo, 1), passos.length))
  }

  function handleGerarPdf() {
    if (!dadosValidos) {
      toast.error("Revise os dados e valores do orçamento antes de gerar o PDF")
      return
    }
    window.print()
  }

  async function handleSalvarEdicao(fechar = false) {
    if (!podeFechar || !orcamentoEditando) return
    setEnviando(true)
    try {
      let novoAnexoUrl: string | undefined
      let novoAnexoNome: string | null = orcamentoEditando.anexoNome
      if (arquivo) {
        const form = new FormData()
        form.append("file", arquivo)
        const res = await fetch("/api/upload", { method: "POST", body: form })
        if (!res.ok) {
          toast.error("Falha no upload do arquivo")
          return
        }
        const { url } = await res.json()
        novoAnexoUrl = url
        novoAnexoNome = arquivo.name
      }
      const salvou = updateOrcamento(orcamentoEditando.id, {
        clienteId: clienteId,
        item,
        ajusteManual: numeroOuZero(ajusteManual),
        validadeDias: numeroOuZero(validadeDias),
        anexoNome: novoAnexoNome,
        anexoUrl: novoAnexoUrl,
      }, { fechar })
      if (!salvou) {
        toast.error("Este orçamento já tem pagamento registrado no financeiro e não pode ser editado.")
        return
      }
      toast.success(fechar ? "Orçamento fechado." : "Orçamento atualizado.")
      router.push("/orcamentos")
    } catch {
      toast.error("Erro ao salvar alterações.")
    } finally {
      setEnviando(false)
    }
  }

  async function handleFechar() {
    if (!podeFechar || !cliente || !material) return
    setEnviando(true)
    try {
      let anexoNome: string | null = null
      let anexoUrl: string | undefined
      if (arquivo) {
        const form = new FormData()
        form.append("file", arquivo)
        const res = await fetch("/api/upload", { method: "POST", body: form })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          toast.error(err.error ?? "Falha no upload do arquivo")
          return
        }
        const { url } = await res.json()
        anexoNome = arquivo.name
        anexoUrl = url
      }
      const orcamento = fecharOrcamento({
        clienteId: cliente.id,
        item,
        ajusteManual: numeroOuZero(ajusteManual),
        anexoNome,
        anexoUrl,
        validadeDias: numeroOuZero(validadeDias),
      })

      // Envia email em background se o cliente tiver email cadastrado
      if (cliente.email && resultado) {
        fetch("/api/email-orcamento", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clienteNome: cliente.nome,
            clienteEmail: cliente.email,
            numero: orcamento.numero,
            material: material.nome,
            servico: servico?.nome,
            total: resultado.total + numeroOuZero(ajusteManual),
            validoAte: validoAte ? formatarData(validoAte.toISOString()) : undefined,
          }),
        })
          .then((r) => r.json())
          .then((j) => {
            if (!j.ok) toast.error("Orçamento fechado, mas falha ao enviar email.")
            else toast.success(`Email enviado para ${cliente.email}`)
          })
          .catch(() => toast.error("Orçamento fechado, mas falha ao enviar email."))
      }

      toast.success(`Orçamento fechado para ${cliente.nome}`)
      router.push(`/orcamentos/${orcamento.id}/orcamento`)
    } catch {
      toast.error("Erro ao enviar arquivo. Tente novamente.")
    } finally {
      setEnviando(false)
    }
  }

  async function adicionarFotos(arquivos: FileList | null) {
    const imagens = Array.from(arquivos ?? []).filter((f) => f.type.startsWith("image/"))
    if (imagens.length === 0) return
    setEnviandoFoto(true)
    try {
      const novas: FotoOrcamento[] = []
      for (const imagem of imagens) {
        const form = new FormData()
        form.append("file", imagem)
        const res = await fetch("/api/upload", { method: "POST", body: form })
        if (!res.ok) {
          toast.error(`Falha ao enviar ${imagem.name}`)
          continue
        }
        const { url } = await res.json()
        novas.push({ url, legenda: "" })
      }
      setFotos((atual) => [...atual, ...novas])
    } finally {
      setEnviandoFoto(false)
    }
  }

  // Na edição a tela é uma página única: todos os blocos aparecem juntos,
  // sem etapas, pra alterar só o campo que precisa.
  function mostrarPasso(passo: number) {
    return modoEdicao || passoAtual === passo
  }

  function toggleAcabamento(id: string, ativo: boolean) {
    setAcabamentosAtivos((atual) => ({ ...atual, [id]: ativo }))
  }

  function setQtdAcabamento(id: string, valor: string) {
    setAcabamentosQtd((atual) => ({ ...atual, [id]: valor }))
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold">
            {modoEdicao ? `Editar Orçamento #${orcamentoEditando?.numero}` : "Novo Orçamento"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {modoEdicao
              ? "Altere o que precisar e salve. O total ao lado atualiza na hora."
              : "Preencha os passos abaixo — o valor é calculado automaticamente."}
          </p>
        </div>
        {modoEdicao && (
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Button variant="outline" onClick={() => router.push("/orcamentos")}>
              Cancelar
            </Button>
            <Button variant="outline" onClick={handleGerarPdf}>
              <Printer className="mr-2 h-4 w-4" />
              PDF
            </Button>
            <Button
              variant={orcamentoEditando?.status === "aberto" ? "outline" : "default"}
              disabled={!podeFechar || enviando}
              onClick={() => handleSalvarEdicao()}
            >
              {enviando ? "Salvando..." : "Salvar"}
            </Button>
            {orcamentoEditando?.status === "aberto" && (
              <Button disabled={!podeFechar || enviando} onClick={() => handleSalvarEdicao(true)}>
                Salvar e fechar
              </Button>
            )}
          </div>
        )}
      </div>

      {!modoEdicao && (
        <Card className="print:hidden">
          <CardContent className="pt-6">
            <Stepper passos={passos} atual={passoAtual} />
          </CardContent>
        </Card>
      )}

      <div className="hidden print:block">
        <OrcamentoOficial
          clienteNome={cliente?.nome ?? "—"}
          data={dataPdf}
          numero={numeroPdf}
          linhas={linhasPdf}
          total={resultado?.total ?? 0}
          condicoes={condicoesPagamento.trim() || textoCondicoesPagamento(numeroOuZero(entradaPercent))}
          fotos={fotosPdf}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 print:hidden">
        <div
          className={cn(
            "flex flex-col gap-6 lg:col-span-2 print:hidden",
            // Edição: só os campos rolam; menu e resumo ficam parados.
            // Os blocos não podem encolher pra caber na altura, senão cortam.
            modoEdicao &&
              "lg:scroll-painel lg:h-[calc(100dvh-10rem)] lg:py-5 lg:pr-3 lg:[&>*]:shrink-0"
          )}
        >
          {mostrarPasso(1) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {modoEdicao ? "" : "Etapa 1 de 6 — "}Cliente
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
                      <SelectValue placeholder="Selecione o cliente">
                        {(v: string) =>
                          clientes.find((c) => c.id === v)?.nome ?? "Selecione o cliente"
                        }
                      </SelectValue>
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

          {mostrarPasso(2) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {modoEdicao ? "" : "Etapa 2 de 6 — "}Produto e medidas
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {extras.length > 0 && (
                  <p className="text-sm font-semibold">Item 1</p>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex min-w-0 flex-col gap-2">
                    <Label>Material</Label>
                    <Select
                      value={materialId}
                      onValueChange={(v) => setMaterialId(v ?? "")}
                    >
                      {/* Nome longo de material não pode alargar a tela no celular. */}
                      <SelectTrigger className="w-full min-w-0">
                        <SelectValue placeholder="Selecione o material">
                          {(v: string) =>
                            materiais.find((m) => m.id === v)?.nome ?? "Selecione o material"
                          }
                        </SelectValue>
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
                  <div className="flex min-w-0 flex-col gap-2">
                    <Label>
                      Serviço{" "}
                      <span className="font-normal text-muted-foreground">(opcional)</span>
                    </Label>
                    <Select
                      value={servicoId}
                      onValueChange={(v) => setServicoId(v ?? "")}
                    >
                      <SelectTrigger className="w-full min-w-0">
                        <SelectValue placeholder="Sem serviço adicional">
                          {(v: string) =>
                            servicos.find((s) => s.id === v)?.nome ?? "Sem serviço adicional"
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhum">Sem serviço adicional</SelectItem>
                        {servicos.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {(material?.unidade === "m2" ||
                  servico?.formaCobranca === "m2") && (
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
                )}

                {material && (
                  <div className="flex flex-col gap-2 sm:w-48">
                    <Label htmlFor="quantidade">Quantidade</Label>
                    <Input
                      id="quantidade"
                      type="number"
                      min="1"
                      step="1"
                      value={quantidadeUnidades}
                      onChange={(e) => setQuantidadeUnidades(e.target.value)}
                    />
                    {material.unidade === "m2" && (
                      <p className="text-xs text-muted-foreground">
                        Peças com a largura e altura acima.
                      </p>
                    )}
                  </div>
                )}

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

                <Separator />
                <div className="flex flex-col gap-3">
                  {extras.map((form, i) => (
                    <ItemAdicionalCard
                      key={form.id}
                      numero={i + 2}
                      form={form}
                      materiais={materiais}
                      servicos={servicos}
                      onChange={(novo) =>
                        setExtras((atual) => atual.map((f) => (f.id === novo.id ? novo : f)))
                      }
                      onRemover={() =>
                        setExtras((atual) => atual.filter((f) => f.id !== form.id))
                      }
                    />
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setExtras((atual) => [
                        ...atual,
                        formVazio(`item-${Math.random().toString(36).slice(2, 10)}`),
                      ])
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar outro item
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {mostrarPasso(3) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {modoEdicao ? "" : "Etapa 3 de 6 — "}Acabamentos
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

          {mostrarPasso(4) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {modoEdicao ? "" : "Etapa 4 de 6 — "}Instalação e logística
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
                      <SelectValue>
                        {(v: string) =>
                          equipamentosAcessoSeed.find((e) => e.id === v)?.nome
                        }
                      </SelectValue>
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

          {mostrarPasso(5) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {modoEdicao ? "" : "Etapa 5 de 6 — "}Precificação
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
                        <SelectValue>
                          {(v: string) => (v === "0" ? "Sem imposto" : `${v}%`)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Sem imposto</SelectItem>
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

                <div className="flex flex-col gap-2 sm:w-1/2">
                  <Label htmlFor="entrada">Entrada ao fechar (%)</Label>
                  <Input
                    id="entrada"
                    type="number"
                    min="0"
                    max="100"
                    value={entradaPercent}
                    onChange={(e) => setEntradaPercent(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {(() => {
                      const pct = entradaEfetiva(numeroOuZero(entradaPercent))
                      const total = resultado?.total ?? 0
                      if (pct === null) return "Sem entrada: o valor todo fica pra receber em um pagamento só."
                      const entrada = Math.round(((total * pct) / 100) * 100) / 100
                      return `Entrada de ${formatarMoeda(entrada)} agora e ${formatarMoeda(Math.round((total - entrada) * 100) / 100)} na entrega. Cada pagamento marcado como pago gera um recibo.`
                    })()}
                  </p>
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
                        {Number(impostoPercent) > 0 ? `Imposto (${impostoPercent}%)` : "Sem imposto"}
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

          {mostrarPasso(6) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {modoEdicao ? "" : "Etapa 6 de 6 — "}Foto ou vídeo do local (opcional)
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <label
                  htmlFor="anexo"
                  className="flex cursor-pointer flex-col items-center gap-3 rounded-md border border-dashed border-border py-8 text-center hover:bg-accent transition-colors"
                >
                  {arquivo ? (
                    <>
                      {arquivo.type.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={URL.createObjectURL(arquivo)}
                          alt="Preview"
                          className="max-h-48 max-w-full rounded object-contain"
                        />
                      ) : (
                        <FileCheck2 className="h-10 w-10 text-primary" />
                      )}
                      <span className="text-sm font-medium">{arquivo.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {(arquivo.size / 1024 / 1024).toFixed(1)} MB — clique para trocar
                      </span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Clique para anexar uma foto ou vídeo (opcional)
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Máximo 50 MB
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

          {mostrarPasso(6) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dados do orçamento (PDF)</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="condicoes">Condições de pagamento</Label>
                  <Input
                    id="condicoes"
                    value={condicoesPagamento}
                    onChange={(e) => setCondicoesPagamento(e.target.value)}
                    placeholder={textoCondicoesPagamento(numeroOuZero(entradaPercent))}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Mais fotos para o PDF (opcional)</Label>
                  <p className="text-xs text-muted-foreground">
                    A foto anexada acima já entra no PDF. Aqui você pode
                    adicionar outras e escrever legenda.
                  </p>
                  {fotos.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {fotos.map((f, i) => (
                        <div key={`${f.url}-${i}`} className="flex flex-col gap-2 rounded-md border border-border p-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={f.url} alt="" className="h-28 w-full rounded object-contain" />
                          <div className="flex gap-2">
                            <Input
                              value={f.legenda}
                              placeholder="Legenda (ex: Placa)"
                              onChange={(e) =>
                                setFotos((atual) =>
                                  atual.map((x, j) => (j === i ? { ...x, legenda: e.target.value } : x))
                                )
                              }
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              aria-label="Remover foto"
                              onClick={() => setFotos((atual) => atual.filter((_, j) => j !== i))}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <label
                    htmlFor="fotos-pdf"
                    className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border py-4 text-sm text-muted-foreground transition-colors hover:bg-accent"
                  >
                    <Upload className="h-4 w-4" />
                    {enviandoFoto ? "Enviando…" : "Adicionar fotos"}
                  </label>
                  <input
                    id="fotos-pdf"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={enviandoFoto}
                    onChange={(e) => {
                      adicionarFotos(e.target.files)
                      e.target.value = ""
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          <div className={modoEdicao ? "hidden" : "flex justify-between print:hidden"}>
            <Button
              variant="outline"
              onClick={() => irPara(passoAtual - 1)}
              disabled={passoAtual === 1}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Anterior
            </Button>
            {passoAtual < passos.length && (
              <Button
                disabled={pendenciasPassoAtual.length > 0}
                onClick={() => irPara(passoAtual + 1)}
              >
                Próximo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
          {!modoEdicao && pendenciasPassoAtual.length > 0 && (
            <p className="-mt-3 rounded-md border border-red-400/50 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-300 print:hidden">
              Falta: {pendenciasPassoAtual.join(", ")}.
            </p>
          )}
        </div>

        <div className="lg:col-span-1">
          <Card className="lg:sticky lg:top-6">
            <CardHeader>
              <CardTitle className="text-base">Resumo do orçamento</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {resultado && extras.length > 0 && (
                <div className="flex flex-col gap-1.5 rounded-md bg-muted/40 p-2 text-xs">
                  {resultado.itens.map((parte, i) => {
                    const nome =
                      materiais.find((m) => m.id === parte.materialId)?.nome ?? "Material removido"
                    return (
                      <div key={i} className="flex justify-between gap-3">
                        <span className="min-w-0 break-words text-muted-foreground">
                          Item {i + 1} — {nome}
                        </span>
                        <span className="shrink-0">
                          {formatarMoeda(
                            parte.subtotalMaterial +
                              parte.subtotalMaoDeObra +
                              parte.subtotalAcabamentos
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

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
              {material && (
                <div className="flex flex-col gap-0.5 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:gap-3">
                  <span className="shrink-0">
                    {extras.length > 0 ? "Consumo de material (item 1)" : "Consumo de material"}
                  </span>
                  <span className="min-w-0 break-words sm:text-right">
                    {quantidadeMaterialConsumida(item, material).toFixed(2)}{" "}
                    {material.unidade === "m2" ? "m²" : "un"} de{" "}
                    {material.nome}
                  </span>
                </div>
              )}
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
                  {Number(impostoPercent) > 0 ? `Imposto (${impostoPercent}%)` : "Sem imposto"}
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
              {orcamentoEditando?.totalFechado !== undefined &&
                resultado &&
                Math.abs(orcamentoEditando.totalFechado - resultado.total) > 0.005 && (
                  <div className="flex justify-between text-xs text-muted-foreground print:hidden">
                    <span>Antes da edição</span>
                    <span>{formatarMoeda(orcamentoEditando.totalFechado)}</span>
                  </div>
                )}
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
                {modoEdicao ? (
                  <>
                    <Button disabled={!podeFechar || enviando} onClick={() => handleSalvarEdicao()}>
                      {enviando ? "Salvando..." : "Salvar Alterações"}
                    </Button>
                    {orcamentoEditando?.status === "aberto" && (
                      <Button
                        variant="secondary"
                        disabled={!podeFechar || enviando}
                        onClick={() => handleSalvarEdicao(true)}
                      >
                        Salvar e fechar orçamento
                      </Button>
                    )}
                  </>
                ) : (
                  <Button disabled={!podeFechar || enviando} onClick={handleFechar}>
                    {enviando ? "Enviando..." : "Fechar Orçamento"}
                  </Button>
                )}
                {!podeFechar && pendencias.length > 0 && (
                  <p className="rounded-md border border-red-400/50 bg-red-500/10 px-3 py-2 text-center text-sm font-medium text-red-600 dark:text-red-300">
                    Falta: {pendencias.join(", ")}.
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
