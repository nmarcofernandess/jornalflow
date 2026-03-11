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

export async function listarJornais(): Promise<Jornal[]> {
  return queryAll<Jornal>('SELECT * FROM jornais ORDER BY criado_em DESC')
}

export async function dashboardStats(): Promise<{
  total_produtos: number
  produtos_com_imagem: number
  total_jornais: number
  ultimo_exportado: Jornal | null
  rascunho_atual: Jornal | null
}> {
  const total_produtos = await queryOne<{ count: number }>(
    'SELECT COUNT(*)::int as count FROM produtos WHERE ativo = true'
  )

  const produtos_com_imagem = await queryOne<{ count: number }>(
    'SELECT COUNT(DISTINCT pi.produto_id)::int as count FROM produto_imagens pi JOIN produtos p ON p.produto_id = pi.produto_id WHERE p.ativo = true'
  )

  const total_jornais = await queryOne<{ count: number }>(
    'SELECT COUNT(*)::int as count FROM jornais'
  )

  const ultimo_exportado = await queryOne<Jornal>(
    "SELECT * FROM jornais WHERE status = 'exportado' ORDER BY atualizado_em DESC LIMIT 1"
  )

  const rascunho_atual = await queryOne<Jornal>(
    "SELECT * FROM jornais WHERE status = 'rascunho' ORDER BY criado_em DESC LIMIT 1"
  )

  return {
    total_produtos: total_produtos?.count ?? 0,
    produtos_com_imagem: produtos_com_imagem?.count ?? 0,
    total_jornais: total_jornais?.count ?? 0,
    ultimo_exportado: ultimo_exportado ?? null,
    rascunho_atual: rascunho_atual ?? null
  }
}

export async function buscarProdutoNoHistorico(produto_id: number): Promise<Array<{
  jornal_id: number
  titulo: string | null
  data_inicio: string
  data_fim: string
  preco_oferta: number
  preco_clube: number
}>> {
  return queryAll(
    `SELECT j.jornal_id, j.titulo, j.data_inicio, j.data_fim, ji.preco_oferta, ji.preco_clube
     FROM jornal_itens ji
     JOIN jornais j ON j.jornal_id = ji.jornal_id
     WHERE ji.produto_id = $1
     ORDER BY j.data_inicio DESC`,
    [produto_id]
  )
}

export async function getLoja(): Promise<Loja | null> {
  return queryOne<Loja>('SELECT * FROM lojas LIMIT 1')
}

export async function atualizarLoja(changes: Partial<Omit<Loja, 'loja_id'>>): Promise<Loja> {
  const loja = await queryOne<Loja>('SELECT * FROM lojas LIMIT 1')
  if (!loja) throw new Error('Loja não encontrada')

  const allowed = new Set(['nome', 'endereco', 'telefone', 'horario_func', 'logo_path'])
  const sets: string[] = []
  const params: unknown[] = []
  let i = 1

  for (const [key, value] of Object.entries(changes)) {
    if (!allowed.has(key)) continue
    sets.push(`${key} = $${i++}`)
    params.push(value)
  }

  if (sets.length > 0) {
    params.push(loja.loja_id)
    await execute(
      `UPDATE lojas SET ${sets.join(', ')} WHERE loja_id = $${i}`,
      params
    )
  }

  return (await queryOne<Loja>('SELECT * FROM lojas LIMIT 1'))!
}
