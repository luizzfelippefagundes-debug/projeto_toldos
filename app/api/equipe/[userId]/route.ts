import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId: authId } = await auth()
  if (!authId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { userId } = await params
  const { papel } = await req.json()

  const clerk = await clerkClient()
  await clerk.users.updateUserMetadata(userId, {
    publicMetadata: { papel },
  })

  return NextResponse.json({ ok: true })
}
