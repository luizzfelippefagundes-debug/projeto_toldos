import { NextResponse } from "next/server"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  const {
    clienteNome,
    clienteEmail,
    numero,
    material,
    servico,
    total,
    validoAte,
  }: {
    clienteNome: string
    clienteEmail: string
    numero: number
    material: string
    servico: string
    total: number
    validoAte?: string
  } = await req.json()

  const totalFormatado = total.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head><meta charset="UTF-8" /></head>
    <body style="font-family:sans-serif;color:#111;max-width:600px;margin:0 auto;padding:24px">
      <div style="background:#2b7fff;border-radius:8px;padding:20px 24px;margin-bottom:24px">
        <h1 style="color:#fff;margin:0;font-size:20px">Toldos Print</h1>
        <p style="color:#c7dcff;margin:4px 0 0;font-size:14px">Orçamento #${numero}</p>
      </div>

      <p style="font-size:16px">Olá, <strong>${clienteNome}</strong>!</p>
      <p>Segue o resumo do seu orçamento:</p>

      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr style="background:#f4f4f5">
          <td style="padding:10px 12px;font-size:13px;color:#555">Material</td>
          <td style="padding:10px 12px;font-size:14px;font-weight:600">${material}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-size:13px;color:#555">Serviço</td>
          <td style="padding:10px 12px;font-size:14px;font-weight:600">${servico}</td>
        </tr>
        <tr style="background:#f4f4f5">
          <td style="padding:10px 12px;font-size:13px;color:#555">Valor total</td>
          <td style="padding:10px 12px;font-size:16px;font-weight:700;color:#2b7fff">${totalFormatado}</td>
        </tr>
        ${validoAte ? `
        <tr>
          <td style="padding:10px 12px;font-size:13px;color:#555">Válido até</td>
          <td style="padding:10px 12px;font-size:14px">${validoAte}</td>
        </tr>` : ""}
      </table>

      <p style="font-size:13px;color:#666;margin-top:24px">
        Em caso de dúvidas, entre em contato conosco.<br/>
        <strong>Toldos Print</strong>
      </p>
    </body>
    </html>
  `

  const { error } = await resend.emails.send({
    from: "Toldos Print <onboarding@resend.dev>",
    to: [clienteEmail],
    subject: `Orçamento #${numero} — Toldos Print`,
    html,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
