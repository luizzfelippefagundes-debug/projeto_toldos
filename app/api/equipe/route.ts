import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import type { User } from "@clerk/nextjs/server"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const clerk = await clerkClient()
  const { data: users } = await clerk.users.getUserList({ limit: 100, orderBy: "+created_at" })

  const resultado = users.map((u: User) => ({
    id: u.id,
    nome: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "—",
    email: u.emailAddresses[0]?.emailAddress ?? "—",
    papel: (u.publicMetadata?.papel as string) ?? "dono",
    imagemUrl: u.imageUrl,
    ultimoLogin: u.lastSignInAt,
  }))

  return NextResponse.json(resultado)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { email, papel } = await req.json()
  if (!email || !papel) return NextResponse.json({ error: "email e papel são obrigatórios" }, { status: 400 })

  const clerk = await clerkClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://grafica-flax.vercel.app"

  await clerk.invitations.createInvitation({
    emailAddress: email,
    redirectUrl: `${appUrl}/sign-in`,
    publicMetadata: { papel },
    notify: true,
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
