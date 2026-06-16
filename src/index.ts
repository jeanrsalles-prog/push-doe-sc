import path from 'path'
import { getClientes } from './clients'
import { buscarTodosClientes } from './searcher'
import { processarMateria } from './parser'
import { jaRegistrado, salvarResultados } from './db'
import { gerarCSVs, gerarRelatorioEmail, gerarResultadosJSON } from './report'
import { enviarEmail, emailConfigurado } from './notifier'
import { CONFIG } from './config'
import { Cliente, ResultadoBusca } from './types'

async function executarBusca(): Promise<void> {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`[${new Date().toLocaleString('pt-BR')}] Iniciando busca no DOE-SC...`)
  console.log('='.repeat(60))

  // 1. Carrega lista de clientes (nome + CNH)
  let clientes: Cliente[]
  try {
    clientes = getClientes()
    const comCnh = clientes.filter((c) => c.cnh).length
    console.log(`\n[1/4] ${clientes.length} clientes carregados (${comCnh} com CNH cadastrada).`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Não foi possível ler a lista de clientes: ${msg}`)
  }

  if (clientes.length === 0) {
    throw new Error('A lista de clientes está vazia. Popule clientes.txt antes de rodar a automação.')
  }

  // Índice nome -> CNH para o cruzamento
  const cnhPorNome = new Map<string, string | null>()
  for (const c of clientes) cnhPorNome.set(c.nome, c.cnh)

  // 2. Busca no DOE para cada cliente
  console.log(`\n[2/4] Buscando no DOE-SC (isso pode levar alguns minutos)...`)
  const resultadosAPI = await buscarTodosClientes(
    clientes,
    (atual, total, nome) => {
      process.stdout.write(`\r  ${atual}/${total} — ${nome.padEnd(40)}`)
    }
  )
  console.log(`\n  ${resultadosAPI.size} cliente(s) com publicações encontradas.`)

  // 3. Processa e filtra resultados novos
  console.log(`\n[3/4] Processando resultados${CONFIG.USE_HISTORY ? ' (filtrando novidades contra o histórico)' : ' (histórico desligado — busca independente)'}...`)
  const novos: ResultadoBusca[] = []

  for (const [clienteNome, materias] of resultadosAPI) {
    const cnhCliente = cnhPorNome.get(clienteNome) ?? null
    for (const materia of materias) {
      // Pula se já foi registrado antes (somente quando o histórico está ligado)
      if (CONFIG.USE_HISTORY && jaRegistrado(materia.id, clienteNome)) continue

      const resultado = processarMateria(materia, clienteNome, cnhCliente)
      if (!resultado) continue

      novos.push(resultado)
      const flag = resultado.confirmacao === 'CONFIRMADO' ? 'CONFIRMADO' : 'A CONFERIR'
      console.log(`  [${flag}] ${clienteNome} — Edição ${materia.nrJornal} — ${resultado.tipoDecisao}`)
    }
  }

  const confirmados = novos.filter((r) => r.confirmacao === 'CONFIRMADO').length
  const aConferir = novos.length - confirmados
  console.log(`  ${novos.length} resultado(s) — ${confirmados} confirmado(s), ${aConferir} a conferir.`)

  // 4. Gera os arquivos (sempre) e notifica por e-mail (se configurado)
  console.log('\n[4/4] Gerando relatório...')
  const csvs = gerarCSVs(novos)
  gerarResultadosJSON(novos)
  const relatorio = gerarRelatorioEmail(novos)

  if (csvs.length > 0) {
    console.log(`  Arquivos gerados em ${CONFIG.CSV_DIR}: ${csvs.map((c) => path.basename(c)).join(', ')}`)
  }

  if (emailConfigurado()) {
    await enviarEmail(relatorio, csvs)
  } else {
    console.log('  [EMAIL] SMTP não configurado — relatório entregue apenas como arquivos (sem envio de e-mail).')
  }

  // Histórico só é gravado quando ligado
  if (CONFIG.USE_HISTORY) {
    salvarResultados(novos)
    console.log('  [HISTÓRICO] Atualizado.')
  }

  console.log('\n✅ Busca concluída.\n')

  // Resumo legível por máquina (a skill lê esta linha para montar o resumo no chat)
  const resumo = {
    ok: true,
    total: novos.length,
    confirmados,
    aConferir,
    edicoes: Array.from(new Set(novos.map((r) => r.nrJornal))).sort(),
    clientesComPublicacao: resultadosAPI.size,
    arquivos: csvs.map((c) => path.basename(c)),
    diretorioCsv: CONFIG.CSV_DIR,
    usouHistorico: CONFIG.USE_HISTORY,
    emailEnviado: emailConfigurado(),
  }
  console.log('__RESUMO_JSON__')
  console.log(JSON.stringify(resumo))
}

executarBusca().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error('[FATAL]', err)
  console.log('__RESUMO_JSON__')
  console.log(JSON.stringify({ ok: false, erro: msg }))
  process.exit(1)
})
