import { queryAll, queryOne, execute } from '../db/query'
import type {
  Jornal,
  JornalPagina,
  JornalSecao,
  JornalItem,
  Produto,
  ProdutoImagem,
  TemplateSecao,
  Loja
} from '../../shared/types'

export interface FullJournalData {
  jornal: Jornal
  paginas: JornalPagina[]
  secoes: JornalSecao[]
  itens: JornalItem[]
  produtos: Produto[]
  imagens: ProdutoImagem[]
  templates: TemplateSecao[]
  loja: Loja | null
}

export async function carregarJornal(jornal_id: number): Promise<FullJournalData> {
  const jornal = await queryOne<Jornal>(
    'SELECT * FROM jornais WHERE jornal_id = $1',
    [jornal_id]
  )
  if (!jornal) throw new Error(`Jornal ${jornal_id} não encontrado`)

  const paginas = await queryAll<JornalPagina>(
    'SELECT * FROM jornal_paginas WHERE jornal_id = $1 ORDER BY numero',
    [jornal_id]
  )

  const secoes = await queryAll<JornalSecao>(
    'SELECT * FROM jornal_secoes WHERE jornal_id = $1 ORDER BY posicao',
    [jornal_id]
  )

  const itens = await queryAll<JornalItem>(
    'SELECT * FROM jornal_itens WHERE jornal_id = $1 ORDER BY posicao',
    [jornal_id]
  )

  // Get unique produto_ids from items
  const produto_ids = [...new Set(itens.map((i) => i.produto_id))]

  let produtos: Produto[] = []
  let imagens: ProdutoImagem[] = []

  if (produto_ids.length > 0) {
    // PGlite doesn't support ANY($1) with array params — use IN with spread params
    const placeholders = produto_ids.map((_, i) => `$${i + 1}`).join(', ')
    produtos = await queryAll<Produto>(
      `SELECT * FROM produtos WHERE produto_id IN (${placeholders})`,
      produto_ids
    )
    imagens = await queryAll<ProdutoImagem>(
      `SELECT * FROM produto_imagens WHERE produto_id IN (${placeholders})`,
      produto_ids
    )
  }

  const templates = await queryAll<TemplateSecao>('SELECT * FROM template_secoes')

  const loja = await queryOne<Loja>('SELECT * FROM lojas LIMIT 1')

  return { jornal, paginas, secoes, itens, produtos, imagens, templates, loja }
}

export async function atualizarItem(
  item_id: number,
  changes: Record<string, unknown>
): Promise<void> {
  const sets: string[] = []
  const params: unknown[] = []
  let i = 1

  // Whitelist of allowed columns to prevent SQL injection
  const allowed = new Set([
    'posicao',
    'produto_id',
    'preco_oferta',
    'preco_clube',
    'unidade_display',
    'imagem_id',
    'is_fallback',
    'img_scale',
    'img_offset_x',
    'img_offset_y',
    'imgs_compostas'
  ])

  for (const [key, value] of Object.entries(changes)) {
    if (!allowed.has(key)) continue
    sets.push(`${key} = $${i++}`)
    params.push(value)
  }

  if (sets.length === 0) return

  params.push(item_id)
  await execute(
    `UPDATE jornal_itens SET ${sets.join(', ')} WHERE item_id = $${i}`,
    params
  )
}

export async function listarRascunhos(): Promise<Jornal[]> {
  return queryAll<Jornal>(
    "SELECT * FROM jornais WHERE status = 'rascunho' ORDER BY criado_em DESC"
  )
}
