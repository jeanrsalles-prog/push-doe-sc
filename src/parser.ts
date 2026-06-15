import { DadosPessoa, MateriaAPI, ResultadoBusca } from './types'
import { cnhIgual } from './cnh'

function textoDaMateria(materia: MateriaAPI): string {
  return [
    materia.categoria,
    materia.assunto,
    materia.resumo,
    materia.extrato,
  ].join(' ').toUpperCase()
}

function ehPublicacaoDetran(materia: MateriaAPI): boolean {
  const texto = textoDaMateria(materia)
  return (
    texto.includes('DETRAN') ||
    texto.includes('DEPARTAMENTO ESTADUAL DE TRÂNSITO') ||
    texto.includes('DEPARTAMENTO ESTADUAL DE TRANSITO')
  )
}

/** Escapa caracteres especiais de um nome para uso seguro em regex. */
function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Verifica se o nome do cliente aparece no texto respeitando limites de palavra.
 * Evita falsos positivos como "ANA SILVA" casando dentro de "MARIANA SILVA".
 */
export function nomeAparece(resumo: string, nomeCliente: string): boolean {
  const regex = new RegExp(
    '(?<![A-Za-zÀ-ÿ])' + escaparRegex(nomeCliente) + '(?![A-Za-zÀ-ÿ])',
    'i'
  )
  return regex.test(resumo)
}

/**
 * Extrai CNH e número do processo administrativo para um cliente específico
 * dentro do texto do resumo do edital.
 *
 * Padrões reais cobertos (DOE-SC / DETRAN):
 *   Decisão JARI:  NOME, portador(a) da CNH nº XXXXXXXXX, processo administrativo nº XXX/XXXX;
 *   Instauração:   ... a: NOME, portador(a) da CNH nº XXXXXXXXX, que tramita ... o processo administrativo XXX/XXXX
 *
 * CNH e processo são extraídos de forma independente, e o "nº" é opcional —
 * editais de instauração escrevem "processo administrativo XXXXX/AAAA" sem o "nº".
 */
export function extrairDadosPessoa(resumo: string, nomeCliente: string): DadosPessoa | null {
  // Localiza o nome (com limite de palavra) e isola o trecho que descreve essa pessoa.
  const ancora = new RegExp(
    '(?<![A-Za-zÀ-ÿ])' + escaparRegex(nomeCliente) + '(?![A-Za-zÀ-ÿ])([\\s\\S]{0,220})',
    'i'
  )
  const m = resumo.match(ancora)
  if (!m) return null

  // Limita ao clause da própria pessoa: nos editais de decisão, cada pessoa
  // é separada por ";", então cortamos ali para não pegar a CNH do seguinte.
  let trecho = m[1]
  const fimClause = trecho.indexOf(';')
  if (fimClause !== -1) trecho = trecho.slice(0, fimClause)

  // CNH: "portador(a) da CNH nº 02317185728" — "nº" tolerante a variações.
  const mCnh = trecho.match(/CNH\s*n?[oº°.\s]*([\d]{6,})/i)

  // Processo: "processo administrativo nº 3115/2025" ou, sem "nº", "processo administrativo 27778/2026".
  const mProc = trecho.match(/processo administrativo\s*(?:n[oº°.]*\s*)?([\d]+\/[\d]{2,4})/i)

  if (!mCnh && !mProc) return null

  return {
    cnh: mCnh ? mCnh[1].trim() : 'N/D',
    processoAdmin: mProc ? mProc[1].trim() : 'N/D',
  }
}

/**
 * Determina o tipo de decisão a partir do texto do resumo.
 * Retorna o texto completo encontrado (ex: "INDEFERIMENTO", "DEFERIMENTO", etc.)
 */
