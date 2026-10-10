import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"

const PAPEIS = ["dono", "producao", "financeiro"]

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId: quemPede } = await auth()
  const { userId } = await params
  const { papel } = await req.json()

  if (!PAPEIS.includes(papel)) {
    return NextResponse.json({ error: "Papel inválido" }, { status: 400 })
  }
  if (userId === quemPede) {
    return NextResponse.json({ error: "Você não pode alterar o seu próprio papel" }, { status: 400 })
  }

  const clerk = await clerkClient()
  await clerk.users.updateUserMetadata(userId, {
    publicMetadata: { papel },
  })

  return NextResponse.json({ ok: true })
}
