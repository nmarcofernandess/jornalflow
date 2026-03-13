import path from 'path'
import fs from 'fs'
import type { PlanilhaRow } from '../../shared/types'
import { parsePlanilha } from './parser'
import { parseXlsFile } from './xls-parser'

export interface UploadParseResult {
  rows: PlanilhaRow[]
  errors: { line: number; reason: string }[]
  formato: 'tsv' | 'csv' | 'xls' | 'xlsx'
  arquivo_nome: string
  sheet_name?: string
  raw_headers?: string[]
}

const TEXT_EXTENSIONS = new Set(['.tsv', '.csv', '.txt'])
const XLS_EXTENSIONS = new Set(['.xls', '.xlsx', '.xlsm'])

export function parseUploadedFile(filePath: string): UploadParseResult {
  const ext = path.extname(filePath).toLowerCase()
  const arquivo_nome = path.basename(filePath)

  if (XLS_EXTENSIONS.has(ext)) {
    const result = parseXlsFile(filePath)
    return {
      rows: result.rows,
      errors: result.errors,
      formato: ext === '.xls' ? 'xls' : 'xlsx',
      arquivo_nome,
      sheet_name: result.sheet_name,
      raw_headers: result.raw_headers
    }
  }

  if (TEXT_EXTENSIONS.has(ext) || ext === '') {
    const text = fs.readFileSync(filePath, 'utf-8')
    const result = parsePlanilha(text)
    const formato = ext === '.tsv' || text.includes('\t') ? 'tsv' : 'csv'
    return {
      rows: result.rows,
      errors: result.errors,
      formato,
      arquivo_nome
    }
  }

  return {
    rows: [],
    errors: [{ line: 0, reason: `Formato não suportado: ${ext}. Use TSV, CSV, XLS ou XLSX.` }],
    formato: 'csv',
    arquivo_nome
  }
}
