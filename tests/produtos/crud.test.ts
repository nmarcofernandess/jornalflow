import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getDb, closeDb } from '../../src/main/db/database'
import { applyMigrations } from '../../src/main/db/schema'
import {
  listarProdutos,
  buscarProdutos,
  criarProduto,
  atualizarProduto,
  porCodigo,
  deletarProduto
} from '../../src/main/servicos/produtos'

describe('produtos CRUD', () => {
  beforeAll(async () => {
    await getDb()
    await applyMigrations()
  })
  afterAll(async () => {
    await closeDb()
  })

  it('should create a product', async () => {
    const p = await criarProduto({
      codigo: '100',
      nome: 'ARROZ BRANCO 5KG',
      unidade: 'UN',
      categoria: 'mercearia'
    })
    expect(p.codigo).toBe('100')
    expect(p.nome).toBe('ARROZ BRANCO 5KG')
    expect(p.ativo).toBe(true)
  })

  it('should reject duplicate codigo', async () => {
    await expect(
      criarProduto({ codigo: '100', nome: 'Duplicado', unidade: 'UN' })
    ).rejects.toThrow('já existe')
  })

  it('should list active products', async () => {
    await criarProduto({ codigo: '200', nome: 'FEIJÃO CARIOCA 1KG', unidade: 'UN' })
    const list = await listarProdutos()
    expect(list.length).toBeGreaterThanOrEqual(2)
    expect(list.every((p) => p.ativo)).toBe(true)
  })

  it('should search by term (nome)', async () => {
    const results = await buscarProdutos('arroz')
    expect(results.length).toBe(1)
    expect(results[0].nome).toContain('ARROZ')
  })

  it('should search by exact codigo', async () => {
    const results = await buscarProdutos('200')
    expect(results.length).toBe(1)
    expect(results[0].nome).toContain('FEIJÃO')
  })

  it('should search by categoria', async () => {
    const results = await buscarProdutos('mercearia')
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0].categoria).toBe('mercearia')
  })

  it('should find by exact codigo', async () => {
    const p = await porCodigo('100')
    expect(p?.nome).toBe('ARROZ BRANCO 5KG')
  })

  it('should return null for nonexistent codigo', async () => {
    const p = await porCodigo('999')
    expect(p).toBeNull()
  })

  it('should update product', async () => {
    const p = await porCodigo('100')
    const updated = await atualizarProduto(p!.produto_id, { nome_card: 'Arroz' })
    expect(updated.nome_card).toBe('Arroz')
    expect(updated.nome).toBe('ARROZ BRANCO 5KG') // unchanged fields stay
  })

  it('should update multiple fields at once', async () => {
    const p = await porCodigo('200')
    const updated = await atualizarProduto(p!.produto_id, {
      nome: 'FEIJÃO PRETO 1KG',
      categoria: 'grãos'
    })
    expect(updated.nome).toBe('FEIJÃO PRETO 1KG')
    expect(updated.categoria).toBe('grãos')
  })

  it('should soft delete', async () => {
    const p = await porCodigo('100')
    await deletarProduto(p!.produto_id)
    const found = await porCodigo('100')
    expect(found).toBeNull() // ativo = false, so not found
  })

  it('should not list soft-deleted products', async () => {
    const list = await listarProdutos()
    expect(list.every((p) => p.codigo !== '100')).toBe(true)
  })
})
