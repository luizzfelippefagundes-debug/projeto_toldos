import { clerkClient, clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { resolverPapel } from "@/lib/papel"

declare global {
  interface CustomJwtSessionClaims {
    papel?: string | null
  }
}

const rotaPublica = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/tv(.*)",
  // Tela que o service worker mostra quando não há internet.
  "/offline",
  "/privacidade",
  "/icon(.*)",
  "/apple-icon(.*)",
  "/manifest(.*)",
  "/portfolio(.*)",
  "/api/tv(.*)",
  "/api/portfolio",
  // Página pública de assinatura digital de OS (cliente recebe link por WhatsApp).
  "/assinar(.*)",
  "/api/assinar(.*)",
  // Página pública de aprovação de arte pelo cliente (link enviado por WhatsApp).
  "/arte(.*)",
  "/api/arte(.*)",
  // Protegida pelo CRON_SECRET dentro da própria rota.
  "/api/cron(.*)",
  // Só o webhook é público (protegido pelo EVOLUTION_WEBHOOK_SECRET dentro da
  // própria rota). As outras rotas de /api/whatsapp mandam mensagem pelo
  // número da loja e exigem login.
  "/api/whatsapp/webhook(.*)",
  // Webhook e serviços públicos do Mercado Pago
  "/api/mercadopago(.*)",
  // Site da loja: preços (só leitura) e pedido de orçamento. O pedido exige o
  // segredo LOJA_API_SECRET dentro da própria rota.
  "/api/loja(.*)",
  // PDFs públicos informativos e de apresentação
  "/(.*).pdf",
  // Vercel Analytics e Speed Insights
  "/_vercel(.*)",
])

const rotaApi = createRouteMatcher(["/api(.*)"])
const apiSoDono = createRouteMatcher([
  "/api/equipe(.*)",
  "/api/avisos-tv(.*)",
  "/api/portfolio-fotos(.*)",
  // Histórico do que foi apagado (quem, quando e o conteúdo).
  "/api/exclusoes(.*)",
])

export default clerkMiddleware(async (auth, req) => {
  const host = req.headers.get("host") || ""
  if (host.startsWith("sistema.") && req.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  if (rotaPublica(req)) return

  const { userId, sessionClaims, redirectToSignIn } = await auth()

  if (!userId) {
    if (rotaApi(req)) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    return redirectToSignIn()
  }

  // Páginas: o layout decide o papel de quem está vendo (e manda o operador
  // de volta pra Produção). Aqui só repassa o caminho pra ele saber onde está.
  if (!rotaApi(req)) {
    const headers = new Headers(req.headers)
    headers.set("x-pathname", req.nextUrl.pathname)
    return NextResponse.next({ request: { headers } })
  }

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
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|pdf)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
}
