import { NextResponse } from "next/server"
import { listarExclusoes } from "@/lib/historico-exclusoes"

// Só o dono acessa (ver `apiSoDono` em proxy.ts).
export async function GET() {
  return NextResponse.json(await listarExclusoes())
}
