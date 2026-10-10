import { clerkClient, clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { resolverPapel } from "@/lib/papel"

declare global {
  interface CustomJwtSessionClaims {
    papel?: string | null
  }
}

const rotaPublica = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/tv(.*)",
  "/privacidade",
  "/icon(.*)",
  "/apple-icon(.*)",
  "/manifest(.*)",
  "/api/tv(.*)",
  // Protegida pelo CRON_SECRET dentro da própria rota.
  "/api/cron(.*)",
])

const rotaApi = createRouteMatcher(["/api(.*)"])
const apiSoDono = createRouteMatcher(["/api/equipe(.*)", "/api/avisos-tv(.*)"])

export default clerkMiddleware(async (auth, req) => {
  if (rotaPublica(req)) return

  const { userId, sessionClaims, redirectToSignIn } = await auth()

  if (!userId) {
    if (rotaApi(req)) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    return redirectToSignIn()
  }

  // Páginas: o layout decide o papel de quem está vendo.
  if (!rotaApi(req)) return

  let papel
  if (sessionClaims && "papel" in sessionClaims) {
    papel = resolverPapel(sessionClaims.papel)
  } else {
    // Token de sessão sem o claim customizado: busca direto no Clerk.
    const user = await (await clerkClient()).users.getUser(userId)
    papel = resolverPapel(user.publicMetadata?.papel)
  }

  if (apiSoDono(req) && papel !== "dono") {
    return NextResponse.json({ error: "Apenas o dono" }, { status: 403 })
  }
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
}
