import { NextResponse } from "next/server"
import { notificarConclusaoPecaAoKaio } from "@/lib/notificacoes-producao"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      origemTipo,
      origemId,
      numero,
      clienteNome,
      produtoNome,
      fotoAntesUrl,
      fotoDepoisUrl,
      colaboradores,
      observacao,
    } = body

    if (!origemTipo || !origemId || !numero || !clienteNome) {
      return NextResponse.json(
        { erro: "Dados incompletos: origemTipo, origemId, numero e clienteNome são obrigatórios." },
        { status: 400 }
      )
    }

    const resultado = await notificarConclusaoPecaAoKaio({
      origemTipo,
      origemId,
      numero: Number(numero),
      clienteNome,
      produtoNome,
      fotoAntesUrl,
      fotoDepoisUrl,
      colaboradores,
      observacao,
    })

    return NextResponse.json({ ok: true, resultado })
  } catch (err: any) {
    console.error("[api/producao/notificar-conclusao] Erro:", err)
    return NextResponse.json(
      { erro: err?.message || "Erro ao notificar conclusão ao Kaio" },
      { status: 500 }
    )
  }
}
