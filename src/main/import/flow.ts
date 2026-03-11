import { parsePlanilha } from './parser'
import { matchProduto } from './matcher'
import { criarProduto } from '../servicos/produtos'
import { queryOne, queryAll, execute } from '../db/query'
import type { ImportResult, MatchResult, TemplateSecao } from '../../shared/types'

interface ImportInput {
  text: string
  data_inicio: string
  data_fim: string
  arquivo_nome: string
}

export async function importarPlanilha(input: ImportInput): Promise<ImportResult> {
  const { rows } = parsePlanilha(input.text)

  // Match + auto-create missing products
  const results: MatchResult[] = []
  for (const row of rows) {
    let matchResult = await matchProduto(row)

    // Auto-create missing product
    if (matchResult.status === 'nao_encontrado') {
      const newProduto = await criarProduto({
        codigo: row.codigo,
        nome: row.descricao,
        unidade: row.unidade_extraida || 'UN'
      })
      matchResult = {
        row,
        produto: newProduto,
        imagem: null,
        status: 'fallback',
        motivo: 'Produto auto-cadastrado, sem imagem'
      }
    }
    results.push(matchResult)
  }

  // Create journal
  await execute(
    `INSERT INTO jornais (titulo, tipo, data_inicio, data_fim, status)
     VALUES ($1, 'semanal', $2, $3, 'rascunho')`,
    [`Ofertas ${input.data_inicio} a ${input.data_fim}`, input.data_inicio, input.data_fim]
  )
  const jornal = await queryOne<{ jornal_id: number }>(
    'SELECT jornal_id FROM jornais ORDER BY jornal_id DESC LIMIT 1'
  )
  const jornal_id = jornal!.jornal_id

  // Create pages (semanal = 3 pages)
  const pages = [
    { numero: 1, layout: 'full' },
    { numero: 2, layout: 'dupla' },
    { numero: 3, layout: 'dupla' }
  ]
  for (const page of pages) {
    await execute(
      'INSERT INTO jornal_paginas (jornal_id, numero, layout) VALUES ($1, $2, $3)',
      [jornal_id, page.numero, page.layout]
    )
  }

  // Create sections from template
  const templateSecoes = await queryAll<TemplateSecao>(
    'SELECT * FROM template_secoes ORDER BY pagina, posicao'
  )

  const secaoMap = new Map<string, number>() // alias → jornal_secao_id

  for (const ts of templateSecoes) {
    const pagina = await queryOne<{ pagina_id: number }>(
      'SELECT pagina_id FROM jornal_paginas WHERE jornal_id = $1 AND numero = $2',
      [jornal_id, ts.pagina]
    )

    await execute(
      `INSERT INTO jornal_secoes (jornal_id, pagina_id, template_secao_id, posicao, lado, grid_cols, grid_rows)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [jornal_id, pagina!.pagina_id, ts.secao_id, ts.posicao, ts.lado, ts.grid_cols, ts.grid_rows]
    )

    const secao = await queryOne<{ jornal_secao_id: number }>(
      'SELECT jornal_secao_id FROM jornal_secoes WHERE jornal_id = $1 AND template_secao_id = $2',
      [jornal_id, ts.secao_id]
    )

    // Map aliases to this section
    const aliases = await queryAll<{ alias: string }>(
      'SELECT alias FROM secao_aliases WHERE secao_id = $1', [ts.secao_id]
    )
    for (const a of aliases) {
      secaoMap.set(a.alias, secao!.jornal_secao_id)
    }
  }

  // Create items
  const positionCounters = new Map<number, number>() // jornal_secao_id → counter

  for (const result of results) {
    if (!result.produto) continue

    const alias = result.row.tipo_oferta?.toUpperCase() || ''
    const secaoId = secaoMap.get(alias)
    if (!secaoId) continue // skip items with unknown section

    const pos = (positionCounters.get(secaoId) || 0) + 1
    positionCounters.set(secaoId, pos)

    await execute(
      `INSERT INTO jornal_itens (jornal_id, jornal_secao_id, posicao, produto_id, preco_oferta, preco_clube, unidade_display, imagem_id, is_fallback)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [jornal_id, secaoId, pos, result.produto.produto_id,
       result.row.preco_oferta, result.row.preco_clube,
       result.row.unidade_extraida, result.imagem?.imagem_id || null,
       result.status === 'fallback']
    )
  }

  // Stats
  const stats = {
    total: results.length,
    matched: results.filter(r => r.status === 'match').length,
    fallbacks: results.filter(r => r.status === 'fallback').length,
    nao_encontrados: 0 // all were auto-created, so 0 after import
  }

  // Create importacao record
  await execute(
    `INSERT INTO importacoes (jornal_id, arquivo_nome, total_itens, matched, fallbacks, nao_encontrados)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [jornal_id, input.arquivo_nome, stats.total, stats.matched, stats.fallbacks, stats.nao_encontrados]
  )

  return { jornal_id, rows: results, ...stats }
}
