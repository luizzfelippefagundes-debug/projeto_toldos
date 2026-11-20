import { NextResponse } from "next/server"
import { enviarReciboLancamento } from "@/lib/recibo-whatsapp"

// Reenvio manual do recibo em PDF (botão na tela do recibo). O envio normal é
// automático, no PUT de /api/lancamentos/[id], quando o recebimento vira "pago".
export async function POST(req: Request) {
  try {
    const { lancamentoId, telefone } = await req.json()
    if (!lancamentoId) {
      return NextResponse.json({ erro: "lancamentoId obrigatório" }, { status: 400 })
    }
    const r = await enviarReciboLancamento(String(lancamentoId), telefone ? String(telefone) : undefined)
    if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: r.status })
    return NextResponse.json(r)
  } catch (err: any) {
    console.error("[enviar-recibo] erro:", err)
    return NextResponse.json({ erro: err?.message || String(err) }, { status: 500 })
  }
}
