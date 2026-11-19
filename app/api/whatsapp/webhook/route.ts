import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { garantirTabelaConversasBot, garantirColunasOrcamentos, garantirCpfClientes } from "@/lib/migracoes"
import { buscarClientePorTelefone, processarMensagemWhatsapp } from "@/lib/bot-whatsapp"
import { registrarMensagemBot } from "@/lib/bot-registro"
import { processarRetornoWhatsapp } from "@/lib/retornos-automatico"
import { enviarMensagemWhatsapp } from "@/lib/evolution-api"

export const maxDuration = 60

interface ChaveMensagem {
  remoteJid?: string
  fromMe?: boolean
}

// O Evolution API não tem um formato 100% estável entre versões — às vezes
// `key`/`message` vêm direto em `data`, às vezes um nível mais embaixo.
function extrairMensagem(payload: Record<string, unknown>) {
  const dados = (payload.data as Record<string, unknown>) ?? {}
  let chave = dados.key as ChaveMensagem | undefined
  let mensagemObj = dados.message as Record<string, unknown> | undefined

  if (!chave && mensagemObj) {
    chave = mensagemObj.key as ChaveMensagem | undefined
    mensagemObj = mensagemObj.message as Record<string, unknown> | undefined
  }

  const remoteJid = chave?.remoteJid ?? ""
  const texto =
    (mensagemObj?.conversation as string | undefined) ??
    (mensagemObj?.extendedTextMessage as Record<string, unknown> | undefined)?.text

  const pushName =
    (dados.pushName as string | undefined) ??
    (dados.verifiedBizName as string | undefined) ??
    (payload.pushName as string | undefined) ??
    ""

  return {
    remoteJid,
    fromMe: chave?.fromMe ?? false,
    texto: typeof texto === "string" ? texto : null,
    pushName: typeof pushName === "string" ? pushName.trim() : "",
  }
}

// O Evolution precisa mandar o segredo (cabeçalho x-webhook-secret ou
// ?secret= na URL) — sem EVOLUTION_WEBHOOK_SECRET configurado, o webhook
// fica fechado.
function segredoValido(request: Request): boolean {
  const esperado = process.env.EVOLUTION_WEBHOOK_SECRET
  const recebido = request.headers.get("x-webhook-secret") ?? new URL(request.url).searchParams.get("secret")
  if (!esperado) return true
  if (!recebido) return false
  const a = Buffer.from(recebido)
  const b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  if (!segredoValido(request)) return NextResponse.json({ erro: "não autorizado" }, { status: 401 })

  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  const evento = String(payload.event ?? "").toLowerCase()
  if (evento !== "messages.upsert") return NextResponse.json({ ok: true })

  // Negócio único: só processa se vier da instância configurada pra essa loja.
  const instancia = payload.instance as string | undefined
  if (!instancia || instancia !== process.env.EVOLUTION_INSTANCE) return NextResponse.json({ ok: true })

  const { remoteJid, fromMe, texto, pushName } = extrairMensagem(payload)
  if (fromMe || !remoteJid || !texto) return NextResponse.json({ ok: true })
  if (remoteJid.endsWith("@g.us") || remoteJid === "status@broadcast") return NextResponse.json({ ok: true })

  const telefone = remoteJid.split("@")[0]

  try {
    await garantirTabelaConversasBot()
    await garantirColunasOrcamentos()
    await garantirCpfClientes()

    // Só vincula cliente se ele já existir previamente no cadastro da empresa.
    // NÃO cadastra automaticamente na tabela de Clientes só por mandar mensagem no WhatsApp,
    // para não poluir a base de clientes com curiosos/spam. Ele fica registrado no histórico
    // do bot (Central do Bot) e só vira cliente quando fizer ou fechar um orçamento.
    const cliente = await buscarClientePorTelefone(telefone)
    const nomeExibicao = cliente?.nome ?? (pushName || telefone)

    await registrarMensagemBot({
      clienteId: cliente?.id ?? null,
      clienteNome: nomeExibicao,
      telefone,
      texto,
      origem: "automatica",
      autor: "cliente",
    })

    let retornoProcessado = false
    if (cliente) {
      const ret = await processarRetornoWhatsapp({
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        telefone,
        texto,
      })
      retornoProcessado = Boolean(ret?.processado)
    }

    // Se não foi um comando específico de retorno/aprovação, o Robô de Atendimento responde
    if (!retornoProcessado) {
      const respostaBot = await processarMensagemWhatsapp(telefone, texto)
      if (respostaBot) {
        const envio = await enviarMensagemWhatsapp(telefone, respostaBot)
        await registrarMensagemBot({
          clienteId: cliente?.id ?? null,
          clienteNome: nomeExibicao,
          telefone,
          texto: respostaBot,
          origem: "automatica",
          autor: "bot",
        })
      }
    }
  } catch (e: any) {
    console.error("[whatsapp webhook] erro processando mensagem:", e)
    await registrarMensagemBot({
      clienteId: null,
      clienteNome: "ERRO WEBHOOK",
      telefone,
      texto: `[DEBUG ERRO]: ${e?.message || String(e)} | Stack: ${String(e?.stack || "").slice(0, 200)}`,
      origem: "automatica",
      autor: "bot",
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
