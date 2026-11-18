import QRCode from "qrcode"

export interface DadosCriarPix {
  valor: number
  descricao: string
  clienteNome?: string
  clienteEmail?: string
  clienteCpf?: string
  externalReference?: string
  expiracaoMinutos?: number
}

export interface RespostaPixMercadoPago {
  sucesso: boolean
  pagamentoId?: string
  status?: string
  qrCode?: string // Pix Copia e Cola
  qrCodeBase64?: string // Imagem PNG do QR Code em base64
  ticketUrl?: string
  expiraEm?: string
  aviso?: string
}

function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "https://toldosprint.com.br"
}

/**
 * Cria uma cobrança Pix dinâmica pelo Mercado Pago.
 * Se o token do Mercado Pago não estiver configurado ainda, gera com segurança
 * um QR Code Pix com base na chave Pix da empresa ou modo demonstração.
 */
export async function criarPixMercadoPago(dados: DadosCriarPix): Promise<RespostaPixMercadoPago> {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN
  const chavePixFixa = process.env.PIX_CHAVE_EMPRESA || process.env.NEXT_PUBLIC_PIX_CHAVE

  // 1. Se o token do Mercado Pago estiver configurado, chama a API oficial v1/payments
  if (token) {
    try {
      const appUrl = getAppUrl()
      const notificationUrl = `${appUrl}/api/mercadopago/webhook`
      const expiracao = new Date(Date.now() + (dados.expiracaoMinutos ?? 60 * 24) * 60 * 1000).toISOString()

      const payloadMp: Record<string, unknown> = {
        transaction_amount: Number(dados.valor.toFixed(2)),
        description: dados.descricao.slice(0, 150),
        payment_method_id: "pix",
        payer: {
          email: dados.clienteEmail || "financeiro@toldosprint.com.br",
          first_name: dados.clienteNome?.split(" ")[0] || "Cliente",
          last_name: dados.clienteNome?.split(" ").slice(1).join(" ") || "Toldos Print",
        },
        external_reference: dados.externalReference,
        notification_url: notificationUrl,
        date_of_expiration: expiracao,
      }

      if (dados.clienteCpf) {
        const cpfLimpo = dados.clienteCpf.replace(/\D/g, "")
        if (cpfLimpo.length === 11 || cpfLimpo.length === 14) {
          ;(payloadMp.payer as Record<string, unknown>).identification = {
            type: cpfLimpo.length === 11 ? "CPF" : "CNPJ",
            number: cpfLimpo,
          }
        }
      }

      const res = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": `${dados.externalReference || Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        },
        body: JSON.stringify(payloadMp),
      })

      const mpData = await res.json()

      if (res.ok && mpData.point_of_interaction?.transaction_data) {
        const td = mpData.point_of_interaction.transaction_data
        return {
          sucesso: true,
          pagamentoId: String(mpData.id),
          status: mpData.status,
          qrCode: td.qr_code,
          qrCodeBase64: td.qr_code_base64,
          ticketUrl: td.ticket_url,
          expiraEm: mpData.date_of_expiration,
        }
      }

      console.warn("[mercadopago] Erro ao criar pagamento MP:", mpData)
    } catch (err: any) {
      console.error("[mercadopago] Falha na requisição:", err?.message)
    }
  }

  // 2. Fallback: Se não tem token ou API falhou, gera via chave Pix estática / QR Code local
  if (chavePixFixa) {
    const payloadPix = gerarPayloadPixEstatico({
      chave: chavePixFixa,
      nome: process.env.PIX_NOME_BENEFICIARIO || "TOLDOS PRINT",
      cidade: process.env.PIX_CIDADE_BENEFICIARIO || "COLATINA",
      valor: dados.valor,
      identificador: dados.externalReference?.slice(0, 20) || "TOLDOS",
    })

    const qrBase64 = await QRCode.toDataURL(payloadPix, { width: 300, margin: 1 })
    const apenasBase64 = qrBase64.replace(/^data:image\/png;base64,/, "")

    return {
      sucesso: true,
      pagamentoId: `pix-${Date.now()}`,
      status: "pending",
      qrCode: payloadPix,
      qrCodeBase64: apenasBase64,
      aviso: "Chave Pix direta da Toldos Print (Mercado Pago pendente de configuração do token)",
    }
  }

  // 3. Fallback mock para desenvolvimento / visualização
  const payloadDemo = `00020126580014BR.GOV.BCB.PIX0114+552799748971452040000530398654${dados.valor.toFixed(2).padStart(5, "0")}5802BR5912TOLDOS PRINT6008COLATINA62070503***6304ABCD`
  const qrDemo = await QRCode.toDataURL(payloadDemo, { width: 300, margin: 1 })

  return {
    sucesso: true,
    pagamentoId: `demo-${Date.now()}`,
    status: "pending",
    qrCode: payloadDemo,
    qrCodeBase64: qrDemo.replace(/^data:image\/png;base64,/, ""),
    aviso: "Configuração do Mercado Pago necessária (MERCADO_PAGO_ACCESS_TOKEN)",
  }
}

/**
 * Consulta o status de um pagamento no Mercado Pago pelo ID
 */
export async function consultarPagamentoMercadoPago(
  pagamentoId: string
): Promise<{ status: string; statusDetail?: string; valor?: number; pagoEm?: string } | null> {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN
  if (!token || pagamentoId.startsWith("pix-") || pagamentoId.startsWith("demo-")) {
    return null
  }

  try {
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${pagamentoId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const data = await res.json()
    return {
      status: data.status,
      statusDetail: data.status_detail,
      valor: data.transaction_amount,
      pagoEm: data.date_approved,
    }
  } catch {
    return null
  }
}

/**
 * Gera string padrão BR Code (Pix Copia e Cola) EMV compatível com todos os bancos do Brasil
 */
export function gerarPayloadPixEstatico({
  chave,
  nome,
  cidade,
  valor,
  identificador = "***",
}: {
  chave: string
  nome: string
  cidade: string
  valor?: number
  identificador?: string
}): string {
  function formatTlv(id: string, value: string): string {
    const len = value.length.toString().padStart(2, "0")
    return `${id}${len}${value}`
  }

  const chaveLimpa = chave.trim()
  const merchantAccount = formatTlv("00", "BR.GOV.BCB.PIX") + formatTlv("01", chaveLimpa)

  let payload =
    formatTlv("00", "01") + // Payload Format Indicator
    formatTlv("26", merchantAccount) + // Merchant Account Information
    formatTlv("52", "0000") + // Merchant Category Code
    formatTlv("53", "986") // Transaction Currency (986 = BRL)

  if (valor && valor > 0) {
    payload += formatTlv("54", valor.toFixed(2)) // Transaction Amount
  }

  payload +=
    formatTlv("58", "BR") + // Country Code
    formatTlv("59", nome.slice(0, 25).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()) + // Merchant Name
    formatTlv("60", cidade.slice(0, 15).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()) // Merchant City

  const additionalData = formatTlv("05", identificador.slice(0, 25))
  payload += formatTlv("62", additionalData)

  payload += "6304" // CRC16 placeholder

  const crc = calcularCrc16(payload)
  return `${payload}${crc}`
}

function calcularCrc16(str: string): string {
  let crc = 0xffff
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff
      } else {
        crc = (crc << 1) & 0xffff
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0")
}
