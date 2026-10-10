import Image from "next/image"
import { cn } from "@/lib/utils"

// O logo tem letras brancas, então vai sempre sobre o azul da marca.
export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center rounded-lg bg-[#0060a7] px-3 py-2", className)}>
      <Image
        src="/brand/logo.png"
        alt="Toldos Print — Toldos e Comunicação Visual"
        width={1200}
        height={394}
        priority
        className="h-auto w-full"
      />
    </div>
  )
}
