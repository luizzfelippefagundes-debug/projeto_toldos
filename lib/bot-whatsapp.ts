import { openai } from "@ai-sdk/openai"
import { generateText, stepCountIs, tool } from "ai"
import { z } from "zod"
import { getSql } from "./db"
import {
  atualizarConversa,
  destravarProcessamento,
  getOuCriarConversa,
  roubarTravaProcessamento,
  tentarTravarProcessamento,
  transferirAtendimento,
  type ConversaBot,
  type MensagemHistorico,
} from "./bot-conversa"
import { enviarDocumentoWhatsapp } from "./evolution-api"
import { formatarData, formatarMoeda } from "./format"
import { gerarPdfOrcamentoServidor } from "./pdf-orcamento-servidor"
import { formatarNumeroOrcamento } from "./orcamento-pdf"
import type { Orcamento, StatusPedidoRapido } from "./types"

const STATUS_PRODUCAO_LEGIVEL: Record<StatusPedidoRapido, string> = {
  aguardando: "aguardando aprovação",
  aprovado: "aprovado, entrando na fila de produção",
  arte: "em produção (arte)",
  impressao: "em produção (impressão)",
  acabamento: "em produção (acabamento)",
  pronto: "pronto, aguardando retirada/entrega",
  entregue: "entregue",
}

const SERVICOS_TEXTO = `COMUNICAÇÃO VISUAL:
- Adesivos comum
- Adesivos em recorte
- Banners
- Placas de identificação
- Placas de ACM 3D
- Fachadas de ACM
- Lonas
- Reformas de fachada
- Reformas de vitrines
- Rótulos
- Adesivo para carro
- Adesivo para moto
- Adesivo de parede
- Letras 3D
- Outdoor

TOLDOS E COBERTURAS:
- Toldos para janelas
- Toldos para varandas ou área de serviço
- Toldo fixo
- Toldo cortina (de enrolar)
- Toldos de policarbonato
- Coberturas de policarbonato
- Reformas de toldo`

export function normalizarTelefone(numero: string): string {
  return numero.replace(/\D/g, "")
}

export async function buscarClientePorTelefone(telefone: string): Promise<{ id: string; nome: string } | null> {
  const sql = getSql()
  const alvo = normalizarTelefone(telefone)
  const clientes = await sql`SELECT id, nome, telefone FROM clientes`
  const encontrado = clientes.find((c) => normalizarTelefone(c.telefone as string).endsWith(alvo.slice(-8)))
  return encontrado ? { id: encontrado.id as string, nome: encontrado.nome as string } : null
}

async function adquirirTrava(conversaInicial: ConversaBot): Promise<{ conversa: ConversaBot; travado: boolean }> {
  const TENTATIVAS = 5
  const INTERVALO_MS = 1000
  const LIMITE_TRAVA_PRESA_MS = 20_000

  let conversa = conversaInicial
  if (await tentarTravarProcessamento(conversa.id)) return { conversa, travado: true }

  for (let i = 0; i < TENTATIVAS; i++) {
    await new Promise((r) => setTimeout(r, INTERVALO_MS))
    conversa = await getOuCriarConversa(conversa.telefone)
    if (await tentarTravarProcessamento(conversa.id)) return { conversa, travado: true }
  }

  if (conversa.processandoDesde && Date.now() - new Date(conversa.processandoDesde).getTime() > LIMITE_TRAVA_PRESA_MS) {
    await roubarTravaProcessamento(conversa.id)
    return { conversa, travado: true }
  }
  return { conversa, travado: false }
}

export async function processarMensagemWhatsapp(telefone: string, textoRecebido: string): Promise<string | null> {
  const conversaInicial = await getOuCriarConversa(telefone)
  const { conversa, travado } = await adquirirTrava(conversaInicial)
  if (!travado) return "Só um segundo, já te respondo!"

  try {
    return await processarComTravaAdquirida(telefone, textoRecebido, conversa)
  } finally {
    await destravarProcessamento(conversa.id)
  }
}

