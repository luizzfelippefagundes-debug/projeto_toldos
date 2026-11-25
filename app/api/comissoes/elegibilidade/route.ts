import { NextRequest, NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { getSql } from "@/lib/db"

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const clerk = await clerkClient()
    const user = await clerk.users.getUser(userId)
    const papelReal = (user.publicMetadata?.papel as string) || "dono"

    if (papelReal !== "dono") {
      return NextResponse.json({ error: "Acesso restrito ao administrador" }, { status: 403 })
    }

    const sql = getSql()

    // 1. Obter lista de usuários da empresa pelo Clerk
    const clerkUsersResponse = await clerk.users.getUserList({ limit: 100 })
    const usuarios = clerkUsersResponse.data.map((u) => {
      const nomeCompleto = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || u.emailAddresses[0]?.emailAddress || "Colaborador"
      return {
        id: u.id,
        nome: nomeCompleto,
        email: u.emailAddresses[0]?.emailAddress ?? null,
        papel: (u.publicMetadata?.papel as string) || "operador",
        imagemUrl: u.imageUrl,
      }
    })

    // 2. Obter configurações salvas no banco
    const configs = await sql`
      SELECT id, colaborador_nome, colaborador_id, recebe_bonus, comissao_padrao_percent
      FROM configuracao_bonus_colaboradores
    `

    const mapaConfigs = new Map<string, any>()
    configs.forEach((c: any) => {
      mapaConfigs.set(c.colaborador_nome.toLowerCase().trim(), c)
    })

    // 3. Montar lista mesclada (se não tiver registro no banco, por padrão recebe_bonus = true exceto dono)
    const elegibilidade = usuarios.map((u) => {
      const configSalva = mapaConfigs.get(u.nome.toLowerCase().trim())
      return {
        colaborador_id: u.id,
        colaborador_nome: u.nome,
        email: u.email,
        papel: u.papel,
        imagemUrl: u.imagemUrl,
        recebe_bonus: configSalva ? Boolean(configSalva.recebe_bonus) : u.papel !== "dono",
        comissao_padrao_percent: configSalva ? Number(configSalva.comissao_padrao_percent) : 2.0,
      }
    })

    return NextResponse.json({ elegibilidade })
  } catch (error) {
    console.error("Erro ao buscar elegibilidade de bônus:", error)
    return NextResponse.json({ error: "Erro ao buscar configurações" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const clerk = await clerkClient()
    const user = await clerk.users.getUser(userId)
    const papelReal = (user.publicMetadata?.papel as string) || "dono"

    if (papelReal !== "dono") {
      return NextResponse.json({ error: "Apenas o dono pode alterar regras de bônus" }, { status: 403 })
    }

    const body = await request.json()
    const { colaboradores } = body // Array de { colaborador_nome, colaborador_id, recebe_bonus, comissao_padrao_percent }

    if (!Array.isArray(colaboradores)) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
    }

    const sql = getSql()

    for (const c of colaboradores) {
      const id = `cfg-${c.colaborador_nome.toLowerCase().replace(/[^a-z0-9]/g, "-")}`
      const recebeBonus = Boolean(c.recebe_bonus)
      const percent = Number(c.comissao_padrao_percent) || 2.0

      await sql`
        INSERT INTO configuracao_bonus_colaboradores (
          id, colaborador_nome, colaborador_id, recebe_bonus, comissao_padrao_percent, atualizado_em
        ) VALUES (
          ${id}, ${c.colaborador_nome}, ${c.colaborador_id ?? null}, ${recebeBonus}, ${percent}, NOW()
        )
        ON CONFLICT (colaborador_nome) DO UPDATE SET
          recebe_bonus = EXCLUDED.recebe_bonus,
          comissao_padrao_percent = EXCLUDED.comissao_padrao_percent,
          colaborador_id = EXCLUDED.colaborador_id,
          atualizado_em = NOW()
      `
    }

    return NextResponse.json({ ok: true, mensagem: "Regras de bônus atualizadas com sucesso!" })
  } catch (error) {
    console.error("Erro ao salvar elegibilidade de bônus:", error)
    return NextResponse.json({ error: "Erro ao salvar configurações" }, { status: 500 })
  }
}