export function extrairTipoDecisao(resumo: string): string {
  // Tenta capturar o verbo exato da decisão
  const matchVerbo = resumo.match(
    /decisão prolatada foi pelo seu\s+(INDEFERIMENTO|DEFERIMENTO)/i
  )
  if (matchVerbo) return matchVerbo[1].toUpperCase()

  // Fallback: busca palavras-chave no texto
  if (/\bINDEFERIMENTO\b/i.test(resumo)) return 'INDEFERIMENTO'
  if (/\bDEFERIMENTO\b|\bDEFERIDA\b|\bDEFERIDO\b/i.test(resumo)) return 'DEFERIMENTO'
  if (/\bCONCEDIDO\b/i.test(resumo)) return 'CONCEDIDO'
  if (/\bARQUIVADO\b/i.test(resumo)) return 'ARQUIVADO'
  if (/INSTAURAÇÃO DE PROCESSO/i.test(resumo)) return 'INSTAURAÇÃO DE PROCESSO'

  return 'NÃO IDENTIFICADO'
}

/**
 * Extrai o prazo em dias do texto do resumo.
 * Ex: "no prazo de 50 (cinquenta) dias" → 50
 */
export function extrairPrazo(resumo: string): number | null {
  const match = resumo.match(/prazo de\s+(\d+)\s*\([^)]+\)\s*dias/i)
  if (match) return parseInt(match[1], 10)

  // Fallback: "50 dias contados" ou "no prazo de 30 dias"
  const fallback = resumo.match(/(?:prazo de\s+)?(\d+)\s+dias(?:\s+contados)?/i)
  if (fallback) return parseInt(fallback[1], 10)

  return null
}

/**
 * Calcula a data final para protocolo do recurso.
 * data publicação + prazo em dias → formato dd/mm/aaaa
 */
export function calcularDataFinal(publicacao: string, prazo: number): string {
  const data = new Date(publicacao)
  data.setUTCDate(data.getUTCDate() + prazo)
  return data.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

/**
 * Processa uma matéria da API e retorna o ResultadoBusca para o cliente buscado,
 * ou null se o cliente não for encontrado no texto.
 */
export function processarMateria(
  materia: MateriaAPI,
  clienteNome: string,
  cnhCliente: string | null = null
): ResultadoBusca | null {
  if (!ehPublicacaoDetran(materia)) return null

  // Verifica se o nome do cliente realmente aparece no resumo (com limite de palavra)
  if (!nomeAparece(materia.resumo, clienteNome)) return null

  const dados = extrairDadosPessoa(materia.resumo, clienteNome)
  const tipoDecisao = extrairTipoDecisao(materia.resumo)
  const prazo = extrairPrazo(materia.resumo)
  const dataFinal = prazo ? calcularDataFinal(materia.publicacao, prazo) : null

  const cnhEdital = dados && dados.cnh !== 'N/D' ? dados.cnh : null

  // Cruzamento nome + CNH
  let confirmacao: 'CONFIRMADO' | 'A CONFERIR' = 'A CONFERIR'
  let motivoConferencia: string | null = null

  if (cnhCliente) {
    if (cnhEdital) {
      if (cnhIgual(cnhEdital, cnhCliente)) {
        confirmacao = 'CONFIRMADO'
      } else {
        // Mesmo nome, CNH diferente -> homônimo. Descarta.
        return null
      }
    } else {
      motivoConferencia = 'CNH não consta no edital'
    }
  } else {
    motivoConferencia = 'cliente sem CNH cadastrada'
  }

  return {
    clienteNome,
    materiaId: materia.id,
    nrJornal: materia.nrJornal,
    cdJornal: materia.cdJornal,
    publicacao: materia.publicacao,
    categoria: materia.categoria,
    assunto: materia.assunto,
    tipoDecisao,
    prazo,
    dataFinal,
    cnh: dados?.cnh ?? 'N/D',
    processoAdmin: dados?.processoAdmin ?? 'N/D',
    extrato: materia.extrato,
    // A API do DOE-SC retorna a URL da matéria no campo "extrato" (não há "urlExtrato").
    urlExtrato: materia.extrato,
    cnhCliente,
    confirmacao,
    motivoConferencia,
  }
}
