import fs from 'fs/promises'
import path from 'path'
import { porCodigo } from '../servicos/produtos'
import { adicionarImagem, adicionarImagemPlayground } from '../servicos/imagens'

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])

export interface BatchImageResult {
  total_files: number
  matched: number
  playground: number
  errors: number
  details: Array<{
    filename: string
    codigo: string | null
    status: 'matched' | 'playground' | 'error'
    message?: string
  }>
}

// Extract product code from filename
// Patterns: "12345.jpg", "12345_v1.jpg", "12345-frente.png", "COD12345.jpg"
function extractCode(filename: string): string | null {
  const name = path.parse(filename).name
  const numericMatch = name.match(/^(\d{3,})/)
  if (numericMatch) return numericMatch[1]
  const codMatch = name.match(/^COD[_-]?(\d+)/i)
  if (codMatch) return codMatch[1]
  return null
}

async function scanDir(dirPath: string): Promise<string[]> {
  const files: string[] = []
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      const subFiles = await scanDir(fullPath)
      files.push(...subFiles)
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase()
      if (IMAGE_EXTENSIONS.has(ext)) {
        files.push(fullPath)
      }
    }
  }
  return files
}

export async function importarImagensBatch(dirPath: string): Promise<BatchImageResult> {
  const files = await scanDir(dirPath)
  const result: BatchImageResult = {
    total_files: files.length,
    matched: 0,
    playground: 0,
    errors: 0,
    details: []
  }

  for (const filePath of files) {
    const filename = path.basename(filePath)
    const codigo = extractCode(filename)

    if (!codigo) {
      // No code found — send to playground
      try {
        await adicionarImagemPlayground(filePath)
        result.playground++
        result.details.push({ filename, codigo: null, status: 'playground', message: 'Enviada pro Playground — sem codigo no nome' })
      } catch (err) {
        result.errors++
        result.details.push({ filename, codigo: null, status: 'error', message: String(err) })
      }
      continue
    }

    try {
      const produto = await porCodigo(codigo)
      if (!produto) {
        // Code not found in DB — send to playground
        try {
          await adicionarImagemPlayground(filePath)
          result.playground++
          result.details.push({ filename, codigo, status: 'playground', message: `Codigo ${codigo} nao encontrado — enviada pro Playground` })
        } catch (err) {
          result.errors++
          result.details.push({ filename, codigo, status: 'error', message: String(err) })
        }
        continue
      }

      // Determine variation from filename suffix
      const name = path.parse(filename).name
      const suffix = name.replace(/^\d+[_-]?/, '')
      const variacao = suffix || undefined

      await adicionarImagem(produto.produto_id, filePath, variacao)
      result.matched++
      result.details.push({ filename, codigo, status: 'matched' })
    } catch (err) {
      result.errors++
      result.details.push({ filename, codigo, status: 'error', message: String(err) })
    }
  }

  return result
}
