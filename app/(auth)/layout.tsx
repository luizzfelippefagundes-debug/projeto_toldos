import Image from "next/image"
import { Logo } from "@/components/brand/logo"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-4xl items-center justify-center gap-10">
        <Image
          src="/brand/mascote.jpg"
          alt="Print, o mascote da Toldos Print"
          width={738}
          height={930}
          priority
          className="hidden w-80 shrink-0 rounded-2xl shadow-lg md:block"
        />
        <div className="flex flex-col items-center gap-6">
          <Logo className="w-64 px-4 py-3" />
          {children}
        </div>
      </div>
    </div>
  )
}
