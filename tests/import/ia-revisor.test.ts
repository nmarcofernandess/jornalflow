import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { getDb, closeDb } from '../../src/main/db/database'
import { applyMigrations } from '../../src/main/db/schema'
import { seed } from '../../src/main/db/seed'
import type { PlanilhaRow } from '../../shared/types'

// Mock the AI SDK to avoid real API calls in tests
vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({
    text: JSON.stringify({
      sugestoes: [
        {
          linha: 1,
          campo: 'descricao',
          original: 'CRVJ CRYSTAL 350',
          sugerido: 'CERVEJA CRYSTAL 350ML LATA',
          motivo: 'Abreviação expandida'
        },
        {
          linha: 2,
          campo: 'unidade_extraida',
          original: 'UN',
          sugerido: 'KG',
          motivo: 'Carne vendida por KG'
        }
      ],
      resumo: '2 correções sugeridas: 1 nome expandido, 1 unidade corrigida'
    })
  })
}))

// Mock the config to return a fake model
vi.mock('../../src/main/ia/config', () => ({
  getModel: vi.fn().mockReturnValue('fake-model'),
  getApiKey: vi.fn().mockReturnValue('fake-key'),
  getProvider: vi.fn()
}))

const SAMPLE_ROWS: PlanilhaRow[] = [
  {
    codigo: '515',
    descricao: 'CRVJ CRYSTAL 350',
    preco_oferta: 2.49,
    tipo_oferta: 'ACOUGUE',
    preco_clube: 2.39,
    unidade_extraida: 'UN'
  },
  {
    codigo: '5920',
    descricao: 'COXAO MOLE',
    preco_oferta: 45.98,
    tipo_oferta: 'ACOUGUE',
    preco_clube: 44.98,
    unidade_extraida: 'UN'
  },
  {
    codigo: '6536',
    descricao: 'LARANJA PERA KG',
    preco_oferta: 3.89,
    tipo_oferta: 'HORTIFRUTI',
    preco_clube: 3.59,
    unidade_extraida: 'KG'
  }
]

describe('ia-revisor', () => {
  beforeAll(async () => {
    await getDb()
    await applyMigrations()
    await seed()
  }, 30000)

  afterAll(async () => {
    await closeDb()
  })

  it('should return revised rows with IA suggestions applied', async () => {
    const { revisarImportacaoComIA } = await import('../../src/main/import/ia-revisor')
    const result = await revisarImportacaoComIA(SAMPLE_ROWS)

    expect(result.sugestoes.length).toBe(2)
    expect(result.resumo).toBeTruthy()
    expect(result.categorias_sugeridas).toBeDefined()

    // First row should have the description changed
    expect(result.rows_revisadas[0].descricao).toBe('CERVEJA CRYSTAL 350ML LATA')

    // Second row should have the unit changed
    expect(result.rows_revisadas[1].unidade_extraida).toBe('KG')

    // Third row should be unchanged
    expect(result.rows_revisadas[2].descricao).toBe('LARANJA PERA KG')
    expect(result.rows_revisadas[2].unidade_extraida).toBe('KG')
  })

  it('should preserve original rows when no suggestions', async () => {
    // Mock returns suggestions only for lines 1 and 2
    const { revisarImportacaoComIA } = await import('../../src/main/import/ia-revisor')
    const result = await revisarImportacaoComIA(SAMPLE_ROWS)

    // Row 3 (laranja) should be unchanged
    expect(result.rows_revisadas[2]).toEqual(SAMPLE_ROWS[2])
  })

  it('should handle all original rows even when IA has no suggestions', async () => {
    const { revisarImportacaoComIA } = await import('../../src/main/import/ia-revisor')
    const result = await revisarImportacaoComIA(SAMPLE_ROWS)

    // Should have same number of rows as input
    expect(result.rows_revisadas.length).toBe(SAMPLE_ROWS.length)
  })

  it('should return structured suggestions with line numbers', async () => {
    const { revisarImportacaoComIA } = await import('../../src/main/import/ia-revisor')
    const result = await revisarImportacaoComIA(SAMPLE_ROWS)

    for (const sug of result.sugestoes) {
      expect(sug.linha).toBeGreaterThan(0)
      expect(sug.campo).toBeTruthy()
      expect(sug.original).toBeTruthy()
      expect(sug.sugerido).toBeTruthy()
      expect(sug.motivo).toBeTruthy()
    }
  })
})
