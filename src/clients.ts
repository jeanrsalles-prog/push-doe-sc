import * as XLSX from 'xlsx'
import fs from 'fs'
import { CONFIG } from './config'
import { Cliente } from './types'
import { normalizarCnh } from './cnh'

export function getClientes(): Cliente[] {
  const filePath = CONFIG.CLIENTS_FILE

  if (filePath.toLowerCase().endsWith('.txt')) {
    return lerClientesTxt(filePath)
  } else {
    return lerClientesExcel(filePath)
  }
}

/**
 * Lê clientes de um .txt — uma linha por cliente, no formato "NOME" ou "NOME;CNH".
 * Linhas iniciadas por # são ignoradas.
 */
function lerClientesTxt(filePath: string): Cliente[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo de clientes não encontrado: ${filePath}`)
  }

  const conteudo = fs.readFileSync(filePath, 'utf8')
  const mapa = new Map<string, string | null>()

  for (const linha of conteudo.split('\n')) {
    const bruta = linha.trim()
    if (bruta.length < 3 || bruta.startsWith('#')) continue

    const [nomeParte, cnhParte] = bruta.split(';')
    const nome = nomeParte.trim().toUpperCase()
    if (nome.length < 3) continue

    const cnh = normalizarCnh(cnhParte)
    if (!mapa.has(nome) || (mapa.get(nome) === null && cnh)) {
      mapa.set(nome, cnh ?? mapa.get(nome) ?? null)
    }
  }

  return ordenar(mapa)
}

/** Converte uma letra de coluna ("A","B","C") ou índice ("0","2") em índice 0-based. */
export function resolverIndiceColuna(valor: string): number | null {
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

/** Linha de cabeçalho = primeira linha com algum texto. */
function linhaCabecalho(rows: (string | number | null)[][]): (string | number | null)[] | null {
  return rows.find((r) => r.some((c) => typeof c === 'string' && c.trim() !== '')) ?? null
}

/** Detecta a coluna por palavras-chave no cabeçalho. */
function detectarColuna(rows: (string | number | null)[][], padrao: RegExp): number | null {
  const cab = linhaCabecalho(rows)
  if (!cab) return null
  for (let i = 0; i < cab.length; i++) {
    const c = cab[i]
    if (typeof c === 'string' && padrao.test(c)) return i
  }
  return null
}

/**
 * Lê clientes da planilha Excel.
 *  - Nome: coluna NAME_COLUMN, ou detectada pelo cabeçalho ("Nome"/"Cliente"), ou coluna B (fallback).
 *  - CNH: coluna CNH_COLUMN, ou detectada pelo cabeçalho ("CNH"/"Registro").
 */
function lerClientesExcel(filePath: string): Cliente[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Planilha de clientes não encontrada: ${filePath}`)
  }

  const wb = XLSX.readFile(filePath)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1 })

  const colNome =
    resolverIndiceColuna(CONFIG.NAME_COLUMN) ??
    detectarColuna(rows, /\bNOME\b|CLIENTE/i) ??
    1 // fallback: coluna B
  const colCnh = resolverIndiceColuna(CONFIG.CNH_COLUMN) ?? detectarColuna(rows, /\bCNH\b|REGISTRO/i)

  console.log(`  [PLANILHA] Nome na coluna índice ${colNome}; CNH ${colCnh === null ? 'NÃO encontrada (defina CNH_COLUMN)' : 'na coluna índice ' + colCnh}.`)

  const mapa = new Map<string, string | null>()

  for (const row of rows) {
    const valorNome = row[colNome]
    if (!valorNome || typeof valorNome !== 'string') continue
    const nome = valorNome.trim().toUpperCase()
    if (nome.length < 3) continue
    // pula a própria linha de cabeçalho
    if (/^(NOME|CLIENTE)\b/.test(nome)) continue

    const cnh = colCnh !== null ? normalizarCnh(row[colCnh]) : null
    if (!mapa.has(nome) || (mapa.get(nome) === null && cnh)) {
      mapa.set(nome, cnh ?? mapa.get(nome) ?? null)
    }
  }

  return ordenar(mapa)
}

function ordenar(mapa: Map<string, string | null>): Cliente[] {
  return Array.from(mapa.entries())
    .map(([nome, cnh]) => ({ nome, cnh }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
}
