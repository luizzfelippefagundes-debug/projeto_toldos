import confetti from "canvas-confetti"

/**
 * Toca um efeito sonoro festivo de moedas / prêmio estilo arcade ("Tigrinho")
 * gerado via Web Audio API (sem precisar carregar arquivo de áudio externo).
 */
export function tocarSomMoedas() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {})
    }
    // Sequência alegre de moedas estilo jackpot (B5 -> E6 -> A6 -> C7 -> E7)
    const notas = [987.77, 1318.51, 1760.0, 2093.0, 2637.02]
    notas.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.07
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "triangle"
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.4, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.4)
    })
  } catch {
    // Silencia se áudio for bloqueado pelo navegador
  }
}

/**
 * Dispara confetes coloridos e som de moedas na tela
 */
export function comemorarComissao() {
  tocarSomMoedas()
  try {
    confetti({
      particleCount: 90,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#ffd700", "#ffaa00", "#10b981", "#3b82f6", "#f43f5e"],
    })
  } catch {
    // Ignora se confetti falhar
  }
}
