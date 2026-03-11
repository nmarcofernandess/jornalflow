import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getDb, closeDb } from '../../src/main/db/database'
import { applyMigrations } from '../../src/main/db/schema'
import { criarProduto } from '../../src/main/servicos/produtos'
import { listarImagens, adicionarImagem, definirDefault, removerImagem } from '../../src/main/servicos/imagens'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

describe('imagens', () => {
  let testDir: string
  let produtoId: number

  beforeAll(async () => {
    await getDb()
    await applyMigrations()

    // Create a test product
    const p = await criarProduto({ codigo: 'IMG001', nome: 'Produto Teste Imagem', unidade: 'UN' })
    produtoId = p.produto_id

    // Create temp dir with fake image files
    testDir = path.join(os.tmpdir(), 'jf-test-images')
    await fs.mkdir(testDir, { recursive: true })
    await fs.writeFile(path.join(testDir, 'foto1.png'), 'fake-image-1')
    await fs.writeFile(path.join(testDir, 'foto2.png'), 'fake-image-2')
  })

  afterAll(async () => {
    await closeDb()
    await fs.rm(testDir, { recursive: true, force: true })
    // Clean up data dir created during tests
    try {
      await fs.rm(path.join(process.cwd(), 'data', 'images', 'products', 'IMG001'), { recursive: true, force: true })
    } catch { /* ignore */ }
  })

  it('should add first image as default', async () => {
    const img = await adicionarImagem(produtoId, path.join(testDir, 'foto1.png'))
    expect(img.is_default).toBe(true)
    expect(img.produto_id).toBe(produtoId)
    expect(img.arquivo_path).toContain('IMG001')
  })

  it('should add second image as non-default', async () => {
    const img = await adicionarImagem(produtoId, path.join(testDir, 'foto2.png'), 'variacao-a')
    expect(img.is_default).toBe(false)
    expect(img.variacao).toBe('variacao-a')
  })

  it('should list images for product', async () => {
    const imgs = await listarImagens(produtoId)
    expect(imgs.length).toBe(2)
    expect(imgs[0].is_default).toBe(true) // default first due to ORDER BY
  })

  it('should change default image', async () => {
    const imgs = await listarImagens(produtoId)
    const nonDefault = imgs.find(i => !i.is_default)!
    await definirDefault(nonDefault.imagem_id)

    const updated = await listarImagens(produtoId)
    const newDefault = updated.find(i => i.is_default)!
    expect(newDefault.imagem_id).toBe(nonDefault.imagem_id)
  })

  it('should remove image', async () => {
    const imgs = await listarImagens(produtoId)
    await removerImagem(imgs[1].imagem_id)
    const remaining = await listarImagens(produtoId)
    expect(remaining.length).toBe(1)
  })
})
