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

/**
 * Valida e normaliza a lista de destinatários. Os anexos contêm nome + CNH
 * (dado pessoal, LGPD): um endereço malformado em EMAIL_TO mandaria sigilo
 * para o lugar errado, então paramos o envio antes de qualquer destinatário
 * inválido em vez de "tentar mesmo assim".
 */
function destinatariosValidos(): string[] {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const lista = CONFIG.EMAIL_TO.split(',').map((e) => e.trim()).filter(Boolean)
  const invalidos = lista.filter((e) => !re.test(e))
  if (lista.length === 0) {
    throw new Error('EMAIL_TO não tem nenhum destinatário válido.')
  }
  if (invalidos.length > 0) {
    throw new Error(`EMAIL_TO contém endereço(s) inválido(s): ${invalidos.join(', ')}. Corrija antes de enviar dados de clientes.`)
  }
  return lista
}

export async function enviarEmail(relatorio: RelatorioEmail, anexos: string[]): Promise<void> {
  validarConfigEmail()
  const destinatarios = destinatariosValidos()

  const transporter = nodemailer.createTransport({
    host: CONFIG.SMTP_HOST,
    port: CONFIG.SMTP_PORT,
    secure: CONFIG.SMTP_SECURE,
    // Em porta 587 (STARTTLS) exigimos a elevação para TLS e um piso de versão,
    // para o anexo com dado pessoal nunca trafegar em claro.
    requireTLS: true,
    tls: { minVersion: 'TLSv1.2' },
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
    to: destinatarios,
    subject: relatorio.subject,
    text: relatorio.text,
    html: relatorio.html,
    attachments,
  })

  console.log(`[EMAIL] Mensagem enviada para ${CONFIG.EMAIL_TO}.`)
}
