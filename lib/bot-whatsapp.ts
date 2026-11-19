import { google } from "@ai-sdk/google"
import { openai } from "@ai-sdk/openai"
import { generateText, stepCountIs, tool } from "ai"
import { z } from "zod"
import { getSql } from "./db"
import {
  atualizarConversa,
  destravarProcessamento,
  getOuCriarConversa,
  reabrirBot,
  roubarTravaProcessamento,
  tentarTravarProcessamento,
  transferirAtendimento,
  type ConversaBot,
  type MensagemHistorico,
} from "./bot-conversa"
import { enviarDocumentoWhatsapp, enviarMensagemWhatsapp } from "./evolution-api"
import { formatarData, formatarMoeda } from "./format"
import { gerarPdfOrcamentoServidor } from "./pdf-orcamento-servidor"
import { formatarNumeroOrcamento } from "./orcamento-pdf"
import type { Orcamento, StatusPedidoRapido } from "./types"

const STATUS_PRODUCAO_LEGIVEL: Record<StatusPedidoRapido, string> = {
  aguardando: "aguardando aprovação",
  aprovado: "aprovado, entrando na fila de produção",
  arte: "em produção (arte)",
  ag_confirmacao: "aguardando aprovação da arte pelo cliente",
  impressao: "em produção (impressão)",
  acabamento: "em produção (acabamento)",
  pronto: "pronto, aguardando retirada/entrega",
  entregue: "entregue",
}

export const SERVICOS_TEXTO = `SERVIÇOS mais utilizados:

COMUNICAÇÃO VISUAL:
- adesivos comum
- adesivos em recorte
- banners
- placas de identificação
- placas de ACM 3D
- fachadas de ACM
- lonas
- reformas de fachada
- reformas de vitrines
- rótulos
- adesivos para carro
- adesivo para moto
- adesivo de parede
- letras 3D
- outdoor

TOLDOS E COBERTURAS:
- toldos para janelas
- toldos para varandas ou área de serviço
- toldos fixo
- toldo cortina (de enrolar)
- toldos de policarbonato
- coberturas de policarbonato
- reformas de toldo`

export function normalizarTelefone(numero: string): string {
  return numero.replace(/\D/g, "")
}

export function formatarTelefoneBrasil(tel: string): string {
  const d = tel.replace(/\D/g, "")
  const semPais = d.startsWith("55") && d.length >= 12 ? d.slice(2) : d
  if (semPais.length === 11) {
    return `(${semPais.slice(0, 2)}) ${semPais.slice(2, 7)}-${semPais.slice(7)}`
  }
  if (semPais.length === 10) {
    return `(${semPais.slice(0, 2)}) ${semPais.slice(2, 6)}-${semPais.slice(6)}`
  }
  return tel
}

export async function buscarClientePorTelefone(telefone: string): Promise<{ id: string; nome: string } | null> {
  const sql = getSql()
  const alvo = normalizarTelefone(telefone)
  const clientes = await sql`SELECT id, nome, telefone FROM clientes`
  const encontrado = clientes.find((c) => normalizarTelefone(c.telefone as string).endsWith(alvo.slice(-8)))
  return encontrado ? { id: encontrado.id as string, nome: encontrado.nome as string } : null
}

