import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { ClerkProvider } from "@clerk/nextjs"
import { ptBR } from "@clerk/localizations"
import { ThemeProvider } from "@/components/theme-provider"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Toldos Print — Sistema interno",
  description: "Central operacional para toldos e comunicação visual",
  appleWebApp: {
    capable: true,
    title: "Toldos Print",
    statusBarStyle: "default",
  },
}

export const viewport: Viewport = {
  themeColor: "#0060a7",
  colorScheme: "dark light",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased">
        <ClerkProvider
          localization={{ ...ptBR, formFieldInputPlaceholder__signUpPassword: "Crie uma senha" }}
        >
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
            {children}
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  )
}
