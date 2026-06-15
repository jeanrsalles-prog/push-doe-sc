import axios from 'axios'
import { BuscaAPIResponse, Cliente, MateriaAPI } from './types'
import { CONFIG } from './config'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function buscarNoDoE(nome: string): Promise<MateriaAPI[]> {
  const size = 50
  const materias: MateriaAPI[] = []
  let from = 0
  let total = 0

  try {
    do {
      const payload = {
        busca: nome,
        tipoBusca: 2, // "Qualquer Resultado" — filtramos manualmente depois
        pagination: { from, size },
        resumo: false,
        aCdAssunto: [],
        aCdCategoria: [],
      }

      const { data } = await axios.post<BuscaAPIResponse>(CONFIG.DOE_API_URL, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      })

      total = data.pagination?.total ?? data.total ?? 0
      materias.push(...(data.materias || []))
      from += size
    } while (from < total)

    return materias.filter((m) => !m.cancelada && m.resumo)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Busca falhou para "${nome}": ${msg}`)
  }
}

export async function buscarTodosClientes(
  clientes: Cliente[],
  onProgress?: (atual: number, total: number, nome: string) => void
): Promise<Map<string, MateriaAPI[]>> {
  const resultados = new Map<string, MateriaAPI[]>()
  const erros: string[] = []

  for (let i = 0; i < clientes.length; i++) {
    const nome = clientes[i].nome
    onProgress?.(i + 1, clientes.length, nome)

    try {
      const materias = await buscarNoDoE(nome)
      if (materias.length > 0) {
        resultados.set(nome, materias)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`\n  [ERRO] ${msg}`)
      erros.push(msg)
    }

    // Delay entre chamadas para não sobrecarregar a API
    if (i < clientes.length - 1) {
      await sleep(CONFIG.REQUEST_DELAY_MS)
    }
  }

  if (erros.length > 0) {
    throw new Error(`A busca no DOE-SC falhou para ${erros.length} cliente(s). Nenhum histórico será atualizado.`)
  }

  return resultados
}
