"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function MeuExtratoPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/equipe")
  }, [router])

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm font-bold text-muted-foreground">Redirecionando para Equipe & RH...</p>
      </div>
    </div>
  )
}
