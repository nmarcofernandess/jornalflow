import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getDb, closeDb } from '../../src/main/db/database'
import { applyMigrations } from '../../src/main/db/schema'
import { seed } from '../../src/main/db/seed'
import { execute, queryOne } from '../../src/main/db/query'
import { criarProduto } from '../../src/main/servicos/produtos'
import { iaTools } from '../../src/main/ia/tools'

const mockOptions = { toolCallId: 'test', messages: [], abortSignal: undefined as any }

describe('IA tools — extended (7 new tools)', () => {
  let produtoA_id: number
  let produtoB_id: number
  let jornal_id: number
  let pagina_id: number
  let secao_id: number
  let item_id: number

  beforeAll(async () => {
    await getDb()
    await applyMigrations()
    await seed()

    // Create test products
    const prodA = await criarProduto({
      codigo: 'EXT001',
      nome: 'ARROZ CAMIL 5KG',
      unidade: 'UN',
      categoria: 'mercearia'
    })
    produtoA_id = prodA.produto_id

    const prodB = await criarProduto({
      codigo: 'EXT002',
      nome: 'FEIJAO CARIOCA 1KG',
      unidade: 'UN',
      categoria: 'mercearia'
    })
    produtoB_id = prodB.produto_id

    // Create a journal with pages, sections, and items
    await execute(
      `INSERT INTO jornais (titulo, tipo, data_inicio, data_fim, status)
       VALUES ('Jornal Teste Ext', 'semanal', '2026-03-01', '2026-03-07', 'rascunho')`
    )
    const jornal = await queryOne<any>(
      "SELECT * FROM jornais WHERE titulo = 'Jornal Teste Ext'"
    )
    jornal_id = jornal!.jornal_id

    await execute(
      'INSERT INTO jornal_paginas (jornal_id, numero) VALUES ($1, 1)',
      [jornal_id]
    )
    const pagina = await queryOne<any>(
      'SELECT * FROM jornal_paginas WHERE jornal_id = $1 AND numero = 1',
      [jornal_id]
    )
    pagina_id = pagina!.pagina_id

    await execute(
      `INSERT INTO jornal_secoes (jornal_id, pagina_id, posicao, grid_cols, grid_rows, nome_custom)
       VALUES ($1, $2, 1, 3, 3, 'Ofertas Teste')`,
      [jornal_id, pagina_id]
    )
    const secao = await queryOne<any>(
      'SELECT * FROM jornal_secoes WHERE jornal_id = $1 AND posicao = 1',
      [jornal_id]
    )
    secao_id = secao!.jornal_secao_id

    await execute(
      `INSERT INTO jornal_itens (jornal_id, jornal_secao_id, posicao, produto_id, preco_oferta, preco_clube)
       VALUES ($1, $2, 1, $3, 12.99, 10.99)`,
      [jornal_id, secao_id, produtoA_id]
    )
    const item = await queryOne<any>(
      'SELECT * FROM jornal_itens WHERE jornal_id = $1 AND posicao = 1',
      [jornal_id]
    )
    item_id = item!.item_id

    // Create an older journal for history tests
    await execute(
      `INSERT INTO jornais (titulo, tipo, data_inicio, data_fim, status)
       VALUES ('Jornal Antigo', 'semanal', '2026-02-01', '2026-02-07', 'exportado')`
    )
    const jornalAntigo = await queryOne<any>(
      "SELECT * FROM jornais WHERE titulo = 'Jornal Antigo'"
    )
    await execute(
      'INSERT INTO jornal_paginas (jornal_id, numero) VALUES ($1, 1)',
      [jornalAntigo!.jornal_id]
    )
    const paginaAntiga = await queryOne<any>(
      'SELECT * FROM jornal_paginas WHERE jornal_id = $1',
      [jornalAntigo!.jornal_id]
    )
    await execute(
      `INSERT INTO jornal_secoes (jornal_id, pagina_id, posicao, grid_cols, grid_rows, nome_custom)
       VALUES ($1, $2, 1, 3, 3, 'Secao Antiga')`,
      [jornalAntigo!.jornal_id, paginaAntiga!.pagina_id]
    )
    const secaoAntiga = await queryOne<any>(
      'SELECT * FROM jornal_secoes WHERE jornal_id = $1',
      [jornalAntigo!.jornal_id]
    )
    await execute(
      `INSERT INTO jornal_itens (jornal_id, jornal_secao_id, posicao, produto_id, preco_oferta, preco_clube)
       VALUES ($1, $2, 1, $3, 14.50, 12.50)`,
      [jornalAntigo!.jornal_id, secaoAntiga!.jornal_secao_id, produtoA_id]
    )
  })

  afterAll(async () => {
    await closeDb()
  })

  // --- trocar_item ---
  it('trocar_item should swap product on an item', async () => {
    const result = await iaTools.trocar_item.execute(
      { item_id, novo_produto_id: produtoB_id },
      mockOptions
    )
    expect(result.status).toBe('ok')
    expect(result.data.novo_produto.produto_id).toBe(produtoB_id)
    expect(result.data.novo_produto.nome).toBe('FEIJAO CARIOCA 1KG')
  })

  it('trocar_item should fail for nonexistent item', async () => {
    const result = await iaTools.trocar_item.execute(
      { item_id: 99999, novo_produto_id: produtoB_id },
      mockOptions
    )
    expect(result.status).toBe('erro')
    expect(result.summary).toContain('não encontrado')
  })

  it('trocar_item should fail for nonexistent product', async () => {
    const result = await iaTools.trocar_item.execute(
      { item_id, novo_produto_id: 99999 },
      mockOptions
    )
    expect(result.status).toBe('erro')
    expect(result.summary).toContain('não encontrado')
  })

  // --- atualizar_item ---
  it('atualizar_item should update price fields', async () => {
    const result = await iaTools.atualizar_item.execute(
      { item_id, preco_oferta: 9.99, preco_clube: 8.49 },
      mockOptions
    )
    expect(result.status).toBe('ok')
    expect(result.data.atualizado).toContain('preco_oferta')
    expect(result.data.atualizado).toContain('preco_clube')
  })

  it('atualizar_item should fail for nonexistent item', async () => {
    const result = await iaTools.atualizar_item.execute(
      { item_id: 99999, preco_oferta: 5.00 },
      mockOptions
    )
    expect(result.status).toBe('erro')
    expect(result.summary).toContain('não encontrado')
  })

  it('atualizar_item should fail when no fields provided', async () => {
    const result = await iaTools.atualizar_item.execute(
      { item_id },
      mockOptions
    )
    expect(result.status).toBe('erro')
    expect(result.summary).toContain('Nenhum campo')
  })

  // --- buscar_historico ---
  it('buscar_historico should return journals ordered by date', async () => {
    const result = await iaTools.buscar_historico.execute({}, mockOptions)
    expect(result.status).toBe('ok')
    expect(result.data.total).toBeGreaterThanOrEqual(2)
    // Most recent first
    const datas = result.data.jornais.map((j: any) => j.data_inicio)
    expect(datas[0] >= datas[1]).toBe(true)
  })

  it('buscar_historico should respect limite', async () => {
    const result = await iaTools.buscar_historico.execute({ limite: 1 }, mockOptions)
    expect(result.status).toBe('ok')
    expect(result.data.total).toBe(1)
  })

  // --- comparar_precos ---
  it('comparar_precos should show price history across editions', async () => {
    const result = await iaTools.comparar_precos.execute(
      { produto_id: produtoA_id },
      mockOptions
    )
    expect(result.status).toBe('ok')
    expect(result.data.total_edicoes).toBeGreaterThanOrEqual(1)
    expect(result.data.historico.length).toBeGreaterThanOrEqual(1)
    expect(result.data.historico[0]).toHaveProperty('preco_oferta')
    expect(result.data.historico[0]).toHaveProperty('data_inicio')
  })

  it('comparar_precos should return vazio for product never in journal', async () => {
    // produtoB was swapped IN but let's create a fresh one never used
    const prodC = await criarProduto({
      codigo: 'EXT003',
      nome: 'PRODUTO NUNCA USADO',
      unidade: 'UN'
    })
    const result = await iaTools.comparar_precos.execute(
      { produto_id: prodC.produto_id },
      mockOptions
    )
    expect(result.status).toBe('vazio')
    expect(result.summary).toContain('nunca apareceu')
  })

  it('comparar_precos should fail for nonexistent product', async () => {
    const result = await iaTools.comparar_precos.execute(
      { produto_id: 99999 },
      mockOptions
    )
    expect(result.status).toBe('erro')
    expect(result.summary).toContain('não encontrado')
  })

  // --- listar_secoes ---
  it('listar_secoes should return sections of current draft', async () => {
    const result = await iaTools.listar_secoes.execute({}, mockOptions)
    expect(result.status).toBe('ok')
    expect(result.data.jornal_id).toBe(jornal_id)
    expect(result.data.total_secoes).toBeGreaterThanOrEqual(1)
    const secao = result.data.secoes.find((s: any) => s.nome === 'Ofertas Teste')
    expect(secao).toBeDefined()
    expect(secao!.grid).toBe('3x3')
  })

  // --- adicionar_secao ---
  it('adicionar_secao should create a new section', async () => {
    const result = await iaTools.adicionar_secao.execute(
      { jornal_id, pagina_numero: 1, nome: 'Hortifruti Extra', grid_cols: 4, grid_rows: 2 },
      mockOptions
    )
    expect(result.status).toBe('ok')
    expect(result.data.secao.nome).toBe('Hortifruti Extra')
    expect(result.data.secao.grid).toBe('4x2')
  })

  it('adicionar_secao should fail for nonexistent page', async () => {
    const result = await iaTools.adicionar_secao.execute(
      { jornal_id, pagina_numero: 99, nome: 'Inexistente' },
      mockOptions
    )
    expect(result.status).toBe('erro')
    expect(result.summary).toContain('não encontrada')
  })

  // --- stats_banco ---
  it('stats_banco should return catalog statistics', async () => {
    const result = await iaTools.stats_banco.execute({}, mockOptions)
    expect(result.status).toBe('ok')
    expect(result.data.produtos_ativos).toBeGreaterThanOrEqual(3) // EXT001, EXT002, EXT003
    expect(result.data.total_jornais).toBeGreaterThanOrEqual(2)
    expect(result.data.jornais_rascunho).toBeGreaterThanOrEqual(1)
    expect(typeof result.data.total_imagens).toBe('number')
    expect(typeof result.data.produtos_com_imagem).toBe('number')
  })
})
