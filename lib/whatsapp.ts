// Telefone do cadastro ("(27) 99750-1517", "27997501517", "+55 27 ...") no
// formato que o WhatsApp pede: só dígitos, com o 55 do Brasil na frente.
// Devolve null se não parecer um telefone (menos de 10 dígitos).
export function telefoneParaWhatsapp(telefone: string): string | null {
  const digitos = telefone.replace(/\D/g, "")
  if (digitos.length < 10) return null
  // 10 ou 11 dígitos = DDD + número, sem país.
  if (digitos.length <= 11) return `55${digitos}`
  return digitos
}

export function linkWhatsapp(telefone: string, texto: string): string | null {
  const numero = telefoneParaWhatsapp(telefone)
  if (!numero) return null
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
}

// Mensagem provisória de envio do orçamento. O texto definitivo ainda vai ser
// pensado com a loja: é só mudar aqui.
export function mensagemOrcamentoWhatsapp({
  clienteNome,
  numero,
  total,
  validoAte,
}: {
  clienteNome: string
  numero: string
  total: string
  validoAte: string
}): string {
  return (
    `Olá, ${clienteNome}! Tudo bem?\n` +
    `Segue o orçamento nº ${numero} da Toldos Print, no valor de ${total}, ` +
    `válido até ${validoAte}.\n` +
    `Qualquer dúvida é só chamar por aqui!`
  )
}
