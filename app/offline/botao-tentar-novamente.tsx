"use client"

import { Button } from "@/components/ui/button"

export function BotaoTentarNovamente() {
  return (
    <Button onClick={() => window.location.assign("/dashboard")}>
      Tentar abrir o sistema
    </Button>
  )
}
