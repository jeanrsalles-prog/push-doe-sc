import path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const defaultClientsFile = path.join(__dirname, '..', 'clientes.txt')

export const CONFIG = {
  // CLIENTS_FILE aceita .txt (NOME ou NOME;CNH por linha) ou .xlsx
  // Padrão: ./clientes.txt na raiz do projeto.
  CLIENTS_FILE: process.env.CLIENTS_FILE || process.env.EXCEL_PATH || defaultClientsFile,
  // Coluna do NOME na planilha .xlsx. Vazio = detectar pelo cabeçalho ("Nome"/"Cliente"); fallback coluna B.
  // Aceita letra ("B") ou índice 0-based ("1").
  NAME_COLUMN: process.env.NAME_COLUMN || '',
  // Coluna da CNH na planilha .xlsx. Vazio = detectar pelo cabeçalho ("CNH"/"Registro").
  // Aceita letra ("C") ou índice 0-based ("2").
  CNH_COLUMN: process.env.CNH_COLUMN || '',
  CSV_DIR: process.env.CSV_DIR || path.join(__dirname, '..', 'csv'),
  HISTORY_PATH: process.env.HISTORY_PATH || path.join(__dirname, '..', 'data', 'vistos.json'),
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: Number(process.env.SMTP_PORT || 587),
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  EMAIL_FROM: process.env.EMAIL_FROM || process.env.SMTP_USER || '',
  EMAIL_TO: process.env.EMAIL_TO || '',
  DOE_API_URL: 'https://portal.doe.sea.sc.gov.br/apis/busca-materia',
  // Delay entre buscas para não sobrecarregar a API (ms)
  REQUEST_DELAY_MS: 600,
  // Histórico/deduplicação: true (padrão, uso recorrente) ou false (cada busca independente, ex.: skill)
  USE_HISTORY: process.env.USE_HISTORY ? process.env.USE_HISTORY.toLowerCase() !== 'false' : true,
}
