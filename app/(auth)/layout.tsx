import Image from "next/image"
import { InstalarApp } from "@/components/instalar-app"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-8 p-4"
      style={{
        background:
          "linear-gradient(to bottom, #081d50 0%, #0060a7 38%, #0060a7 62%, #082053 100%)",
      }}
    >
      <Image
        src="/brand/logo.png"
        alt="Toldos Print — Toldos e Comunicação Visual"
        width={1200}
        height={394}
        priority
        className="h-auto w-72 drop-shadow-lg sm:w-[28rem]"
      />
      {children}
      <InstalarApp />
    </div>
  )
}
