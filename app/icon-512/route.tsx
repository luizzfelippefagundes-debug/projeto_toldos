import { ImageResponse } from "next/og"

// Ícone extra de 512x512 só pra satisfazer o tamanho grande que o manifest
// PWA pede (o app/icon.tsx de 192x192 cobre favicon + home screen normal).
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2b7fff",
          color: "#ffffff",
          fontSize: 300,
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        T
      </div>
    ),
    { width: 512, height: 512 }
  )
}
