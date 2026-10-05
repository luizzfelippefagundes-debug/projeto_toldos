import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import type { Servico } from "@/lib/types"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const b: Omit<Servico, "id"> = await req.json()
  await getSql()`
    UPDATE servicos
    SET nome=${b.nome}, forma_cobranca=${b.formaCobranca}, valor=${b.valor},
        ferramentas=${b.ferramentas ?? null}
    WHERE id=${id}
  `
  return NextResponse.json({ id, ...b })
}
