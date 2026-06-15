export interface MateriaAPI {
  id: number
  nrJornal: string
  cdJornal: number
  publicacao: string
  categoria: string
  assunto: string
  resumo: string
  extrato: string
  urlExtrato: string
  cancelada: boolean
}

export interface BuscaAPIResponse {
  total: number
  pagination: { from: number; size: number; total: number }
  materias: MateriaAPI[]
}

/** Cliente do escritório: nome + CNH cadastrada (quando disponível). */
export interface Cliente {
  nome: string
  cnh: string | null
}

export interface DadosPessoa {
  cnh: string
  processoAdmin: string
}

export interface ResultadoBusca {
  clienteNome: string
  materiaId: number
  nrJornal: string
  cdJornal: number
  publicacao: string
  categoria: string
  assunto: string
  tipoDecisao: string
  prazo: number | null
  dataFinal: string | null
  cnh: string
  processoAdmin: string
  extrato: string
  urlExtrato: string
  // Cruzamento nome + CNH
  cnhCliente: string | null
  confirmacao: 'CONFIRMADO' | 'A CONFERIR'
  motivoConferencia: string | null
}
