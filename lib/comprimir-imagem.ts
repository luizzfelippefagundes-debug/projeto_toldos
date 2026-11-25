/**
 * Utilitário de compressão e otimização de imagens no cliente.
 * 
 * Permite fotos de qualquer tamanho (fotos gigantes de celulares modernos de 12MP, 48MP, 108MP, 10MB a 100MB)
 * redimensionando e otimizando automaticamente no navegador antes do upload para a API.
 * 
 * Evita o erro HTTP 413 (Payload Too Large), erros de conexão por timeout em redes móveis
 * e garante carregamento quase instantâneo preservando máxima nitidez para inspeção de qualidade.
 */
export async function comprimirImagemParaUpload(
  file: File,
  opcoes?: {
    maxDimensao?: number
    qualidade?: number
    tamanhoMaximoBytes?: number
  }
): Promise<File> {
  const {
    maxDimensao = 2560, // 2.5K de resolução: nitidez perfeita para zoom em lonas, adesivos e detalhes
    qualidade = 0.85,
    tamanhoMaximoBytes = 900 * 1024, // 900 KB
  } = opcoes || {}

  // Apenas imagens JPEG, PNG, WEBP, HEIC, etc. Arquivos PDF, SVG ou GIF não são tocados.
  if (!file.type.startsWith("image/") || file.type.includes("svg") || file.type.includes("gif")) {
    return file
  }

  // Se já for leve (< 900 KB) e JPEG/WEBP, pode subir direto
  if (file.size <= tamanhoMaximoBytes && (file.type === "image/jpeg" || file.type === "image/webp")) {
    return file
  }

  if (typeof window === "undefined") {
    return file
  }

  return new Promise((resolve) => {
    const processarBlob = (
      imgSource: ImageBitmap | HTMLImageElement,
      sourceWidth: number,
      sourceHeight: number
    ) => {
      let width = sourceWidth
      let height = sourceHeight

      if (width > maxDimensao || height > maxDimensao) {
        if (width > height) {
          height = Math.round((height * maxDimensao) / width)
          width = maxDimensao
        } else {
          width = Math.round((width * maxDimensao) / height)
          height = maxDimensao
        }
      }

      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext("2d")
      if (!ctx) {
        resolve(file)
        return
      }

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"
      ctx.drawImage(imgSource, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file)
            return
          }

          const nomeLimpo = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_")
          const novoArquivo = new File([blob], `${nomeLimpo || "foto"}.jpg`, {
            type: "image/jpeg",
            lastModified: Date.now(),
          })

          resolve(novoArquivo)
        },
        "image/jpeg",
        qualidade
      )
    }

    // Tenta primeiro com createImageBitmap (mais rápido e respeita orientação EXIF nativamente)
    if (typeof createImageBitmap === "function") {
      createImageBitmap(file, { imageOrientation: "from-image" })
        .then((bitmap) => {
          processarBlob(bitmap, bitmap.width, bitmap.height)
        })
        .catch(() => {
          // Fallback para Image tradicional caso createImageBitmap falhe com formato específico
          usarImageTradicional()
        })
    } else {
      usarImageTradicional()
    }

    function usarImageTradicional() {
      try {
        const img = new Image()
        const url = URL.createObjectURL(file)

        img.onload = () => {
          URL.revokeObjectURL(url)
          processarBlob(img, img.naturalWidth || img.width, img.naturalHeight || img.height)
        }

        img.onerror = () => {
          URL.revokeObjectURL(url)
          resolve(file)
        }

        img.src = url
      } catch {
        resolve(file)
      }
    }
  })
}
