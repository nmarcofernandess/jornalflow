import { queryAll, queryOne, execute } from '../db/query'
import type { Produto } from '../../shared/types'

export async function listarProdutos(): Promise<Produto[]> {
  return queryAll<Produto>('SELECT * FROM produtos WHERE ativo = true ORDER BY nome')
}

export async function buscarProdutos(termo: string): Promise<Produto[]> {
  return queryAll<Produto>(
    `SELECT * FROM produtos WHERE ativo = true AND (
      nome ILIKE $1 OR codigo = $2 OR categoria ILIKE $1
    ) ORDER BY nome`,
    [`%${termo}%`, termo]
  )
}

export async function criarProduto(data: {
  codigo: string
  nome: string
  unidade: string
  nome_card?: string
  categoria?: string
}): Promise<Produto> {
  const existing = await queryOne<Produto>(
    'SELECT * FROM produtos WHERE codigo = $1',
    [data.codigo]
  )
  if (existing) throw new Error(`Produto com código ${data.codigo} já existe`)

  await execute(
    `INSERT INTO produtos (codigo, nome, unidade, nome_card, categoria)
     VALUES ($1, $2, $3, $4, $5)`,
    [data.codigo, data.nome, data.unidade, data.nome_card ?? null, data.categoria ?? null]
  )
  return (await queryOne<Produto>('SELECT * FROM produtos WHERE codigo = $1', [data.codigo]))!
}

export async function atualizarProduto(
  produto_id: number,
  changes: {
    nome?: string
    nome_card?: string
    unidade?: string
    categoria?: string
  }
): Promise<Produto> {
  const sets: string[] = ['atualizado_em = NOW()']
  const params: unknown[] = []
  let i = 1

  if (changes.nome !== undefined) {
    sets.push(`nome = $${i++}`)
    params.push(changes.nome)
  }
  if (changes.nome_card !== undefined) {
    sets.push(`nome_card = $${i++}`)
    params.push(changes.nome_card)
  }
  if (changes.unidade !== undefined) {
    sets.push(`unidade = $${i++}`)
    params.push(changes.unidade)
  }
  if (changes.categoria !== undefined) {
    sets.push(`categoria = $${i++}`)
    params.push(changes.categoria)
  }

  params.push(produto_id)
  await execute(`UPDATE produtos SET ${sets.join(', ')} WHERE produto_id = $${i}`, params)
  return (await queryOne<Produto>('SELECT * FROM produtos WHERE produto_id = $1', [produto_id]))!
}

export async function porCodigo(codigo: string): Promise<Produto | null> {
  return queryOne<Produto>(
    'SELECT * FROM produtos WHERE codigo = $1 AND ativo = true',
    [codigo]
  )
}

export async function deletarProduto(produto_id: number): Promise<void> {
  await execute(
    'UPDATE produtos SET ativo = false, atualizado_em = NOW() WHERE produto_id = $1',
    [produto_id]
  )
}
