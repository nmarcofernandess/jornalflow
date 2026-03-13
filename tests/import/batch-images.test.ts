import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, getDataDir } from '../../src/main/db/database'
import { applyMigrations } from '../../src/main/db/schema'
import { seed } from '../../src/main/db/seed'
import { criarProduto } from '../../src/main/servicos/produtos'
import { importarImagensBatch } from '../../src/main/import/batch-images'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

describe('batch-images', () => {
  let tmpDir: string

  beforeEach(async () => {
    await getDb()
    await applyMigrations()
    await seed()

    // Ensure playground dir exists for tests
    await fs.mkdir(path.join(getDataDir(), 'images', 'playground'), { recursive: true })

    // Create temp directory with test images
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jf-batch-'))
  })

  it('matches files to products by code', async () => {
    // Create a product
    await criarProduto({ codigo: '12345', nome: 'Arroz 5kg', unidade: 'UN' })

    // Create a fake image file
    const imgPath = path.join(tmpDir, '12345.jpg')
    await fs.writeFile(imgPath, 'fake-image-data')

    const result = await importarImagensBatch(tmpDir)

    expect(result.total_files).toBe(1)
    expect(result.matched).toBe(1)
    expect(result.playground).toBe(0)
    expect(result.details[0].status).toBe('matched')
  })

  it('sends unmatched files to playground', async () => {
    // No products exist for this code — goes to playground
    const imgPath = path.join(tmpDir, '99999.png')
    await fs.writeFile(imgPath, 'fake-image-data')

    const result = await importarImagensBatch(tmpDir)

    expect(result.total_files).toBe(1)
    expect(result.matched).toBe(0)
    expect(result.playground).toBe(1)
    expect(result.details[0].status).toBe('playground')
  })

  it('scans subdirectories recursively', async () => {
    await criarProduto({ codigo: '11111', nome: 'Feijao', unidade: 'KG' })

    const subDir = path.join(tmpDir, 'subpasta')
    await fs.mkdir(subDir)
    await fs.writeFile(path.join(subDir, '11111.jpg'), 'fake')

    const result = await importarImagensBatch(tmpDir)

    expect(result.total_files).toBe(1)
    expect(result.matched).toBe(1)
  })

  it('ignores non-image files', async () => {
    await fs.writeFile(path.join(tmpDir, 'readme.txt'), 'not an image')
    await fs.writeFile(path.join(tmpDir, 'data.csv'), 'csv data')

    const result = await importarImagensBatch(tmpDir)

    expect(result.total_files).toBe(0)
  })
})
