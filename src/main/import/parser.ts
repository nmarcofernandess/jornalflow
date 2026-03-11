import type { PlanilhaRow } from '../../shared/types'
import { UNIDADE_PATTERNS } from '../../shared/constants'

interface ParseResult {
  rows: PlanilhaRow[]
  errors: { line: number; reason: string }[]
}

function detectDelimiter(text: string): string {
  const firstLine = text.split('\n')[0]
  if (firstLine.includes('\t')) return '\t'
  if (firstLine.includes(';')) return ';'
  return ','
}

function parseBrDecimal(value: string): number {
  if (!value || !value.trim()) return 0
  // Brazilian format: "2,49" → 2.49
  return parseFloat(value.trim().replace(',', '.'))
}

function extractUnit(descricao: string): string {
  for (const pattern of UNIDADE_PATTERNS) {
    if (pattern.regex.test(descricao)) {
      return pattern.unidade
    }
  }
  return 'UN' // default
}

export function parsePlanilha(text: string): ParseResult {
  const rows: PlanilhaRow[] = []
  const errors: { line: number; reason: string }[] = []

  const delimiter = detectDelimiter(text)
  const lines = text.split('\n')

  // Skip header (first line)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    const cols = line.split(delimiter)

    // Skip empty rows (all columns empty/whitespace)
    const codigo = cols[0]?.trim() || ''
    if (!codigo) {
      // Check if any column has content
      const hasContent = cols.some((c) => c?.trim())
      if (hasContent) {
        errors.push({ line: i + 1, reason: 'Código do produto ausente' })
      }
      continue
    }

    const descricao = cols[1]?.trim() || ''
    const preco_oferta = parseBrDecimal(cols[2] || '')
    const tipo_oferta = cols[3]?.trim() || null
    const preco_clube_raw = cols[4]?.trim() || ''
    const preco_clube = preco_clube_raw ? parseBrDecimal(preco_clube_raw) : preco_oferta

    if (preco_oferta <= 0) {
      errors.push({ line: i + 1, reason: `Preço inválido: ${cols[2]}` })
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

  return { rows, errors }
}
