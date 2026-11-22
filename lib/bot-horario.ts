export interface StatusHorarioAtendimento {
  estaAberto: boolean
  ehFimDeSemana: boolean
  diaSemana: number // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  hora: number
  minuto: number
  horarioAbertura: string
  horarioFechamento: string
  proximaAberturaDescricao: string
}

/**
 * Verifica se a empresa está em horário de funcionamento comercial,
 * sempre com base no fuso horário oficial de Brasília (America/Sao_Paulo).
 *
 * Horário oficial da Toldos Print:
 * - Segunda a Sexta: das 07:30 às 17:00
 * - Sábados, Domingos e Feriados/Noites: Fechado
 */
export function verificarHorarioAtendimento(dataReferencia: Date = new Date()): StatusHorarioAtendimento {
  const formatoBr = dataReferencia.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  const dataBr = new Date(formatoBr)

  const diaSemana = dataBr.getDay() // 0 = Domingo, 6 = Sábado
  const hora = dataBr.getHours()
  const minuto = dataBr.getMinutes()
  const minutosAtuais = hora * 60 + minuto

  const horaInicioMinutos = 7 * 60 + 30 // 07:30 = 450 min
  const horaFimMinutos = 17 * 60 // 17:00 = 1020 min

  const ehFimDeSemana = diaSemana === 0 || diaSemana === 6
  const dentroHorarioSemana = !ehFimDeSemana && minutosAtuais >= horaInicioMinutos && minutosAtuais < horaFimMinutos
  const estaAberto = dentroHorarioSemana

  let proximaAberturaDescricao = "na segunda-feira a partir das 07:30"
  if (diaSemana >= 1 && diaSemana <= 4) {
    if (minutosAtuais < horaInicioMinutos) {
      proximaAberturaDescricao = "hoje a partir das 07:30"
    } else {
      proximaAberturaDescricao = "amanhã a partir das 07:30"
    }
  } else if (diaSemana === 5) {
    if (minutosAtuais < horaInicioMinutos) {
      proximaAberturaDescricao = "hoje a partir das 07:30"
    } else {
      proximaAberturaDescricao = "na segunda-feira a partir das 07:30"
    }
  }

  return {
    estaAberto,
    ehFimDeSemana,
    diaSemana,
    hora,
    minuto,
    horarioAbertura: "07:30",
    horarioFechamento: "17:00",
    proximaAberturaDescricao,
  }
}

/**
 * Gera a resposta acolhedora do robô informando que a empresa está fechada,
 * os horários de funcionamento (7:30 às 17:00) e que em breve a equipe entrará em contato.
 */
export function formatarMensagemForaDoHorario({
  nome,
  status,
  assunto,
}: {
  nome?: string | null
  status: StatusHorarioAtendimento
  assunto?: string | null
}): string {
  const vocativo = nome ? `, ${nome}` : ""

  if (status.ehFimDeSemana) {
    return (
      `Olá${vocativo}! Seja muito bem-vindo(a) à Toldos Print. 🤝✨\n\n` +
      `No momento estamos fechados para o fim de semana. 🏖️\n\n` +
      `🕒 *Nosso horário de funcionamento é:*\n` +
      `📅 De segunda a sexta-feira, das 07:30 às 17:00.\n\n` +
      `Sua mensagem já ficou registrada aqui com a gente! Em breve, logo no início do nosso expediente ${status.proximaAberturaDescricao}, nossa equipe vai entrar em contato com você por aqui com prioridade. ⏳🧑‍💼\n\n` +
      `Se você deseja adiantar o seu orçamento:\n` +
      `📸 Pode enviar fotos do local ou do serviço que deseja;\n` +
      `📏 E se tiver, as medidas aproximadas ou projeto.\n\n` +
      `Assim que abrirmos, já te respondemos com tudo certinho! Tenha um ótimo fim de semana! ✨`
    )
  }

  return (
    `Olá${vocativo}! Seja muito bem-vindo(a) à Toldos Print. 🤝✨\n\n` +
    `No momento nossa equipe já encerrou o expediente por hoje. 🌙\n\n` +
    `🕒 *Nosso horário de funcionamento é:*\n` +
    `📅 De segunda a sexta-feira, das 07:30 às 17:00.\n\n` +
    `Sua mensagem já ficou registrada com a gente! Em breve, assim que iniciarmos nosso atendimento ${status.proximaAberturaDescricao}, nossa equipe vai te responder por aqui com prioridade. ⏳🧑‍💼\n\n` +
    `Se você deseja solicitar um orçamento, pode adiantar os detalhes por aqui:\n` +
    `📸 Fotos do local ou serviço desejado;\n` +
    `📏 Medidas aproximadas ou projeto.`
  )
}
