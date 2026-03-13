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
  const produto = await queryOne<Produto>('SELECT * FROM produtos WHERE produto_id = $1', [produto_id])
  if (!produto) throw new Error(`Produto ${produto_id} não encontrado`)

  const filename = path.basename(source_path)
  const dataDir = getDataDir()
  const targetDir = path.join(dataDir, 'images', 'products', produto.codigo)
  await fs.mkdir(targetDir, { recursive: true })
  const targetPath = path.join(targetDir, filename)

  await fs.copyFile(source_path, targetPath)

  const existing = await queryAll<ProdutoImagem>(
    'SELECT * FROM produto_imagens WHERE produto_id = $1', [produto_id]
  )
  const isDefault = existing.length === 0

  const relativePath = path.join('images', 'products', produto.codigo, filename)

  await execute(
    `INSERT INTO produto_imagens (produto_id, arquivo_path, nome_original, variacao, is_default)
     VALUES ($1, $2, $3, $4, $5)`,
    [produto_id, relativePath, filename, variacao ?? null, isDefault]
  )

  return (await queryOne<ProdutoImagem>(
    'SELECT * FROM produto_imagens WHERE produto_id = $1 AND arquivo_path = $2',
    [produto_id, relativePath]
  ))!
}

// Save image reference to playground (no copy — just stores the original path)
export async function adicionarImagemPlayground(
  source_path: string
): Promise<ProdutoImagem> {
  const filename = path.basename(source_path)
  // Store absolute source path — no file copy for playground
  await execute(
    `INSERT INTO produto_imagens (produto_id, arquivo_path, nome_original, is_default)
     VALUES (NULL, $1, $2, false)`,
    [source_path, filename]
  )

  return (await queryOne<ProdutoImagem>(
    `SELECT * FROM produto_imagens WHERE arquivo_path = $1`,
    [source_path]
  ))!
}

// List unassigned images (playground)
export async function listarOrfas(): Promise<ProdutoImagem[]> {
  return queryAll<ProdutoImagem>(
    'SELECT * FROM produto_imagens WHERE produto_id IS NULL ORDER BY criado_em DESC'
  )
}

// Assign an orphan image to a product — copies from original source to products/
export async function atribuirAProduto(imagem_id: number, produto_id: number): Promise<ProdutoImagem> {
  const img = await queryOne<ProdutoImagem>('SELECT * FROM produto_imagens WHERE imagem_id = $1', [imagem_id])
  if (!img) throw new Error(`Imagem ${imagem_id} não encontrada`)

  const produto = await queryOne<Produto>('SELECT * FROM produtos WHERE produto_id = $1', [produto_id])
  if (!produto) throw new Error(`Produto ${produto_id} não encontrado`)

  const dataDir = getDataDir()
  const targetDir = path.join(dataDir, 'images', 'products', produto.codigo)
  await fs.mkdir(targetDir, { recursive: true })

  const filename = path.basename(img.arquivo_path)
  const newRelativePath = path.join('images', 'products', produto.codigo, filename)
  const newFullPath = path.join(dataDir, newRelativePath)

  // Copy from source (arquivo_path is absolute for playground images)
  const sourcePath = path.isAbsolute(img.arquivo_path)
    ? img.arquivo_path
    : path.join(dataDir, img.arquivo_path)
  await fs.copyFile(sourcePath, newFullPath)

  // Check if first image for this product
  const existing = await queryAll<ProdutoImagem>(
    'SELECT * FROM produto_imagens WHERE produto_id = $1', [produto_id]
  )
  const isDefault = existing.length === 0

  await execute(
    `UPDATE produto_imagens SET produto_id = $1, arquivo_path = $2, is_default = $3 WHERE imagem_id = $4`,
    [produto_id, newRelativePath, isDefault, imagem_id]
  )

  return (await queryOne<ProdutoImagem>(
    'SELECT * FROM produto_imagens WHERE imagem_id = $1', [imagem_id]
  ))!
}

// List all images with product info (for galeria organizadas tab)
export async function listarTodasImagens(): Promise<(ProdutoImagem & { produto_nome?: string; produto_codigo?: string })[]> {
  return queryAll(
    `SELECT pi.*, p.nome as produto_nome, p.codigo as produto_codigo
     FROM produto_imagens pi
     LEFT JOIN produtos p ON pi.produto_id = p.produto_id
     WHERE pi.produto_id IS NOT NULL
     ORDER BY p.nome, pi.is_default DESC, pi.criado_em`
  )
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

  try {
    const fullPath = path.join(getDataDir(), img.arquivo_path)
    await fs.unlink(fullPath)
  } catch { /* file may not exist */ }
}