export async function criarClienteAutomaticoSeNaoExistir({
  telefone,
  pushName,
}: {
  telefone: string
  pushName?: string
}): Promise<{ id: string; nome: string; criadoNovo: boolean }> {
  const clienteExistente = await buscarClientePorTelefone(telefone)
  if (clienteExistente) {
    return { ...clienteExistente, criadoNovo: false }
  }

  const sql = getSql()
  const id = crypto.randomUUID()
  const telFormatado = formatarTelefoneBrasil(telefone)
  const nomeFinal = pushName?.trim() || `Cliente ${telFormatado}`

  await sql`
    INSERT INTO clientes (id, nome, telefone, email, cpf)
    VALUES (${id}, ${nomeFinal}, ${telFormatado}, null, null)
  `

  return { id, nome: nomeFinal, criadoNovo: true }
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

export const STOPWORDS_NOME = new Set([
  "qu", "qual", "quanto", "quando", "onde", "como", "quem", "por", "que", "pra", "pro",
  "oi", "ola", "opa", "eai", "fala", "alo", "bom", "dia", "boa", "tarde", "noite",
  "sim", "nao", "ok", "beleza", "blz", "fechou", "vamos", "valeu", "obrigado", "obrigada",
  "quero", "queria", "gostaria", "preciso", "precisava", "favor", "porfavor",
  "tem", "voce", "voces", "toldo", "toldos", "banner", "banners", "lona", "lonas",
  "placa", "placas", "adesivo", "adesivos", "fachada", "fachadas", "letra", "letras",
  "preco", "precos", "valor", "valores", "orcamento", "orcamentos", "reforma", "reformas",
  "teste", "testes", "testando", "nada", "tudo", "mais", "menos", "aqui", "grupo", "fazer",
  "marcar", "vincular", "vinculado"
])

export function ehNomeValido(nome?: string | null): boolean {
  if (!nome) return false
  const limpo = nome.trim()
  if (limpo.length < 3) return false
  if (limpo.length > 40) return false
  if (/[\d?!@#$%^&*()_+={}\[\]:;"'<>/\\]/.test(limpo)) return false
  const primeiraPalavra = limpo.toLowerCase().split(/\s+/)[0]
  if (STOPWORDS_NOME.has(primeiraPalavra)) return false
  return true
}

export async function processarMensagemWhatsapp(
  telefone: string,
  textoRecebido: string,
  pushName?: string | null
): Promise<string | null> {
  const conversaInicial = await getOuCriarConversa(telefone)
  const { conversa, travado } = await adquirirTrava(conversaInicial)
  if (!travado) return "Só um segundo, já te respondo!"

  try {
    return await processarComTravaAdquirida(telefone, textoRecebido, conversa, pushName)
  } finally {
    await destravarProcessamento(conversa.id)
  }
}

export function resolverFluxoAtendimento(
  textoRecebido: string,
  historico: MensagemHistorico[],
  nomeSalvo?: string | null,
  localSalvo?: string | null,
  pushName?: string | null
): { resposta: string; nome?: string; local?: string; transferir?: boolean } {
  const limpo = textoRecebido.trim().toLowerCase()
  const eSaudacao = /^(oi+|ol[aá]+|e a[ií]|bom dia|boa tarde|boa noite|hey|hello|al[oô]+|opa|fala)[\s!?.]*$/i.test(limpo)
  const pedeOrcamento = /(or[çc]amento|pre[çc]o|valor|quanto|custa|fazer|produzir|toldo|toldos|adesivo|adesivos|placa|placas|lona|lonas|fachada|fachadas|banner|banners|faixa|faixas|letra|letras|3d|reforma|reformas|cobertura|coberturas|outdoor|outdoors|totem|totens|painel|paineis|painéis|rotulo|rotulos|rótulo|rótulos|vitrine|vitrines|envelopamento|acm|luminoso|luminosos|cortina|policarbonato|janela|varanda|tapume|comprar|encomendar)/i.test(limpo)
  const pedePix = /(pix|chave pix|copia e cola|como pagar|como pago|forma de pagamento|dados bancarios|mercado pago)/i.test(limpo)

  // 1. Dúvida sobre pagamento / Pix
  if (pedePix) {
    const chavePix = process.env.PIX_CHAVE_EMPRESA || "(27) 99748-9714"
    return {
      resposta:
        "💳 *PAGAMENTO VIA PIX (Mercado Pago / Banco):*\n\n" +
        `Nossa chave PIX oficial é o telefone celular:\n👉 *${chavePix}*\n` +
        "Favorecido: *Toldos Print (Comunicação Visual e Toldos)*\n\n" +
        "Assim que realizar o pagamento, pode mandar o comprovante por aqui mesmo que confirmamos o seu pedido na hora! 🤝✨",
    }
  }

  // Se o bot já apresentou o menu de serviços na conversa, NUNCA mais repete a lista!
  // Qualquer resposta do cliente agora é o produto/serviço que ele deseja ou dúvida dele.
  const jaEnviouServicos = historico.some(
    (h) =>
      h.role === "assistant" &&
      (h.content.includes("SERVIÇOS mais utilizados") || h.content.includes("Como posso te ajudar?"))
  )

  const nomeEfetivo = (ehNomeValido(nomeSalvo) ? nomeSalvo : null) || (ehNomeValido(pushName) ? pushName : null)

  if (jaEnviouServicos && !eSaudacao) {
    const nomeParaMsg = nomeEfetivo ? `, ${nomeEfetivo}` : ""
    return {
      resposta:
        `Perfeito${nomeParaMsg}! Para facilitar e agilizar o seu orçamento:\n` +
        `📸 Tire uma foto do que se trata ou deseja;\n` +
        `📏 Tenha em mãos medidas ou projetos para facilitar no orçamento.\n\n` +
        `Já estou transferindo o seu atendimento para nossa equipe. Em breve vamos entrar em contato com você por aqui! ⏳🧑‍💼`,
      nome: nomeEfetivo || undefined,
      local: localSalvo || undefined,
      transferir: true,
    }
  }

  // 2. Início de conversa ou saudação simples (sem pedido específico)
  if ((historico.length === 0 && !pedeOrcamento) || eSaudacao) {
    return {
      resposta:
        "Seja bem-vindo a TOLDOSPRINT (Toldos e Comunicação Visual)! 🤝✨\n\nQual seu nome e de qual cidade, bairro está falando?",
    }
  }

  // 3. Se ainda não temos o nome ou o local, tenta extrair da resposta
  if (!nomeEfetivo || !localSalvo) {
    let nomeExtraido = nomeEfetivo || undefined
    let localExtraido = localSalvo || undefined

    const mSou = /(?:sou\s+(?:o|a)?\s*|me\s*chamo\s*|meu\s*nome\s*[ée]\s*)([a-zA-ZçÇáéíóúÁÉÍÓÚ\s]{3,30})/i.exec(textoRecebido)
    if (mSou && ehNomeValido(mSou[1].trim())) {
      nomeExtraido = mSou[1].trim()
    } else if (!nomeEfetivo && !pedeOrcamento) {
      // Só aceita como nome se o bot acabou de perguntar o nome e a resposta for curta e válida
      const ultimaPerguntaPediuNome =
        historico.length > 0 &&
        historico[historico.length - 1].role === "assistant" &&
        historico[historico.length - 1].content.includes("Qual seu nome")
      if (ultimaPerguntaPediuNome && textoRecebido.split(/\s+/).length <= 3) {
        const candidato = textoRecebido.split(/[,de\s]+/)[0].trim()
        if (ehNomeValido(candidato)) {
          nomeExtraido = candidato
        }
      }
    }

    const mLocal = /(?:de|em|moro em|falando de|cidade)\s+([a-zA-ZçÇáéíóúÁÉÍÓÚ\s/-]{3,30})/i.exec(textoRecebido)
    if (mLocal) {
      localExtraido = mLocal[1].trim()
    }

    if (pedeOrcamento) {
      const nomeParaMsg = (nomeExtraido || nomeEfetivo) ? `, ${nomeExtraido || nomeEfetivo}` : ""
      return {
        resposta:
          `Perfeito${nomeParaMsg}! Para facilitar e agilizar o seu orçamento:\n` +
          `📸 Tire uma foto do que se trata ou deseja;\n` +
          `📏 Tenha em mãos medidas ou projetos para facilitar no orçamento.\n\n` +
          `Já estou transferindo o seu atendimento para nossa equipe. Em breve vamos entrar em contato com você por aqui! ⏳🧑‍💼`,
        nome: nomeExtraido,
        local: localExtraido,
        transferir: true,
      }
    }

    const nomeParaMsg = (nomeExtraido || nomeEfetivo) ? `, ${nomeExtraido || nomeEfetivo}` : ""
    return {
      resposta:
        `Prazer${nomeParaMsg}!\n\n` +
        `${SERVICOS_TEXTO}\n\n` +
        `Como posso te ajudar?`,
      nome: nomeExtraido,
      local: localExtraido,
    }
  }

  // 4. Se já tinha nome ou solicitou produto/orçamento:
  const nomeParaMsg = nomeEfetivo ? `, ${nomeEfetivo}` : ""
  return {
    resposta:
      `Perfeito${nomeParaMsg}! Para facilitar e agilizar o seu orçamento:\n` +
      `📸 Tire uma foto do que se trata ou deseja;\n` +
      `📏 Tenha em mãos medidas ou projetos para facilitar no orçamento.\n\n` +
      `Já estou transferindo o seu atendimento para nossa equipe. Em breve vamos entrar em contato com você por aqui! ⏳🧑‍💼`,
    transferir: true,
  }
}

async function processarComTravaAdquirida(
  telefone: string,
  textoRecebido: string,
  conversa: ConversaBot,
  pushName?: string | null
): Promise<string | null> {
  const limpo = textoRecebido.trim().toLowerCase()
  const comandoReiniciar = /^(#?reset|#?reiniciar|#?novo|#?inicio|#?menu)$/i.test(limpo)
  const eSaudacao = /^(oi+|ol[aá]+|e a[ií]|bom dia|boa tarde|boa noite|hey|hello|al[oô]+|opa|fala)[\s!?.]*$/i.test(limpo)

  // Depois de transferir pra um humano, o bot silencia pra dar espaço ao atendimento.
  // Mas se o usuário mandar #reiniciar/#reset, ou passou > 2h e mandou saudação,
  // ou a transferência expirou (> 4h), o bot reabre o atendimento automaticamente.
  if (conversa.transferidoEm) {
    const HORAS_TRANSFERENCIA_EXPIRAR = 4
    const tempoDesdeTransferencia = Date.now() - new Date(conversa.transferidoEm).getTime()
    const expirou = tempoDesdeTransferencia > HORAS_TRANSFERENCIA_EXPIRAR * 3600_000

    if (comandoReiniciar || (eSaudacao && tempoDesdeTransferencia > 2 * 3600_000) || expirou) {
      await reabrirBot(conversa.id)
      conversa.transferidoEm = null
    } else {
      return null
    }
  }

  const HORAS_PARA_EXPIRAR = 6
  const sessaoExpirada = Date.now() - new Date(conversa.atualizadoEm).getTime() > HORAS_PARA_EXPIRAR * 3600_000
  const reiniciar = comandoReiniciar || sessaoExpirada || (eSaudacao && conversa.historico.length > 0)
  const historico: MensagemHistorico[] = reiniciar ? [] : conversa.historico
  let nomeTemp = reiniciar
    ? null
    : (ehNomeValido(conversa.nomeTemp) ? conversa.nomeTemp : null) || (ehNomeValido(pushName) ? pushName : null)
  let localTemp = reiniciar ? null : conversa.localTemp
  let transferido = false

  const systemPrompt = `Você é o atendente virtual da TOLDOSPRINT (Toldos e Comunicação Visual), respondendo pelo WhatsApp de forma profissional, ágil e acolhedora.

FLUXO EXATO DA CONVERSA:

Passo 1 (Saudação Inicial):
Se a conversa estiver começando (ou o cliente mandou apenas "oi", "olá", "bom dia", etc. sem dados):
Diga exatamente:
"Seja bem-vindo a TOLDOSPRINT (Toldos e Comunicação Visual)! 🤝✨

Qual seu nome e de qual cidade, bairro está falando?"

Passo 2 (Apresentação dos Serviços):
Assim que o cliente informar o nome e a cidade/bairro (chame a ferramenta salvar_dados_cliente):
Agradeça pelo nome e apresente os serviços mais procurados exatamente no formato abaixo:
"Prazer, [Nome do Cliente]!

${SERVICOS_TEXTO}

Como posso te ajudar?"

Passo 3 (Solicitação de Orçamento e Transferência):
Quando o cliente disser o que precisa ou solicitar um orçamento de qualquer produto/serviço:
Diga com simpatia:
"Perfeito! Para facilitar e agilizar o seu orçamento:
📸 Tire uma foto do que se trata ou deseja;
📏 Tenha em mãos medidas ou projetos (se tiver).

Já estou transferindo o seu atendimento para nossa equipe. Em breve vamos entrar em contato com você por aqui! ⏳🧑‍💼"

Em seguida, chame IMEDIATAMENTE a ferramenta transferir_atendimento com o resumo do pedido (nome, cidade/bairro e o que ele deseja).

OUTRAS CONSULTAS RÁPIDAS (Sem transferir):
- Se o cliente perguntar o status de um orçamento que ele já fez ("cadê meu orçamento", "já ficou pronto?"), chame consultar_status_orcamento.
- Se pedir o PDF do orçamento ("manda o orçamento", "quero o pdf"), chame enviar_pdf_orcamento.

REGRAS GERAIS:
- Não fique repetindo saudações desnecessárias.
- Seja direto, claro e educado.
- Se o cliente já mandar tudo na primeira mensagem (ex: "Sou João de Colatina e quero toldo cortina"), já salve os dados, apresente a orientação de fotos/medidas e transfira de uma vez.`

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
        // Notifica o dono/atendente da empresa no WhatsApp se configurado
        const telEmpresa = process.env.WHATSAPP_EMPRESA_NUMERO
        if (telEmpresa) {
          const nomeNotif =
            (ehNomeValido(nomeTemp) ? nomeTemp : null) ||
            (ehNomeValido(pushName) ? pushName : null) ||
            "Não informado"
          const alerta = `🔔 *Novo Atendimento Transferido!*\n\n👤 *Cliente:* ${nomeNotif}\n📍 *Local:* ${localTemp || "Não informado"}\n📱 *WhatsApp:* ${formatarTelefoneBrasil(telefone)}\n💬 *Interesse:* ${resumo}\n\n👉 Acesse o WhatsApp para responder!`
          enviarMensagemWhatsapp(telEmpresa, alerta).catch((err) =>
            console.error("[bot] erro ao notificar empresa de transferência:", err)
          )
        }
        return { ok: true, resumo }
      },
    }),
  }

  // 1. O fluxo determinístico oficial da empresa tem prioridade absoluta:
  // Resposta instantânea (0ms), sem custo, sem falha de rede e 100% no padrão solicitado.
  const reg = resolverFluxoAtendimento(textoRecebido, historico, nomeTemp, localTemp, pushName)
  let respostaFinal: string = reg.resposta

  if (reg.nome && !nomeTemp && ehNomeValido(reg.nome)) nomeTemp = reg.nome
  if (reg.local && !localTemp) localTemp = reg.local
  if (reg.transferir) {
    transferido = true
    const telEmpresa = process.env.WHATSAPP_EMPRESA_NUMERO
    if (telEmpresa) {
      const nomeNotif =
        (ehNomeValido(nomeTemp) ? nomeTemp : null) ||
        (ehNomeValido(pushName) ? pushName : null) ||
        "Não informado"
      const alerta = `🔔 *Novo Atendimento Transferido!*\n\n👤 *Cliente:* ${nomeNotif}\n📍 *Local:* ${localTemp || "Não informado"}\n📱 *WhatsApp:* ${formatarTelefoneBrasil(telefone)}\n💬 *Interesse:* ${textoRecebido}\n\n👉 Acesse o WhatsApp para responder!`
      enviarMensagemWhatsapp(telEmpresa, alerta).catch((e) =>
        console.error("[bot] erro ao notificar empresa:", e)
      )
    }
  }

  // 2. Se não houver resposta de regra predefinida e tivermos modelo de IA, tenta com timeout de segurança
  if (!respostaFinal) {
    const chaveOpenAIValida =
      process.env.OPENAI_API_KEY &&
      process.env.OPENAI_API_KEY.startsWith("sk-") &&
      !process.env.OPENAI_API_KEY.includes("SENSITIVE")
    const chaveGeminiValida =
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      (process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes("SENSITIVE"))

    const modelo = chaveOpenAIValida
      ? openai("gpt-4o")
      : chaveGeminiValida
      ? google("gemini-2.0-flash")
      : null

    if (modelo) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 6000)
        const { text } = await generateText({
          model: modelo,
          system: systemPrompt,
          messages: [
            ...historico.map((h) => ({ role: h.role, content: h.content }) as const),
            { role: "user" as const, content: textoRecebido },
          ],
          tools,
          abortSignal: controller.signal,
        })
        clearTimeout(timeout)
        if (text && text.trim().length > 0) {
          respostaFinal = text.trim()
        }
      } catch (err: any) {
        console.warn("[bot-whatsapp] Falha na chamada da IA:", err?.message)
      }
    }
  }

  if (!respostaFinal) {
    respostaFinal =
      "Seja bem-vindo a TOLDOSPRINT (Toldos e Comunicação Visual)! 🤝✨\n\nQual seu nome e de qual cidade, bairro está falando?"
  }

  const novoHistorico = [
    ...historico,
    { role: "user" as const, content: textoRecebido },
    { role: "assistant" as const, content: respostaFinal },
  ]

  await atualizarConversa(conversa.id, {
    nomeTemp: ehNomeValido(nomeTemp) ? nomeTemp : null,
    localTemp,
    historico: novoHistorico,
  })
  if (transferido) await transferirAtendimento(conversa.id)

  return respostaFinal
}
