/**
 * Batch image import tests using REAL images from ~/Pictures.
 *
 * This test copies actual image files (PNG, JPG, JPEG, WEBP) to validate
 * the full pipeline: scan → extract code → match → copy → register.
 *
 * Unlike the existing batch-images.test.ts which uses 'fake-image-data',
 * these tests verify real file operations with real binary data.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { getDb, closeDb } from '../../src/main/db/database'
import { applyMigrations } from '../../src/main/db/schema'
import { seed } from '../../src/main/db/seed'
import { criarProduto } from '../../src/main/servicos/produtos'
import { listarImagens } from '../../src/main/servicos/imagens'
import { importarImagensBatch } from '../../src/main/import/batch-images'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

const PICTURES_DIR = path.join(os.homedir(), 'Pictures')

// 20 real images from ~/Pictures — mixed formats (PNG, JPG, JPEG, WEBP)
const SOURCE_IMAGES = [
  'IMG_1291.jpg',
  'IMG_08052245-3A09-477F-B229-859179F43687.jpeg',
  'GRcStkXXIAA4ml5.jpg',
  'EwmVInpWYAUx9qZ.jpg',
  'a0kf0bqolewb1.jpg',
  'Gemini_Generated_Image_9g6ldj9g6ldj9g6l.png',
  'Marco - 242 de 540.png',
  'Captura de Tela 2025-11-27 às 08.53.02.png',
  'sofialutt-arwen-feet-v0-kzs01iqq6n791.jpg.webp',
  'ChatGPT Image 22 de fev. de 2026, 12_29_29.png',
  'ChatGPT Image 22 de fev. de 2026, 12_29_31.png',
  'ChatGPT Image 22 de fev. de 2026, 12_29_34.png',
  'ChatGPT Image 22 de fev. de 2026, 12_29_42.png',
  'ChatGPT Image 22 de fev. de 2026, 12_30_04.png',
  'ChatGPT Image 22 de fev. de 2026, 12_30_14.png',
  'ChatGPT Image 22 de fev. de 2026, 12_30_20.png',
  'ChatGPT Image 22 de fev. de 2026, 12_30_23.png',
  'ChatGPT Image 22 de fev. de 2026, 12_30_29.png',
  'ChatGPT Image 22 de fev. de 2026, 12_30_30.png',
  'ChatGPT Image 3 de mar. de 2026, 00_34_28.png'
]

// Product codes to assign — first 12 get codes, last 8 keep original names (unmatched)
const PRODUCT_CODES = ['3001', '3002', '3003', '3004', '3005', '3006', '3007', '3008', '3009', '3010', '3011', '3012']

async function imagesExist(): Promise<boolean> {
  try {
    await fs.access(path.join(PICTURES_DIR, SOURCE_IMAGES[0]))
    return true
  } catch {
    return false
  }
}

describe('batch-images with real files', () => {
  let tmpDir: string
  let hasImages: boolean

  beforeAll(async () => {
    hasImages = await imagesExist()
    if (!hasImages) return

    await getDb()
    await applyMigrations()
    await seed()
  }, 30000)

  afterAll(async () => {
    if (hasImages) {
      await closeDb()
    }
  })

  beforeEach(async () => {
    if (!hasImages) return
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jf-real-batch-'))
  })

  it('should match renamed images to products by code prefix', async () => {
    if (!hasImages) return

    // Create products and copy images renamed with codes
    for (let i = 0; i < PRODUCT_CODES.length; i++) {
      const code = PRODUCT_CODES[i]
      await criarProduto({ codigo: code, nome: `Produto Real ${code}`, unidade: 'UN' })

      const srcFile = SOURCE_IMAGES[i]
      const ext = path.extname(srcFile)
      const destName = `${code}${ext}`
      await fs.copyFile(
        path.join(PICTURES_DIR, srcFile),
        path.join(tmpDir, destName)
      )
    }

    const result = await importarImagensBatch(tmpDir)

    expect(result.total_files).toBe(12)
    expect(result.matched).toBe(12)
    expect(result.playground).toBe(0)
    expect(result.errors).toBe(0)
  })

  it('should report unmatched for images with non-numeric names', async () => {
    if (!hasImages) return

    // Copy 5 images WITHOUT renaming — original crazy names
    const unmatchedFiles = SOURCE_IMAGES.slice(12, 17)
    for (const file of unmatchedFiles) {
      await fs.copyFile(
        path.join(PICTURES_DIR, file),
        path.join(tmpDir, file)
      )
    }

    const result = await importarImagensBatch(tmpDir)

    expect(result.total_files).toBe(5)
    expect(result.playground).toBe(5)
    expect(result.matched).toBe(0)
    // Each detail should explain why
    for (const d of result.details) {
      expect(d.status).toBe('playground')
    }
  })

  it('should handle mix of matched and unmatched in same batch', async () => {
    if (!hasImages) return

    // 3 renamed (matched) + 3 original names (unmatched)
    const codes = ['4001', '4002', '4003']
    for (let i = 0; i < 3; i++) {
      await criarProduto({ codigo: codes[i], nome: `Mix Produto ${codes[i]}`, unidade: 'KG' })
      const ext = path.extname(SOURCE_IMAGES[i])
      await fs.copyFile(
        path.join(PICTURES_DIR, SOURCE_IMAGES[i]),
        path.join(tmpDir, `${codes[i]}${ext}`)
      )
    }
    // 3 with original names
    for (let i = 15; i < 18; i++) {
      await fs.copyFile(
        path.join(PICTURES_DIR, SOURCE_IMAGES[i]),
        path.join(tmpDir, SOURCE_IMAGES[i])
      )
    }

    const result = await importarImagensBatch(tmpDir)

    expect(result.total_files).toBe(6)
    expect(result.matched).toBe(3)
    expect(result.playground).toBe(3)
  })

  it('should preserve file size after import (real binary copy)', async () => {
    if (!hasImages) return

    const code = '5001'
    await criarProduto({ codigo: code, nome: 'File Integrity Test', unidade: 'UN' })

    const srcPath = path.join(PICTURES_DIR, SOURCE_IMAGES[0]) // IMG_1291.jpg
    const srcStat = await fs.stat(srcPath)
    await fs.copyFile(srcPath, path.join(tmpDir, `${code}.jpg`))

    await importarImagensBatch(tmpDir)

    // Find where the file was copied to
    const imgs = await listarImagens(
      (await (await import('../../src/main/servicos/produtos')).porCodigo(code))!.produto_id
    )
    expect(imgs.length).toBe(1)

    const { getDataDir } = await import('../../src/main/db/database')
    const copiedPath = path.join(getDataDir(), imgs[0].arquivo_path)
    const copiedStat = await fs.stat(copiedPath)

    expect(copiedStat.size).toBe(srcStat.size)
  })

  it('should handle variation suffix in filename', async () => {
    if (!hasImages) return

    const code = '5002'
    await criarProduto({ codigo: code, nome: 'Variation Test', unidade: 'UN' })

    // Copy with code-variation format: "5002-frente.jpg"
    const srcPath = path.join(PICTURES_DIR, SOURCE_IMAGES[1]) // jpeg file
    await fs.copyFile(srcPath, path.join(tmpDir, `${code}-frente.jpeg`))

    const result = await importarImagensBatch(tmpDir)

    expect(result.matched).toBe(1)
    expect(result.details[0].status).toBe('matched')
  })

  it('should scan subdirectories recursively with real files', async () => {
    if (!hasImages) return

    const code = '5003'
    await criarProduto({ codigo: code, nome: 'Recursive Test', unidade: 'UN' })

    // Put image in a subdirectory
    const subDir = path.join(tmpDir, 'subfolder', 'deep')
    await fs.mkdir(subDir, { recursive: true })
    await fs.copyFile(
      path.join(PICTURES_DIR, SOURCE_IMAGES[2]),
      path.join(subDir, `${code}.jpg`)
    )

    const result = await importarImagensBatch(tmpDir)

    expect(result.total_files).toBe(1)
    expect(result.matched).toBe(1)
  })

  it('should handle all supported formats (png, jpg, jpeg, webp)', async () => {
    if (!hasImages) return

    // Grab one of each format
    const formats: Array<{ code: string; src: string; ext: string }> = [
      { code: '6001', src: 'Gemini_Generated_Image_9g6ldj9g6ldj9g6l.png', ext: '.png' },
      { code: '6002', src: 'IMG_1291.jpg', ext: '.jpg' },
      { code: '6003', src: 'IMG_08052245-3A09-477F-B229-859179F43687.jpeg', ext: '.jpeg' },
      { code: '6004', src: 'sofialutt-arwen-feet-v0-kzs01iqq6n791.jpg.webp', ext: '.webp' }
    ]

    for (const f of formats) {
      await criarProduto({ codigo: f.code, nome: `Format ${f.ext}`, unidade: 'UN' })
      await fs.copyFile(
        path.join(PICTURES_DIR, f.src),
        path.join(tmpDir, `${f.code}${f.ext}`)
      )
    }

    const result = await importarImagensBatch(tmpDir)

    expect(result.total_files).toBe(4)
    expect(result.matched).toBe(4)
    expect(result.errors).toBe(0)
  })

  it('should ignore non-image files even mixed with real images', async () => {
    if (!hasImages) return

    const code = '7001'
    await criarProduto({ codigo: code, nome: 'Mixed Files', unidade: 'UN' })

    // Copy a real image
    await fs.copyFile(
      path.join(PICTURES_DIR, SOURCE_IMAGES[0]),
      path.join(tmpDir, `${code}.jpg`)
    )
    // Add non-image files
    await fs.writeFile(path.join(tmpDir, 'readme.txt'), 'not an image')
    await fs.writeFile(path.join(tmpDir, 'data.csv'), 'col1,col2\n1,2')
    await fs.writeFile(path.join(tmpDir, 'config.json'), '{}')

    const result = await importarImagensBatch(tmpDir)

    expect(result.total_files).toBe(1) // only the jpg
    expect(result.matched).toBe(1)
  })
}, 60000)
