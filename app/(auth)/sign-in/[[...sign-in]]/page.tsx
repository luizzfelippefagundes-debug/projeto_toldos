import { SignIn } from "@clerk/nextjs"
import { LimparCopiaLocal } from "@/components/offline/limpar-copia-local"

export default function SignInPage() {
  return (
    <>
      <LimparCopiaLocal />
      <SignIn signUpUrl="/sign-up" />
    </>
  )
}
