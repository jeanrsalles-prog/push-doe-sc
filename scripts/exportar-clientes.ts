/**
 * Exporta a lista de clientes da planilha Excel para clientes.txt no formato "NOME;CNH".
 * Uso: npm run exportar-clientes
 */
import * as XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import { CONFIG } from '../src/config'
import { normalizarCnh } from '../src/cnh'

const OUTPUT_PATH = path.join(__dirname, '..', 'clientes.txt')

function resolverIndiceColuna(valor: string): number | null {
  const v = valor.trim()
  if (!v) return null
  if (/^\d+$/.test(v)) return parseInt(v, 10)
  let idx = 0
  for (const ch of v.toUpperCase()) {
    if (ch < 'A' || ch > 'Z') return null
    idx = idx * 26 + (ch.charCodeAt(0) - 64)
  }
  return idx - 1
}

function detectarColunaCnh(rows: (string | number | null)[][]): number | null {
  const cab = rows.find((r) => r.some((c) => typeof c === 'string' && c.trim() !== ''))
  if (!cab) return null
  for (let i = 0; i < cab.length; i++) {
    const c = cab[i]
    if (typeof c === 'string' && /\bCNH\b|REGISTRO/i.test(c)) return i
  }
  return null
}

const wb = XLSX.readFile(CONFIG.CLIENTS_FILE)
const ws = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1 })

const colCnh = resolverIndiceColuna(CONFIG.CNH_COLUMN) ?? detectarColunaCnh(rows)
console.log(colCnh === null ? '  [CNH] coluna não encontrada — exportando só nomes.' : `  [CNH] usando coluna índice ${colCnh}.`)

const mapa = new Map<string, string | null>()
for (const row of rows) {
  const valor = row[1]
  if (!valor || typeof valor !== 'string') continue
  const nome = valor.trim().toUpperCase()
  if (nome.length < 3) continue
  const cnh = colCnh !== null ? normalizarCnh(row[colCnh]) : null
  if (!mapa.has(nome) || (mapa.get(nome) === null && cnh)) {
    mapa.set(nome, cnh ?? mapa.get(nome) ?? null)
  }
}

const lista = Array.from(mapa.entries()).sort((a, b) => a[0].localeCompare(b[0]))
const comCnh = lista.filter(([, c]) => c).length

const conteudo = [
  '# Lista de clientes para busca no DOE-SC — formato: NOME;CNH',
  '# Gerado automaticamente em ' + new Date().toLocaleDateString('pt-BR'),
  '# Edite manualmente quando necessário',
  '',
  ...lista.map(([nome, cnh]) => (cnh ? `${nome};${cnh}` : nome)),
  '',
].join('\n')

fs.writeFileSync(OUTPUT_PATH, conteudo, 'utf8')
console.log(`✅ ${lista.length} clientes exportados (${comCnh} com CNH) para clientes.txt`)
