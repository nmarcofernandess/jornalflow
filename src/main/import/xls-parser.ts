import * as XLSX from 'xlsx'
import fs from 'fs'
import type { PlanilhaRow } from '../../shared/types'
import { UNIDADE_PATTERNS } from '../../shared/constants'

interface XlsParseResult {
  rows: PlanilhaRow[]
  errors: { line: number; reason: string }[]
  sheet_name: string
  raw_headers: string[]
}

// Normalized header mapping — handles various naming conventions
const HEADER_MAP: Record<string, string> = {
  produto: 'codigo',
  codigo: 'codigo',
  cod: 'codigo',
  'cod.': 'codigo',
  'código': 'codigo',
  descricao: 'descricao',
  'descrição': 'descricao',
  desc: 'descricao',
  nome: 'descricao',
  'preco oferta': 'preco_oferta',
  'preço oferta': 'preco_oferta',
  'preco': 'preco_oferta',
  'preço': 'preco_oferta',
  oferta: 'preco_oferta',
  'p. oferta': 'preco_oferta',
  'tipo oferta': 'tipo_oferta',
  tipo: 'tipo_oferta',
  setor: 'tipo_oferta',
  'seção': 'tipo_oferta',
  secao: 'tipo_oferta',
  clube: 'preco_clube',
  'preço clube': 'preco_clube',
  'preco clube': 'preco_clube',
  'p. clube': 'preco_clube',
  'clube fernandes': 'preco_clube'
}

function normalizeHeader(raw: string): string | null {
  const clean = raw.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  // Try exact match first
  if (HEADER_MAP[clean]) return HEADER_MAP[clean]
  // Try partial match
  for (const [key, value] of Object.entries(HEADER_MAP)) {
    if (clean.includes(key)) return value
  }
  return null
}

function extractUnit(descricao: string): string {
  for (const pattern of UNIDADE_PATTERNS) {
    if (pattern.regex.test(descricao)) {
      return pattern.unidade
    }
  }
  return 'UN'
}

function toNumber(val: unknown): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const cleaned = val.trim().replace(',', '.')
    const num = parseFloat(cleaned)
    return isNaN(num) ? 0 : num
  }
  return 0
}

function toString(val: unknown): string {
  if (val === null || val === undefined) return ''
  return String(val).trim()
}

export function parseXlsFile(filePath: string): XlsParseResult {
  const buffer = fs.readFileSync(filePath)
  return parseXlsBuffer(buffer)
}

export function parseXlsBuffer(buffer: Buffer): XlsParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  // Convert to array of arrays (raw data)
  const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  if (rawData.length < 2) {
    return { rows: [], errors: [{ line: 1, reason: 'Planilha vazia ou sem dados' }], sheet_name: sheetName, raw_headers: [] }
  }

  // Find header row (first row with recognizable column names)
  let headerRowIdx = -1
  let colMap: Record<string, number> = {}

  for (let i = 0; i < Math.min(rawData.length, 5); i++) {
    const row = rawData[i]
    const mapped: Record<string, number> = {}
    let matchCount = 0

    for (let j = 0; j < row.length; j++) {
      const headerName = normalizeHeader(toString(row[j]))
      if (headerName && !mapped[headerName]) {
        mapped[headerName] = j
        matchCount++
      }
    }

    // Need at least codigo + descricao + preco_oferta
    if (matchCount >= 3 && mapped.codigo !== undefined && mapped.descricao !== undefined && mapped.preco_oferta !== undefined) {
      headerRowIdx = i
      colMap = mapped
      break
    }
  }

  if (headerRowIdx === -1) {
    return {
      rows: [],
      errors: [{ line: 1, reason: 'Cabeçalho não encontrado. Esperado: Produto, Descrição, Preço Oferta' }],
      sheet_name: sheetName,
      raw_headers: rawData[0]?.map(v => toString(v)) || []
    }
  }

  const rawHeaders = rawData[headerRowIdx].map(v => toString(v))
  const rows: PlanilhaRow[] = []
  const errors: { line: number; reason: string }[] = []

  for (let i = headerRowIdx + 1; i < rawData.length; i++) {
    const row = rawData[i]
    const excelLine = i + 1

    const codigo = toString(row[colMap.codigo])
    if (!codigo) continue // skip empty rows

    const descricao = toString(row[colMap.descricao])
    const preco_oferta = toNumber(row[colMap.preco_oferta])
    const tipo_oferta = colMap.tipo_oferta !== undefined ? toString(row[colMap.tipo_oferta]) || null : null
    const preco_clube_raw = colMap.preco_clube !== undefined ? row[colMap.preco_clube] : undefined
    const preco_clube = preco_clube_raw !== undefined && preco_clube_raw !== '' ? toNumber(preco_clube_raw) : preco_oferta

    if (preco_oferta <= 0) {
      errors.push({ line: excelLine, reason: `Preço inválido: ${row[colMap.preco_oferta]}` })
      continue
    }

    if (!descricao) {
      errors.push({ line: excelLine, reason: 'Descrição ausente' })
      continue
    }

    rows.push({
      codigo,
      descricao,
      preco_oferta,
      tipo_oferta,
      preco_clube,
      unidade_extraida: extractUnit(descricao)
    })
  }

  return { rows, errors, sheet_name: sheetName, raw_headers: rawHeaders }
}
