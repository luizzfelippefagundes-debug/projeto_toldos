import { SignUp } from "@clerk/nextjs"

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <SignUp signInUrl="/sign-in" forceRedirectUrl="/dashboard" />
    </div>
  )
}