async function processarComTravaAdquirida(
  telefone: string,
  textoRecebido: string,
  conversa: ConversaBot
): Promise<string | null> {
  // Depois de transferir pra um humano, o bot não responde mais nessa
  // conversa — só registra a mensagem (o webhook cuida disso) pro dono ver
  // na Central do Bot e responder pelo próprio WhatsApp dele.
  if (conversa.transferidoEm) return null

  const HORAS_PARA_EXPIRAR = 6
  const sessaoExpirada = Date.now() - new Date(conversa.atualizadoEm).getTime() > HORAS_PARA_EXPIRAR * 3600_000
  const historico: MensagemHistorico[] = sessaoExpirada ? [] : conversa.historico
  let nomeTemp = sessaoExpirada ? null : conversa.nomeTemp
  let localTemp = sessaoExpirada ? null : conversa.localTemp
  let transferido = false

  const systemPrompt = `Você é o atendente virtual da TOLDOSPRINT (Toldos e Comunicação Visual), respondendo pelo WhatsApp.

Converse como uma pessoa de verdade, mensagens curtas, sem soar robótico. Não repete saudação em toda mensagem.

Fluxo esperado numa conversa nova:
1. Dê boas-vindas: "Seja bem-vindo(a) à TOLDOSPRINT (Toldos e Comunicação Visual)!"
2. Pergunte o nome da pessoa e de qual cidade/bairro ela está falando. Assim que ela responder, chame salvar_dados_cliente.
3. Pergunte "Como posso te ajudar?" — se ela não souber bem o que quer, mostre a lista de serviços mais procurados abaixo (uma categoria por linha).
4. Deixe a pessoa explicar o que precisa, com suas próprias palavras.
5. Se parecer um pedido de orçamento, sugira: tirar uma foto do local/peça, e ter em mãos as medidas ou um projeto, pra facilitar o orçamento.
6. Avise que já está te transferindo pro atendente, e chame transferir_atendimento com um resumo curto do que a pessoa pediu (nome, local, o que quer). A partir daí, não responda mais nessa conversa — quem continua é o atendente humano.

Lista de serviços (mostre quando perguntarem "o que vocês fazem" ou algo vago):
${SERVICOS_TEXTO}

Outras coisas que você pode resolver sem transferir:
- Se perguntarem do status de um orçamento já feito ("cadê meu orçamento", "já ficou pronto?"), chame consultar_status_orcamento — não precisa pedir número, já busca pelo telefone de quem está mandando mensagem.
- Se pedirem o PDF do orçamento ("manda o orçamento", "quero o pdf"), chame enviar_pdf_orcamento.
- Se o assunto não tiver nada a ver com a loja, responda com simpatia e puxe de volta.

Regras:
- Pergunte uma coisa de cada vez.
- Chame no máximo UMA ferramenta por resposta.
- Nunca invente status, valor ou prazo de orçamento — se consultar_status_orcamento não achar nada, diga isso ao cliente.`

  const tools = {
    salvar_dados_cliente: tool({
      description: "Salva o nome e a cidade/bairro informados pelo cliente no começo da conversa.",
      inputSchema: z.object({ nome: z.string(), local: z.string().optional() }),
      execute: async ({ nome, local }) => {
        nomeTemp = nome
        if (local) localTemp = local
        return { ok: true }
      },
    }),
    consultar_status_orcamento: tool({
      description: "Consulta os orçamentos mais recentes desse cliente, pelo telefone de quem está mandando a mensagem.",
      inputSchema: z.object({}),
      execute: async () => {
        const cliente = await buscarClientePorTelefone(telefone)
        if (!cliente) return { orcamentos: [], mensagem: "Não encontrei nenhum cadastro com esse telefone." }
        const sql = getSql()
        const rows = await sql`
          SELECT numero, status, status_producao, total_fechado, criado_em, validade_dias
          FROM orcamentos WHERE cliente_id = ${cliente.id} ORDER BY numero DESC LIMIT 5
        `
        if (rows.length === 0) return { orcamentos: [], mensagem: "Não encontrei orçamento nenhum pra esse cliente." }
        return {
          orcamentos: rows.map((o) => ({
            numero: o.numero,
            status: o.status === "aberto" ? "ainda não fechado" : o.status === "fechado" ? "fechado" : "cancelado",
            etapaProducao: o.status_producao
              ? STATUS_PRODUCAO_LEGIVEL[o.status_producao as StatusPedidoRapido]
              : undefined,
            valor: o.total_fechado ? formatarMoeda(Number(o.total_fechado)) : undefined,
            feitoEm: formatarData(o.criado_em as string),
          })),
        }
      },
    }),
    enviar_pdf_orcamento: tool({
      description: "Gera e manda pro cliente, no próprio WhatsApp, o PDF do orçamento fechado mais recente dele.",
      inputSchema: z.object({}),
      execute: async () => {
        const cliente = await buscarClientePorTelefone(telefone)
        if (!cliente) return { erro: "Não encontrei nenhum cadastro com esse telefone." }
        const sql = getSql()
        const rows = await sql`
          SELECT * FROM orcamentos WHERE cliente_id = ${cliente.id} AND status = 'fechado'
          ORDER BY numero DESC LIMIT 1
        `
        if (rows.length === 0) return { erro: "Esse cliente não tem orçamento fechado ainda." }
        const r = rows[0]
        const orcamento = {
          id: r.id,
          numero: r.numero,
          clienteId: r.cliente_id,
          item: r.item,
          materialFechado: r.material_fechado,
          totalFechado: r.total_fechado ? Number(r.total_fechado) : undefined,
          ajusteManual: Number(r.ajuste_manual ?? 0),
          anexoNome: r.anexo_nome,
          status: r.status,
          criadoEm: r.criado_em,
          fechadoEm: r.fechado_em,
          validadeDias: r.validade_dias ?? undefined,
        } as Orcamento
        const pdf = await gerarPdfOrcamentoServidor(orcamento, cliente.nome)
        await enviarDocumentoWhatsapp(
          telefone,
          pdf.toString("base64"),
          `Orcamento-${formatarNumeroOrcamento(orcamento.numero, orcamento.criadoEm)}.pdf`,
          `Segue o orçamento nº ${orcamento.numero} da Toldos Print 🙂`
        )
        return { ok: true }
      },
    }),
    transferir_atendimento: tool({
      description: "Avisa o cliente que vai transferir, e passa o atendimento pra um humano — chame só depois de avisar.",
      inputSchema: z.object({ resumo: z.string().describe("Nome, local e o que a pessoa pediu, pro atendente ler rápido") }),
      execute: async ({ resumo }) => {
        transferido = true
        return { ok: true, resumo }
      },
    }),
  }

  const { text } = await generateText({
    model: openai("gpt-4.1"),
    system: systemPrompt,
    messages: [
      ...historico.map((h) => ({ role: h.role, content: h.content }) as const),
      { role: "user" as const, content: textoRecebido },
    ],
    tools,
    stopWhen: stepCountIs(4),
  })

  const resposta = text.trim() || "Desculpa, não entendi — pode repetir?"
  const novoHistorico = [...historico, { role: "user" as const, content: textoRecebido }, { role: "assistant" as const, content: resposta }]

  await atualizarConversa(conversa.id, { nomeTemp, localTemp, historico: novoHistorico })
  if (transferido) await transferirAtendimento(conversa.id)

  return resposta
}
