import { queryOne, queryAll } from '../db/query'
import type { PlanilhaRow, MatchResult, Produto, ProdutoImagem } from '../../shared/types'

export async function matchProduto(row: PlanilhaRow): Promise<MatchResult> {
  // Find product by codigo
  const produto = await queryOne<Produto>(
    'SELECT * FROM produtos WHERE codigo = $1 AND ativo = true', [row.codigo]
  )

  if (!produto) {
    return { row, produto: null, imagem: null, status: 'nao_encontrado', motivo: 'Produto não cadastrado' }
  }

  // Find images
  const imagens = await queryAll<ProdutoImagem>(
    'SELECT * FROM produto_imagens WHERE produto_id = $1 ORDER BY is_default DESC',
    [produto.produto_id]
  )

  if (imagens.length === 0) {
    return { row, produto, imagem: null, status: 'fallback', motivo: 'Produto sem imagem cadastrada' }
  }

  const defaultImg = imagens.find(i => i.is_default)
  if (defaultImg) {
    return { row, produto, imagem: defaultImg, status: 'match', motivo: null }
  }

  // Has images but no default
  return { row, produto, imagem: imagens[0], status: 'fallback', motivo: 'Imagem genérica usada (sem default)' }
}

export async function matchAll(rows: PlanilhaRow[]): Promise<MatchResult[]> {
  const results: MatchResult[] = []
  for (const row of rows) {
    results.push(await matchProduto(row))
  }
  return results
}
