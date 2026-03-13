import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getDb, closeDb } from '../../src/main/db/database'
import { applyMigrations } from '../../src/main/db/schema'
import { seed } from '../../src/main/db/seed'
import { criarProduto } from '../../src/main/servicos/produtos'
import { iaTools } from '../../src/main/ia/tools'

const mockOptions = { toolCallId: 'test', messages: [], abortSignal: undefined as any }

describe('IA tools', () => {
  beforeAll(async () => {
    await getDb()
    await applyMigrations()
    await seed()
    // Create test products
    await criarProduto({ codigo: 'IA001', nome: 'CHOCOLATE NESTLE 90G', unidade: 'UN', categoria: 'mercearia' })
    await criarProduto({ codigo: 'IA002', nome: 'LEITE INTEGRAL 1L', unidade: 'UN', categoria: 'laticinios' })
  })
  afterAll(async () => { await closeDb() })

  it('buscar_produtos should find products by name', async () => {
    const result = await iaTools.buscar_produtos.execute({ termo: 'chocolate' }, mockOptions)
    expect(result.status).toBe('ok')
    expect(result.data.total).toBeGreaterThanOrEqual(1)
    expect(result.data.produtos.length).toBeGreaterThanOrEqual(1)
    expect(result.data.produtos[0].nome).toContain('CHOCOLATE')
  })

  it('buscar_produtos should find products by codigo', async () => {
    const result = await iaTools.buscar_produtos.execute({ termo: 'IA002' }, mockOptions)
    expect(result.status).toBe('ok')
    expect(result.data.produtos[0].nome).toBe('LEITE INTEGRAL 1L')
  })

  it('buscar_produtos should return vazio for unknown term', async () => {
    const result = await iaTools.buscar_produtos.execute({ termo: 'xyznoexiste' }, mockOptions)
    expect(result.status).toBe('vazio')
    expect(result.summary).toContain('xyznoexiste')
  })

  it('cadastrar_produto should create new product', async () => {
    const result = await iaTools.cadastrar_produto.execute(
      { codigo: 'IA003', nome: 'CAFÉ PILÃO 500G', unidade: 'UN' },
      mockOptions
    )
    expect(result.status).toBe('ok')
    expect(result.data.produto.codigo).toBe('IA003')
    expect(result.data.produto.nome).toBe('CAFÉ PILÃO 500G')
  })

  it('cadastrar_produto should reject duplicate codigo', async () => {
    const result = await iaTools.cadastrar_produto.execute(
      { codigo: 'IA001', nome: 'Duplicado', unidade: 'UN' },
      mockOptions
    )
    expect(result.status).toBe('erro')
    expect(result.summary).toBeDefined()
  })

  it('ver_produto should return product details', async () => {
    const search = await iaTools.buscar_produtos.execute({ termo: 'IA001' }, mockOptions)
    const result = await iaTools.ver_produto.execute(
      { produto_id: search.data.produtos[0].produto_id },
      mockOptions
    )
    expect(result.status).toBe('ok')
    expect(result.data.nome).toBe('CHOCOLATE NESTLE 90G')
    expect(result.data.imagens).toBeDefined()
    expect(result.data.total_imagens).toBe(0)
  })

  it('ver_produto should return erro for nonexistent product', async () => {
    const result = await iaTools.ver_produto.execute(
      { produto_id: 99999 },
      mockOptions
    )
    expect(result.status).toBe('erro')
    expect(result.summary).toContain('não encontrado')
  })

  it('atualizar_produto should update product fields', async () => {
    const search = await iaTools.buscar_produtos.execute({ termo: 'IA002' }, mockOptions)
    const produtoId = search.data.produtos[0].produto_id
    const result = await iaTools.atualizar_produto.execute(
      { produto_id: produtoId, nome: 'LEITE INTEGRAL PARMALAT 1L' },
      mockOptions
    )
    expect(result.status).toBe('ok')
    expect(result.data.produto.nome).toBe('LEITE INTEGRAL PARMALAT 1L')
  })

  it('listar_imagens should return vazio for product with no images', async () => {
    const search = await iaTools.buscar_produtos.execute({ termo: 'IA001' }, mockOptions)
    const result = await iaTools.listar_imagens.execute(
      { produto_id: search.data.produtos[0].produto_id },
      mockOptions
    )
    expect(result.status).toBe('vazio')
  })

  it('buscar_jornal_atual should return vazio when no drafts', async () => {
    const result = await iaTools.buscar_jornal_atual.execute({}, mockOptions)
    expect(result.status).toBe('vazio')
    expect(result.summary).toBeDefined()
  })

  it('status_importacao should return vazio when no imports', async () => {
    const result = await iaTools.status_importacao.execute({}, mockOptions)
    expect(result.status).toBe('vazio')
    expect(result.summary).toBeDefined()
  })
})
