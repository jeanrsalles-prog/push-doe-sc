import fs from 'fs'
import path from 'path'
import { CONFIG } from './config'
import { ResultadoBusca } from './types'

interface Historico {
  vistos: string[]
  atualizadoEm: string | null
}

let historicoCache: Set<string> | null = null

function chaveResultado(materiaId: number, clienteNome: string): string {
  return `${materiaId}:${clienteNome.trim().toUpperCase()}`
}

function carregarHistorico(): Set<string> {
  if (historicoCache) return historicoCache

  const dir = path.dirname(CONFIG.HISTORY_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  if (!fs.existsSync(CONFIG.HISTORY_PATH)) {
    historicoCache = new Set()
    return historicoCache
  }

  const raw = fs.readFileSync(CONFIG.HISTORY_PATH, 'utf8').trim()
  if (!raw) {
    historicoCache = new Set()
    return historicoCache
  }

  const parsed = JSON.parse(raw) as Historico
  historicoCache = new Set(parsed.vistos || [])
  return historicoCache
}

export function jaRegistrado(materiaId: number, clienteNome: string): boolean {
  return carregarHistorico().has(chaveResultado(materiaId, clienteNome))
}

export function salvarResultados(resultados: ResultadoBusca[]): void {
  if (resultados.length === 0) return

  const vistos = carregarHistorico()
  for (const r of resultados) {
    vistos.add(chaveResultado(r.materiaId, r.clienteNome))
  }

  const payload: Historico = {
    vistos: Array.from(vistos).sort(),
    atualizadoEm: new Date().toISOString(),
  }

  fs.writeFileSync(CONFIG.HISTORY_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8')
}
