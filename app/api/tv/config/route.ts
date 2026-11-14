import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import { salvarTemaTv } from "@/lib/tema-tv"

export interface TvConfig {
  statusVisiveis: string[]
  tiposVisiveis: ("rapido" | "orcamento")[]
  mostrarAtrasados: boolean
  somAlarme: boolean
  tema: "light" | "dark"
  apenasRecentes?: boolean
}

export const DEFAULT_TV_CONFIG: TvConfig = {
  statusVisiveis: ["aguardando", "aprovado", "ag_confirmacao", "impressao", "acabamento", "pronto"],
  tiposVisiveis: ["rapido", "orcamento"],
  mostrarAtrasados: true,
  somAlarme: true,
  tema: "dark",
  apenasRecentes: false,
}

async function garantirTabela(sql: ReturnType<typeof getSql>) {
  await sql`
    CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    )
  `
}

export async function GET() {
  try {
    const sql = getSql()
    await garantirTabela(sql)
    const rows = await sql`SELECT valor FROM configuracoes WHERE chave = 'tv_config'`
    if (!rows[0]?.valor) {
      return NextResponse.json(DEFAULT_TV_CONFIG, { headers: { "Cache-Control": "no-store" } })
    }
    const salvo = JSON.parse(rows[0].valor)
    return NextResponse.json({ ...DEFAULT_TV_CONFIG, ...salvo }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("Erro ao ler configuração da TV:", error)
    return NextResponse.json(DEFAULT_TV_CONFIG, { headers: { "Cache-Control": "no-store" } })
  }
}

export async function POST(req: Request) {
  try {
    const corpo = await req.json()
    const sql = getSql()
    await garantirTabela(sql)

    const novaConfig: TvConfig = {
      statusVisiveis:
        Array.isArray(corpo.statusVisiveis) && corpo.statusVisiveis.length > 0
          ? corpo.statusVisiveis
          : DEFAULT_TV_CONFIG.statusVisiveis,
      tiposVisiveis:
        Array.isArray(corpo.tiposVisiveis) && corpo.tiposVisiveis.length > 0
          ? corpo.tiposVisiveis
          : DEFAULT_TV_CONFIG.tiposVisiveis,
      mostrarAtrasados: corpo.mostrarAtrasados ?? true,
      somAlarme: corpo.somAlarme ?? true,
      tema: corpo.tema === "light" ? "light" : "dark",
      apenasRecentes: corpo.apenasRecentes ?? false,
    }

    await sql`
      INSERT INTO configuracoes (chave, valor)
      VALUES ('tv_config', ${JSON.stringify(novaConfig)})
      ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor
    `

    if (novaConfig.tema) {
      await salvarTemaTv(novaConfig.tema)
    }

    return NextResponse.json({ ok: true, config: novaConfig })
  } catch (error) {
    console.error("Erro ao salvar configuração da TV:", error)
    return NextResponse.json({ error: "Erro ao salvar configuração" }, { status: 500 })
  }
}
