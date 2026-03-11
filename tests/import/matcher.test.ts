import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getDb, closeDb } from '../../src/main/db/database'
import { applyMigrations } from '../../src/main/db/schema'
import { criarProduto } from '../../src/main/servicos/produtos'
import { execute } from '../../src/main/db/query'
import { matchProduto, matchAll } from '../../src/main/import/matcher'
import type { PlanilhaRow } from '../../shared/types'

const makeRow = (overrides: Partial<PlanilhaRow> = {}): PlanilhaRow => ({
  codigo: '999',
  descricao: 'TESTE',
  preco_oferta: 10.0,
  tipo_oferta: 'MERCEARIA',
  preco_clube: 9.5,
  unidade_extraida: 'UN',
  ...overrides
})

describe('matcher', () => {
  beforeAll(async () => {
    await getDb()
    await applyMigrations()

    // Create test products
    await criarProduto({ codigo: 'M100', nome: 'ARROZ 5KG', unidade: 'UN', categoria: 'mercearia' })
    await criarProduto({ codigo: 'M200', nome: 'FEIJÃO 1KG', unidade: 'UN' })

    // Add image to M100 (with default)
    await execute(
      `INSERT INTO produto_imagens (produto_id, arquivo_path, is_default)
       VALUES ((SELECT produto_id FROM produtos WHERE codigo = 'M100'), 'images/products/M100/foto.png', true)`
    )

    // Add image to M200 (without default)
    await execute(
      `INSERT INTO produto_imagens (produto_id, arquivo_path, is_default)
       VALUES ((SELECT produto_id FROM produtos WHERE codigo = 'M200'), 'images/products/M200/foto.png', false)`
    )
  })

  afterAll(async () => { await closeDb() })

  it('should match product with default image', async () => {
    const result = await matchProduto(makeRow({ codigo: 'M100' }))
    expect(result.status).toBe('match')
    expect(result.produto?.nome).toBe('ARROZ 5KG')
    expect(result.imagem?.is_default).toBe(true)
    expect(result.motivo).toBeNull()
  })

  it('should return fallback for product with no default image', async () => {
    const result = await matchProduto(makeRow({ codigo: 'M200' }))
    expect(result.status).toBe('fallback')
    expect(result.motivo).toContain('genérica')
  })

  it('should return nao_encontrado for unknown product', async () => {
    const result = await matchProduto(makeRow({ codigo: 'UNKNOWN' }))
    expect(result.status).toBe('nao_encontrado')
    expect(result.produto).toBeNull()
    expect(result.motivo).toContain('não cadastrado')
  })

  it('should match batch of rows', async () => {
    const rows = [
      makeRow({ codigo: 'M100' }),
      makeRow({ codigo: 'UNKNOWN' }),
      makeRow({ codigo: 'M200' })
    ]
    const results = await matchAll(rows)
    expect(results.length).toBe(3)
    expect(results[0].status).toBe('match')
    expect(results[1].status).toBe('nao_encontrado')
    expect(results[2].status).toBe('fallback')
  })
})
