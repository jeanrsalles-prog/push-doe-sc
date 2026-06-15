import nodemailer from 'nodemailer'
import fs from 'fs'
import path from 'path'
import { CONFIG } from './config'
import { RelatorioEmail } from './report'

/** Retorna true se todas as variáveis de SMTP/e-mail estão preenchidas. */
export function emailConfigurado(): boolean {
  return Boolean(
    CONFIG.SMTP_HOST && CONFIG.SMTP_USER && CONFIG.SMTP_PASS && CONFIG.EMAIL_FROM && CONFIG.EMAIL_TO
  )
}

function validarConfigEmail(): void {
  const faltando = [
    ['SMTP_HOST', CONFIG.SMTP_HOST],
    ['SMTP_USER', CONFIG.SMTP_USER],
    ['SMTP_PASS', CONFIG.SMTP_PASS],
    ['EMAIL_FROM', CONFIG.EMAIL_FROM],
    ['EMAIL_TO', CONFIG.EMAIL_TO],
  ].filter(([, valor]) => !valor)

  if (faltando.length > 0) {
    throw new Error(`Configuração de e-mail incompleta: ${faltando.map(([nome]) => nome).join(', ')}`)
  }
}

export async function enviarEmail(relatorio: RelatorioEmail, anexos: string[]): Promise<void> {
  validarConfigEmail()

  const transporter = nodemailer.createTransport({
    host: CONFIG.SMTP_HOST,
    port: CONFIG.SMTP_PORT,
    secure: CONFIG.SMTP_SECURE,
    auth: {
      user: CONFIG.SMTP_USER,
      pass: CONFIG.SMTP_PASS,
    },
  })

  const attachments = anexos.map((arquivo) => {
    if (!fs.existsSync(arquivo)) {
      throw new Error(`Arquivo de anexo não encontrado: ${arquivo}`)
    }

    return {
      filename: path.basename(arquivo),
      path: arquivo,
    }
  })

  await transporter.sendMail({
    from: CONFIG.EMAIL_FROM,
    to: CONFIG.EMAIL_TO.split(',').map((email) => email.trim()).filter(Boolean),
    subject: relatorio.subject,
    text: relatorio.text,
    html: relatorio.html,
    attachments,
  })

  console.log(`[EMAIL] Mensagem enviada para ${CONFIG.EMAIL_TO}.`)
}
