"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import { toast } from "sonner"
import { useData } from "@/context/data-context"
import { Button } from "@/components/ui/button"
import { formatarData, formatarMoeda } from "@/lib/format"
import { formatarNumeroOrcamento, EMPRESA_ORCAMENTO } from "@/lib/orcamento-pdf"
import { calcularOrcamentoSalvo } from "@/lib/orcamento-itens"
import { linkWhatsapp } from "@/lib/whatsapp"
import {
  ArrowLeft,
  FileCheck,
  FileText,
  MessageCircle,
  Printer,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  DollarSign,
  UserCheck,
} from "lucide-react"

function formatarDataExtenso(dataIso: string | Date): string {
  const data = typeof dataIso === "string" ? new Date(dataIso) : dataIso
  const meses = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ]
  const dia = data.getDate()
  const mes = meses[data.getMonth()]
  const ano = data.getFullYear()
  return `${dia} de ${mes} de ${ano}`
}

export default function ContratoServicoPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { orcamentos, clientes, materiais, servicos, acabamentos } = useData()

  const [assinaturaDigital, setAssinaturaDigital] = useState<string | null>(null)
  const [dataAssinatura, setDataAssinatura] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  // Campos customizáveis com valores padrão inteligentes
  const [localInstalacao, setLocalInstalacao] = useState<string>("No endereço do cliente / conforme alinhado no orçamento")
  const [prazoExecucao, setPrazoExecucao] = useState<string>("10 a 15 dias úteis a contar do pagamento da entrada e aprovação da arte")

  const orcamento = orcamentos.find((o) => o.id === id)

  useEffect(() => {
    if (!id) return
    fetch(`/api/assinar/por-orcamento/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.assinado && data.assinaturaData) {
          setAssinaturaDigital(data.assinaturaData)
          setDataAssinatura(data.assinadoEm)
        }
      })
      .catch(() => {})
  }, [id])

  if (!orcamento) {
    return (
      <div className="flex flex-col gap-4 p-8">
        <p className="text-sm text-muted-foreground">Orçamento não encontrado.</p>
        <Button variant="outline" className="self-start" onClick={() => router.push("/orcamentos")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao histórico
        </Button>
      </div>
    )
  }

  const cliente = clientes.find((c) => c.id === orcamento.clienteId)
  const material = materiais.find((m) => m.id === orcamento.item.materialId)
  const servico = servicos.find((s) => s.id === orcamento.item.servicoId)

  const resultado = calcularOrcamentoSalvo(orcamento, materiais, servicos)
  const totalFinal = orcamento.totalFechado ?? resultado?.total ?? 0
  const valorMateriais = resultado?.subtotalMaterial ?? totalFinal * 0.55
  const valorMaoDeObra = (resultado?.subtotalMaoDeObra ?? 0) + (resultado?.subtotalInstalacao ?? 0) || (totalFinal - valorMateriais)
  const valorEntrada = totalFinal * 0.5
  const valorSaldo = totalFinal * 0.5

  const numeroFormatado = formatarNumeroOrcamento(orcamento.numero, orcamento.criadoEm)
  const dataReferencia = orcamento.fechadoEm || orcamento.criadoEm || new Date().toISOString()
  const dataExtenso = formatarDataExtenso(dataReferencia)

  const nomeMaterial = orcamento.materialFechado?.nome ?? material?.nome ?? "Material sob especificação"
  const nomeServico = orcamento.servicoFechado?.nome ?? servico?.nome ?? "Confecção e Instalação"

  // Lista de acabamentos
  const nomesAcabamentos = (orcamento.item.acabamentos ?? [])
    .map((ac) => {
      const enc = acabamentos.find((a) => a.id === ac.acabamentoId)
      return enc ? `${enc.nome} (${ac.quantidade} ${enc.unidade})` : null
    })
    .filter(Boolean)
    .join(", ")

  // Envio por WhatsApp
  async function handleEnviarWhatsapp() {
    if (!cliente?.telefone) {
      toast.error("Cliente sem telefone cadastrado.")
      return
    }
    setEnviando(true)
    try {
      let linkAssinatura = ""
      if (orcamento) {
        try {
          const resToken = await fetch("/api/assinar/criar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orcamentoId: orcamento.id }),
          })
          if (resToken.ok) {
            const dadosToken = await resToken.json()
            linkAssinatura = dadosToken.url
          }
        } catch (e) {
          console.warn("Falha gerando token:", e)
        }
      }

      const mensagem = `Olá, ${cliente.nome.split(" ")[0]}! 📄 Segue o *Contrato de Prestação de Serviços nº CTR-${numeroFormatado}* da Toldos Print referente ao Orçamento nº ${numeroFormatado}.\n\nValor total: *${formatarMoeda(totalFinal)}* (Entrada: ${formatarMoeda(valorEntrada)} + Saldo: ${formatarMoeda(valorSaldo)}).\n\n${linkAssinatura ? `Você pode assinar digitalmente pelo link abaixo:\n${linkAssinatura}\n\n` : ""}Qualquer dúvida estamos à disposição!`
      const link = linkWhatsapp(cliente.telefone, mensagem)
      if (link) {
        window.open(link, "_blank")
        toast.success("Mensagem aberta no WhatsApp!")
      }
    } catch {
      toast.error("Erro ao preparar envio pelo WhatsApp.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      {/* BARRA SUPERIOR DE AÇÕES (OCULTA NA IMPRESSÃO) */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.push("/orcamentos")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <span className="text-xs text-muted-foreground">|</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/orcamentos/${orcamento.id}/orcamento`)}
          >
            <FileText className="mr-2 h-4 w-4" />
            Ver Orçamento
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/orcamentos/${orcamento.id}/os`)}
          >
            <Printer className="mr-2 h-4 w-4" />
            Ver OS
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {cliente?.telefone ? (
            <Button
              variant="outline"
              size="sm"
              className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950"
              onClick={handleEnviarWhatsapp}
              disabled={enviando}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              {enviando ? "Preparando..." : "Enviar Contrato via WhatsApp"}
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled title="Cliente sem telefone">
              <MessageCircle className="mr-2 h-4 w-4" />
              Sem telefone
            </Button>
          )}

          <Button size="sm" onClick={() => window.print()} className="bg-primary text-primary-foreground font-bold">
            <Printer className="mr-2 h-4 w-4" />
            Imprimir / Salvar PDF
          </Button>
        </div>
      </div>

      {/* DOCUMENTO OFICIAL A4 IMPRIMÍVEL */}
      <div
        id="contrato-print"
        className="mx-auto max-w-[800px] rounded-xl border border-slate-200 bg-white p-8 sm:p-12 text-slate-900 shadow-sm print:m-0 print:w-full print:max-w-none print:rounded-none print:border-none print:bg-white print:p-0 print:shadow-none"
        style={{ fontFamily: "'Segoe UI', Arial, Helvetica, sans-serif", lineHeight: 1.5 }}
      >
        {/* CABEÇALHO DO CONTRATO */}
        <div className="flex items-center justify-between border-b-2 border-slate-800 pb-5">
          <div className="flex items-center gap-4">
            <Image
              src="/brand/logo-orcamento.png"
              alt="Logo Toldos Print"
              width={160}
              height={70}
              className="h-14 w-auto object-contain"
              priority
            />
          </div>
          <div className="text-right">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
              Contrato de Prestação de Serviços
            </h1>
            <div className="mt-1 flex flex-wrap justify-end gap-x-3 text-xs sm:text-sm font-semibold text-slate-600">
              <span>Contrato nº <strong className="text-slate-900">CTR-{numeroFormatado}</strong></span>
              <span>•</span>
              <span>Orçamento nº <strong className="text-slate-900">{numeroFormatado}</strong></span>
              <span>•</span>
              <span>Data: <strong className="text-slate-900">{formatarData(dataReferencia)}</strong></span>
            </div>
          </div>
        </div>

        {/* CORPO DO CONTRATO COM AS 8 CLÁUSULAS */}
        <div className="mt-6 space-y-5 text-[11.5px] sm:text-[12.5px] leading-relaxed text-slate-800 text-justify">
          
          {/* CLÁUSULA 1 */}
          <section className="print-avoid-break">
            <h2 className="text-xs sm:text-sm font-black text-slate-950 uppercase border-b border-slate-300 pb-1 mb-2 tracking-wide flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-slate-900 text-white inline-flex items-center justify-center text-[11px] font-bold shrink-0">1</span>
              Identificação das Partes
            </h2>
            <div className="space-y-1.5 pl-2 text-slate-800">
              <p>
                <strong className="text-slate-950">CONTRATADA:</strong> TOLDOS PRINT & COMUNICAÇÃO VISUAL LTDA, nome fantasia <strong>TOLDOSPRINT</strong>, inscrita no CNPJ sob o nº <strong>09.141.206/0001-06 / 63.177.134/0001-00</strong>, com sede e endereço na <strong>Av. João Quiuqui, Centro, Águia Branca – ES, CEP 29795-000</strong>, representada por Kaio (Administrador / Responsável Técnico). Telefones de contato: <strong>(27) 99748-9714</strong> e <strong>(27) 99612-5835</strong>.
              </p>
              <p>
                <strong className="text-slate-950">CONTRATANTE:</strong> <strong>{cliente?.nome || "Cliente não informado"}</strong>
                {cliente?.cpf && <>, inscrito(a) no CPF/CNPJ sob o nº <strong>{cliente.cpf}</strong></>}
                {cliente?.telefone && <>, telefone: <strong>{cliente.telefone}</strong></>}
                {cliente?.email && <>, e-mail: <strong>{cliente.email}</strong></>}.
              </p>
            </div>
          </section>

          {/* CLÁUSULA 2 */}
          <section className="print-avoid-break">
            <h2 className="text-xs sm:text-sm font-black text-slate-950 uppercase border-b border-slate-300 pb-1 mb-2 tracking-wide flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-slate-900 text-white inline-flex items-center justify-center text-[11px] font-bold shrink-0">2</span>
              Serviço Contratado
            </h2>
            <div className="space-y-2 pl-2 text-slate-800">
              <p>
                <strong>Serviço e etapas incluídas:</strong> Criação/adequação de arte, fabricação especializada, fornecimento de materiais, acabamentos e entrega/instalação
                {orcamento.item.instalacao?.incluida ? " (com equipe e instalação inclusas)" : " (entrega conforme acordado)"}.
              </p>
              <p>
                <strong>Local da entrega ou instalação:</strong>{" "}
                <span className="print:hidden">
                  <input
                    type="text"
                    value={localInstalacao}
                    onChange={(e) => setLocalInstalacao(e.target.value)}
                    className="w-full mt-1 px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:border-slate-600 bg-slate-50"
                  />
                </span>
                <span className="hidden print:inline font-semibold">{localInstalacao}</span>
              </p>
              
              {/* Discriminação técnica */}
              <div className="rounded border border-slate-200 bg-slate-50 p-2.5 space-y-1 text-xs">
                <p className="font-bold text-slate-900">Especificações Técnicas e Medidas:</p>
                <ul className="list-disc list-inside space-y-0.5 text-slate-700">
                  <li>
                    <strong>Item Principal:</strong> {nomeMaterial} — Dimensões: {orcamento.item.largura.toFixed(2)}m × {orcamento.item.altura.toFixed(2)}m (Total: {(orcamento.item.largura * orcamento.item.altura * orcamento.item.quantidadeUnidades).toFixed(2)} m², Qtd: {orcamento.item.quantidadeUnidades} un).
                  </li>
                  {nomesAcabamentos && (
                    <li><strong>Acabamentos:</strong> {nomesAcabamentos}.</li>
                  )}
                  {nomeServico && (
                    <li><strong>Serviço/Mão de Obra:</strong> {nomeServico}.</li>
                  )}
                  {(orcamento.item.itensAdicionais ?? []).map((ad, idx) => (
                    <li key={idx}>
                      <strong>Item Adicional #{idx + 2}:</strong> {ad.materialFechado?.nome || "Material extra"} — {ad.largura.toFixed(2)}m × {ad.altura.toFixed(2)}m (Qtd: {ad.quantidadeUnidades} un).
                    </li>
                  ))}
                </ul>
              </div>

              <p>
                <strong>Itens fora do orçamento:</strong> Nenhum, salvo solicitação de itens extras ou alteração de medidas formalizadas previamente entre as partes.
              </p>
              <p className="italic text-slate-600">
                O orçamento discriminado nº <strong>{numeroFormatado}</strong> e a arte/projeto aprovado integram este contrato para todos os fins. A aprovação da arte deve identificar a versão e ficar registrada por escrito. Qualquer alteração de escopo, medidas, valor ou prazo exige acordo prévio por escrito.
              </p>
            </div>
          </section>

          {/* CLÁUSULA 3 */}
          <section className="print-avoid-break">
            <h2 className="text-xs sm:text-sm font-black text-slate-950 uppercase border-b border-slate-300 pb-1 mb-2 tracking-wide flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-slate-900 text-white inline-flex items-center justify-center text-[11px] font-bold shrink-0">3</span>
              Valor e Pagamento
            </h2>
            <div className="space-y-2 pl-2 text-slate-800">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-2.5 rounded border border-slate-200 text-xs font-semibold">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Materiais</span>
                  <span className="text-slate-900">{formatarMoeda(valorMateriais)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Mão de Obra / Serviços</span>
                  <span className="text-slate-900">{formatarMoeda(valorMaoDeObra)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Outros / Ajustes</span>
                  <span className="text-slate-900">{formatarMoeda(orcamento.ajusteManual || 0)}</span>
                </div>
                <div className="border-l border-slate-300 pl-2">
                  <span className="text-[10px] text-slate-700 uppercase block font-bold">Total do Contrato</span>
                  <span className="text-sm font-black text-slate-950">{formatarMoeda(totalFinal)}</span>
                </div>
              </div>

              <p>
                <strong>Condição de pagamento sugerida:</strong> Entrada de 50% (<strong>{formatarMoeda(valorEntrada)}</strong>) no ato do fechamento/aprovação deste contrato e saldo remanescente de 50% (<strong>{formatarMoeda(valorSaldo)}</strong>) na entrega ou conclusão da instalação, conforme o escopo. 
              </p>
              <p className="text-slate-700">
                Formas aceitas: PIX, Transferência, Boleto Bancário ou Cartão de Crédito conforme condições e parcelamentos comerciais combinados com a TOLDOSPRINT.
              </p>
            </div>
          </section>

          {/* CLÁUSULA 4 */}
          <section className="print-avoid-break">
            <h2 className="text-xs sm:text-sm font-black text-slate-950 uppercase border-b border-slate-300 pb-1 mb-2 tracking-wide flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-slate-900 text-white inline-flex items-center justify-center text-[11px] font-bold shrink-0">4</span>
              Prazo e Condições de Execução
            </h2>
            <div className="space-y-1.5 pl-2 text-slate-800">
              <p>
                <strong>Início previsto:</strong> A partir da confirmação do pagamento da entrada e aprovação formal da arte/projeto gráfico.
              </p>
              <p>
                <strong>Prazo estimado de conclusão:</strong>{" "}
                <span className="print:hidden">
                  <input
                    type="text"
                    value={prazoExecucao}
                    onChange={(e) => setPrazoExecucao(e.target.value)}
                    className="w-full mt-1 px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:border-slate-600 bg-slate-50"
                  />
                </span>
                <span className="hidden print:inline font-semibold">{prazoExecucao}</span>.
              </p>
              <p>
                <strong>Condições para início:</strong> Confirmação de entrada, validação de medidas no local, aprovação formal da arte e liberação de acesso seguro ao local. Se um impedimento técnico ou climático afetar a execução, a parte que o identificar comunicará a outra imediatamente, registrando-se a nova data por escrito.
              </p>
              <p>
                Quando houver instalação, o CONTRATANTE deve liberar o acesso e informar restrições do local (horários, pontos elétricos ou tubulações embutidas). A CONTRATADA verifica as condições visíveis antes de iniciar e comunica qualquer impedimento que comprometa a instalação. Adaptações de alvenaria e autorizações condominiais/municipais ficam a cargo do CONTRATANTE.
              </p>
            </div>
          </section>

          {/* CLÁUSULA 5 */}
          <section className="print-avoid-break">
            <h2 className="text-xs sm:text-sm font-black text-slate-950 uppercase border-b border-slate-300 pb-1 mb-2 tracking-wide flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-slate-900 text-white inline-flex items-center justify-center text-[11px] font-bold shrink-0">5</span>
              Entrega e Conferência
            </h2>
            <div className="pl-2 text-slate-800">
              <p>
                Na entrega ou conclusão da instalação, as partes conferem o serviço conjuntamente com base no orçamento e registram por escrito eventuais pendências e os prazos razoáveis para correções. A conferência não afasta os direitos previstos na legislação vigente.
              </p>
            </div>
          </section>

          {/* CLÁUSULA 6 */}
          <section className="print-avoid-break">
            <h2 className="text-xs sm:text-sm font-black text-slate-950 uppercase border-b border-slate-300 pb-1 mb-2 tracking-wide flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-slate-900 text-white inline-flex items-center justify-center text-[11px] font-bold shrink-0">6</span>
              Garantia e Atendimento
            </h2>
            <div className="space-y-1.5 pl-2 text-slate-800">
              <p>
                Aplicam-se as garantias legais cabíveis. Em relação de consumo, o prazo para reclamar de vícios aparentes ou de fácil constatação é de 90 (noventa) dias para produtos e serviços duráveis e de 30 (trinta) dias para os não duráveis, a contar da entrega ou do término do serviço. Para vício oculto, a contagem inicia-se no momento em que ficar evidenciado o defeito (art. 26 do Código de Defesa do Consumidor).
              </p>
              <p>
                A <strong>TOLDOSPRINT</strong> oferece <strong>garantia contratual de 3 (três) meses</strong>, contados da entrega ou da conclusão da instalação, conforme o serviço contratado. Ela cobre defeitos de fabricação ou falhas na fixação atribuíveis à CONTRATADA e complementa a garantia legal. O atendimento de garantia pode ser acionado diretamente pelos telefones <strong>(27) 99748-9714</strong> ou <strong>(27) 99612-5835</strong>.
              </p>
              <p className="text-slate-700 text-xs">
                <strong>Exclusões da cobertura:</strong> Defeitos preexistentes na parede, alvenaria ou na estrutura de apoio do imóvel (como trincas, infiltrações, umidade excessiva, esfarelamento ou fragilidade do suporte) ficam expressamente fora da cobertura quando forem a causa do problema. Caso a CONTRATADA identifique fragilidade comprometedora antes de iniciar, comunicará o fato e aguardará as correções pelo CONTRATANTE. A CONTRATADA responde por danos decorrentes de eventual falha própria de instalação.
              </p>
            </div>
          </section>

          {/* CLÁUSULA 7 */}
          <section className="print-avoid-break">
            <h2 className="text-xs sm:text-sm font-black text-slate-950 uppercase border-b border-slate-300 pb-1 mb-2 tracking-wide flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-slate-900 text-white inline-flex items-center justify-center text-[11px] font-bold shrink-0">7</span>
              Cancelamento e Direito de Arrependimento
            </h2>
            <div className="space-y-1 pl-2 text-slate-800">
              <p>
                O pedido de cancelamento deve ser registrado por escrito. Fora das hipóteses legais de arrependimento, as partes apurarão os valores proporcionalmente ao que já foi executado, aos materiais já impressos/cortados e aos custos operacionais comprovados, sem perda arbitrária ou automática da entrada.
              </p>
              <p>
                Nas contratações realizadas fora do estabelecimento comercial (via internet, WhatsApp ou telefone), o consumidor pode exercer o direito de arrependimento em até 7 (sete) dias corridos, contados da assinatura ou da contratação, nos termos do art. 49 do Código de Defesa do Consumidor, com devolução integral dos valores pagos, devidamente atualizados.
              </p>
            </div>
          </section>

          {/* CLÁUSULA 8 - ASSINATURAS */}
          <section className="pt-4 border-t border-slate-300 print-avoid-break">
            <h2 className="text-xs sm:text-sm font-black text-slate-950 uppercase border-b border-slate-300 pb-1 mb-4 tracking-wide flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-slate-900 text-white inline-flex items-center justify-center text-[11px] font-bold shrink-0">8</span>
              Assinaturas e Foro
            </h2>
            <p className="text-center font-bold text-slate-900 mb-8">
              Águia Branca – ES, {dataExtenso}.
            </p>

            {/* QUADRO DE ASSINATURA CONTRATADA E CONTRATANTE */}
            <div className="grid grid-cols-2 gap-8 text-center pt-2">
              {/* CONTRATADA */}
              <div className="flex flex-col items-center">
                <div className="h-16 flex items-end justify-center mb-1">
                  <Image
                    src="/brand/assinatura-kaio.png"
                    alt="Assinatura Kaio"
                    width={180}
                    height={50}
                    className="h-12 w-auto object-contain"
                  />
                </div>
                <div className="w-full border-t border-slate-900 pt-1.5">
                  <p className="font-bold text-slate-950 uppercase text-xs">CONTRATADA</p>
                  <p className="text-[11px] font-semibold text-slate-700">TOLDOS PRINT & COMUNICAÇÃO VISUAL</p>
                  <p className="text-[10px] text-slate-500">Kaio (Administrador / Responsável Técnico)</p>
                </div>
              </div>

              {/* CONTRATANTE */}
              <div className="flex flex-col items-center">
                <div className="h-16 flex items-end justify-center mb-1">
                  {assinaturaDigital ? (
                    <div className="flex flex-col items-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={assinaturaDigital}
                        alt="Assinatura Digital do Cliente"
                        className="h-12 max-w-[200px] object-contain"
                      />
                      <span className="text-[9px] text-emerald-700 font-semibold flex items-center gap-0.5">
                        <CheckCircle2 className="h-2.5 w-2.5 inline" />
                        Assinado digitalmente {dataAssinatura ? `em ${formatarData(dataAssinatura)}` : ""}
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-300 text-[11px] italic">Aguardando assinatura</span>
                  )}
                </div>
                <div className="w-full border-t border-slate-900 pt-1.5">
                  <p className="font-bold text-slate-950 uppercase text-xs">CONTRATANTE</p>
                  <p className="text-[11px] font-semibold text-slate-800">{cliente?.nome || "Cliente"}</p>
                  <p className="text-[10px] text-slate-500">
                    CPF/CNPJ: {cliente?.cpf || "__________________________"}
                  </p>
                </div>
              </div>
            </div>

            {/* TESTEMUNHAS (OPCIONAL) */}
            <div className="grid grid-cols-2 gap-8 text-center pt-8 mt-4 border-t border-dashed border-slate-300">
              <div>
                <div className="border-t border-slate-400 pt-1">
                  <p className="text-[10px] font-bold text-slate-700 uppercase">TESTEMUNHA 1 (Opcional)</p>
                  <p className="text-[9.5px] text-slate-500">Nome: _________________________________</p>
                  <p className="text-[9.5px] text-slate-500">CPF: __________________________________</p>
                </div>
              </div>
              <div>
                <div className="border-t border-slate-400 pt-1">
                  <p className="text-[10px] font-bold text-slate-700 uppercase">TESTEMUNHA 2 (Opcional)</p>
                  <p className="text-[9.5px] text-slate-500">Nome: _________________________________</p>
                  <p className="text-[9.5px] text-slate-500">CPF: __________________________________</p>
                </div>
              </div>
            </div>

            {/* ANEXOS */}
            <div className="mt-6 pt-3 border-t border-slate-200 text-center text-[10px] text-slate-500">
              <p>
                <strong>Anexos integrantes deste contrato:</strong> Orçamento discriminado nº {numeroFormatado}, projeto e arte aprovada pela CONTRATANTE, e termo de garantia legal e contratual.
              </p>
            </div>
          </section>

        </div>
      </div>

      {/* ESTILOS DE IMPRESSÃO EXECUTIVA A4 CLARA E LIMPA */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 14mm;
          }
          :root,
          .dark,
          html,
          body {
            background-color: #ffffff !important;
            background: #ffffff !important;
            color: #0f172a !important;
            --background: 0 0% 100% !important;
            --foreground: 222.2 84% 4.9% !important;
            --card: 0 0% 100% !important;
            --card-foreground: 222.2 84% 4.9% !important;
            --border: 214.3 31.8% 91.4% !important;
          }
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            background: #ffffff !important;
            color: #0f172a !important;
          }
          header, aside, nav, footer, button, .print\\:hidden {
            display: none !important;
          }
          .print-avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          #contrato-print {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
        }
      `}</style>
    </>
  )
}
