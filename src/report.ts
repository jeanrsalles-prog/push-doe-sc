import fs from 'fs'
import path from 'path'
import { CONFIG } from './config'
import { ResultadoBusca } from './types'

/** Formata data ISO para dd/mm/aaaa */
function formatarData(iso: string): string {
  // A API entrega a data à meia-noite UTC representando o dia de calendário.
  // Formatamos em UTC para não voltar um dia ao converter para o fuso local.
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

/** Texto curto do status para CSV/e-mail. */
function statusTexto(r: ResultadoBusca): string {
  if (r.confirmacao === 'CONFIRMADO') return 'CONFIRMADO'
  return r.motivoConferencia ? `A CONFERIR (${r.motivoConferencia})` : 'A CONFERIR'
}

/**
 * Neutraliza uma célula de CSV. Dois riscos são tratados aqui:
 *  - Injeção de fórmula: o Excel/Sheets executa células que começam com
 *    = + - @ (ou tab/CR). Prefixamos com apóstrofo para forçar texto.
 *  - Quebra de colunas: valores com ; aspas ou quebra de linha são envolvidos
 *    em aspas duplas (com as aspas internas duplicadas), conforme RFC 4180.
 * Isso evita execução acidental de fórmula vinda do edital e planilha
 * desalinhada quando um nome/resumo contém o separador.
 */
function csvCell(valor: unknown): string {
  let s = valor === null || valor === undefined ? '' : String(valor)
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  if (/[";\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"'
  return s
}

/** Mantém só caracteres seguros para nome de arquivo (evita path traversal). */
function sanitizarNomeArquivo(trecho: string): string {
  return (
    String(trecho)
      .replace(/[^\w.-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^[._]+|[._]+$/g, '') || 'edicao'
  )
}

/**
 * Gera um arquivo CSV por edição (nrJornal) encontrada.
 * Formato do nome: dd-mm-aaaa-nrJornal.csv (saneado).
 * Retorna lista de caminhos gerados.
 */
export function gerarCSVs(resultados: ResultadoBusca[]): string[] {
  if (resultados.length === 0) return []

  if (!fs.existsSync(CONFIG.CSV_DIR)) {
    fs.mkdirSync(CONFIG.CSV_DIR, { recursive: true })
  }

  const porJornal = new Map<string, ResultadoBusca[]>()
  for (const r of resultados) {
    if (!porJornal.has(r.nrJornal)) porJornal.set(r.nrJornal, [])
    porJornal.get(r.nrJornal)!.push(r)
  }

  const arquivosGerados: string[] = []

  for (const [nrJornal, itens] of porJornal) {
    const pubData = formatarData(itens[0].publicacao)
    const [dia, mes, ano] = pubData.split('/')
    const nomeArquivo = `${sanitizarNomeArquivo(`${dia}-${mes}-${ano}-${nrJornal}`)}.csv`
    const caminhoArquivo = path.join(CONFIG.CSV_DIR, nomeArquivo)

    const linhas: string[] = []
    linhas.push(csvCell(`Edição Nº ${nrJornal} — ${pubData}`))
    linhas.push('')
    linhas.push(
      [
        'Status',
        'Nome',
        'Número CNH',
        'Nº Processo Administrativo',
        'Tipo de Decisão',
        'Data Publicação',
        'Prazo (dias)',
        'Data Final para Recurso',
      ]
        .map(csvCell)
        .join(';')
    )

    const ordenados = [...itens].sort((a, b) => {
      if (a.confirmacao !== b.confirmacao) return a.confirmacao === 'CONFIRMADO' ? -1 : 1
      return a.clienteNome.localeCompare(b.clienteNome)
    })
    for (const r of ordenados) {
      linhas.push(
        [
          statusTexto(r),
          r.clienteNome,
          r.cnh,
          r.processoAdmin,
          r.tipoDecisao,
          formatarData(r.publicacao),
          r.prazo ?? '',
          r.dataFinal ?? '',
        ]
          .map(csvCell)
          .join(';')
      )
    }

    // BOM UTF-8 para o Excel abrir corretamente com acentos
    fs.writeFileSync(caminhoArquivo, '﻿' + linhas.join('\n'), 'utf8')
    arquivosGerados.push(caminhoArquivo)
    console.log(`  [CSV] Salvo: ${nomeArquivo} (${itens.length} resultado(s))`)
  }

  return arquivosGerados
}

/**
 * Grava resultados.json com todos os campos de cada achado — fonte que o
 * gerador de planilha/painel (scripts/montar_relatorio.py) consome. Inclui o
 * ID, que permite preservar o bloco de controle entre execuções.
 */
export function gerarResultadosJSON(resultados: ResultadoBusca[]): string | null {
  if (!fs.existsSync(CONFIG.CSV_DIR)) {
    fs.mkdirSync(CONFIG.CSV_DIR, { recursive: true })
  }
  const caminho = path.join(CONFIG.CSV_DIR, 'resultados.json')
  const payload = {
    geradoEm: new Date().toISOString(),
    total: resultados.length,
    resultados: resultados.map((r) => ({
      id: r.materiaId,
      edicao: r.nrJornal,
      status: r.confirmacao,
      motivoConferencia: r.motivoConferencia,
      cliente: r.clienteNome,
      cnh: r.cnh,
      cnhCliente: r.cnhCliente,
      processo: r.processoAdmin,
      tipoDecisao: r.tipoDecisao,
      dataPublicacao: r.publicacao ? formatarData(r.publicacao) : '',
      prazo: r.prazo,
      dataFinal: r.dataFinal,
      link: r.urlExtrato || '',
    })),
  }
  fs.writeFileSync(caminho, JSON.stringify(payload, null, 2), 'utf8')
  console.log(`  [JSON] resultados.json salvo (${resultados.length} registro(s)).`)
  return caminho
}

export interface RelatorioEmail {
  subject: string
  text: string
  html: string
}

/** Monta o relatório de e-mail, agrupado por edição, com link direto para cada publicação. */
export function gerarRelatorioEmail(resultados: ResultadoBusca[]): RelatorioEmail {
  if (resultados.length === 0) {
    return {
      subject: 'PUSH DOE-SC - Nenhuma nova publicação encontrada',
      text: 'Nenhuma nova publicação encontrada no DOE-SC nesta execução.',
      html: '<p>Nenhuma nova publicação encontrada no DOE-SC nesta execução.</p>',
    }
  }

  const porJornal = new Map<string, ResultadoBusca[]>()
  for (const r of resultados) {
    if (!porJornal.has(r.nrJornal)) porJornal.set(r.nrJornal, [])
    porJornal.get(r.nrJornal)!.push(r)
  }

  const total = resultados.length
  const confirmados = resultados.filter((r) => r.confirmacao === 'CONFIRMADO').length
  const aConferir = total - confirmados
  const edicoes = Array.from(porJornal.keys()).sort().join(', ')
  const subject = `PUSH DOE-SC - ${total} nova${total > 1 ? 's' : ''} publicaç${total > 1 ? 'ões' : 'ão'} (${confirmados} confirmada${confirmados !== 1 ? 's' : ''}, ${aConferir} a conferir)`
  const linhasTexto: string[] = [
    `PUSH DOE-SC - Novas publicacoes`,
    `${total} resultado${total > 1 ? 's' : ''} novo${total > 1 ? 's' : ''} — ${confirmados} confirmado(s), ${aConferir} a conferir.`,
    `Edicoes: ${edicoes}`,
    '',
  ]

  const blocosHtml: string[] = [
    '<h1>PUSH DOE-SC - Novas publicacoes</h1>',
    `<p><strong>${total}</strong> resultado${total > 1 ? 's' : ''} novo${total > 1 ? 's' : ''} — <strong>${confirmados}</strong> confirmado(s), <strong>${aConferir}</strong> a conferir.</p>`,
  ]

  for (const [nrJornal, itens] of porJornal) {
    const pubData = formatarData(itens[0].publicacao)
    linhasTexto.push(`Edicao ${nrJornal} - ${pubData}`)
    blocosHtml.push(`<h2>Edicao ${escapeHtml(nrJornal)} - ${escapeHtml(pubData)}</h2>`)
    blocosHtml.push('<table border="1" cellpadding="6" cellspacing="0">')
    blocosHtml.push('<thead><tr><th>Status</th><th>Cliente</th><th>CNH</th><th>Processo</th><th>Decisao</th><th>Prazo</th><th>Link</th></tr></thead><tbody>')

    const ordenados = [...itens].sort((a, b) => {
      if (a.confirmacao !== b.confirmacao) return a.confirmacao === 'CONFIRMADO' ? -1 : 1
      return a.clienteNome.localeCompare(b.clienteNome)
    })
    for (const r of ordenados) {
      const prazoTexto = r.dataFinal ? `Recurso até: ${r.dataFinal}` : 'Prazo: N/D'
      const link = r.urlExtrato || ''
      const status = statusTexto(r)

      linhasTexto.push(`- [${status}] ${r.clienteNome} - ${r.tipoDecisao}`)
      linhasTexto.push(`  CNH: ${r.cnh} | Processo: ${r.processoAdmin}`)
      linhasTexto.push(`  ${prazoTexto}`)
      if (link) linhasTexto.push(`  Link: ${link}`)

      blocosHtml.push('<tr>')
      blocosHtml.push(`<td>${escapeHtml(status)}</td>`)
      blocosHtml.push(`<td>${escapeHtml(r.clienteNome)}</td>`)
      blocosHtml.push(`<td>${escapeHtml(r.cnh)}</td>`)
      blocosHtml.push(`<td>${escapeHtml(r.processoAdmin)}</td>`)
      blocosHtml.push(`<td>${escapeHtml(r.tipoDecisao)}</td>`)
      blocosHtml.push(`<td>${escapeHtml(prazoTexto)}</td>`)
      blocosHtml.push(`<td>${link ? `<a href="${escapeHtml(link)}">Ver publicacao</a>` : 'N/D'}</td>`)
      blocosHtml.push('</tr>')
    }

    linhasTexto.push('')
    blocosHtml.push('</tbody></table>')
  }

  return {
    subject,
    text: linhasTexto.join('\n'),
    html: blocosHtml.join('\n'),
  }
}

function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
