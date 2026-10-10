import { NextResponse } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"
import type { User } from "@clerk/nextjs/server"
import { resolverPapel } from "@/lib/papel"

export async function GET() {
  const clerk = await clerkClient()
  const { data: users } = await clerk.users.getUserList({ limit: 100, orderBy: "+created_at" })

  const resultado = users.map((u: User) => {
    const email = u.primaryEmailAddress?.emailAddress ?? u.emailAddresses[0]?.emailAddress ?? null
    return {
      id: u.id,
      nome: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || email || "—",
      email: email ?? "—",
      papel: resolverPapel(u.publicMetadata?.papel, email) ?? "pendente",
      imagemUrl: u.imageUrl,
      ultimoLogin: u.lastSignInAt,
    }
  })

  return NextResponse.json(resultado)
}
