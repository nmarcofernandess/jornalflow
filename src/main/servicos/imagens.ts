import { queryAll, queryOne, execute } from '../db/query'
import type { ProdutoImagem, Produto } from '../../shared/types'
import fs from 'fs/promises'
import path from 'path'
import { getDataDir } from '../db/database'

export async function listarImagens(produto_id: number): Promise<ProdutoImagem[]> {
  return queryAll<ProdutoImagem>(
    'SELECT * FROM produto_imagens WHERE produto_id = $1 ORDER BY is_default DESC, criado_em',
    [produto_id]
  )
}

export async function adicionarImagem(
  produto_id: number,
  source_path: string,
  variacao?: string
): Promise<ProdutoImagem> {
  // Get product codigo for directory structure
  const produto = await queryOne<Produto>('SELECT * FROM produtos WHERE produto_id = $1', [produto_id])
  if (!produto) throw new Error(`Produto ${produto_id} não encontrado`)

  // Determine target path
  const filename = path.basename(source_path)
  const dataDir = getDataDir()
  const targetDir = path.join(dataDir, 'images', 'products', produto.codigo)
  await fs.mkdir(targetDir, { recursive: true })
  const targetPath = path.join(targetDir, filename)

  // Copy file
  await fs.copyFile(source_path, targetPath)

  // Check if first image (set as default)
  const existing = await queryAll<ProdutoImagem>(
    'SELECT * FROM produto_imagens WHERE produto_id = $1', [produto_id]
  )
  const isDefault = existing.length === 0

  // Store relative path from data dir
  const relativePath = path.join('images', 'products', produto.codigo, filename)

  await execute(
    `INSERT INTO produto_imagens (produto_id, arquivo_path, variacao, is_default)
     VALUES ($1, $2, $3, $4)`,
    [produto_id, relativePath, variacao ?? null, isDefault]
  )

  return (await queryOne<ProdutoImagem>(
    'SELECT * FROM produto_imagens WHERE produto_id = $1 AND arquivo_path = $2',
    [produto_id, relativePath]
  ))!
}

export async function definirDefault(imagem_id: number): Promise<void> {
  const img = await queryOne<ProdutoImagem>('SELECT * FROM produto_imagens WHERE imagem_id = $1', [imagem_id])
  if (!img) throw new Error(`Imagem ${imagem_id} não encontrada`)

  await execute('UPDATE produto_imagens SET is_default = false WHERE produto_id = $1', [img.produto_id])
  await execute('UPDATE produto_imagens SET is_default = true WHERE imagem_id = $1', [imagem_id])
}

export async function removerImagem(imagem_id: number): Promise<void> {
  const img = await queryOne<ProdutoImagem>('SELECT * FROM produto_imagens WHERE imagem_id = $1', [imagem_id])
  if (!img) throw new Error(`Imagem ${imagem_id} não encontrada`)

  await execute('DELETE FROM produto_imagens WHERE imagem_id = $1', [imagem_id])

  // Try to remove file (don't fail if already gone)
  try {
    const fullPath = path.join(getDataDir(), img.arquivo_path)
    await fs.unlink(fullPath)
  } catch { /* file may not exist */ }
}
