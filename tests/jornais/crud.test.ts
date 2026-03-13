import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getDb, closeDb } from '../../src/main/db/database'
import { applyMigrations } from '../../src/main/db/schema'
import { seed } from '../../src/main/db/seed'
import { criarProduto } from '../../src/main/servicos/produtos'
import { execute } from '../../src/main/db/query'
import {
  carregarJornal,
  atualizarItem,
  listarRascunhos,
  listarJornais,
  dashboardStats,
  buscarProdutoNoHistorico,
  getLoja,
  criarJornalEspecial,
  adicionarPagina,
  adicionarSecao,
  adicionarItemASecao,
  atualizarLoja
} from '../../src/main/servicos/jornais'

describe('jornais CRUD', () => {
  let jornalId: number
  let paginaId: number
  let secaoId: number
  let produtoId: number

  beforeAll(async () => {
    await getDb()
    await applyMigrations()
    await seed()

    // Create a test product with image
    const p = await criarProduto({ codigo: 'J001', nome: 'CAFÉ 500G', unidade: 'UN', categoria: 'mercearia' })
    produtoId = p.produto_id
    await execute(
      `INSERT INTO produto_imagens (produto_id, arquivo_path, is_default)
       VALUES ($1, 'images/products/J001/cafe.png', true)`,
      [produtoId]
    )
  }, 30000)

  afterAll(async () => {
    await closeDb()
  })

  // === Jornal Especial ===

  it('should create a special journal', async () => {
    const jornal = await criarJornalEspecial({
      titulo: 'Black Friday Fernandes',
      data_inicio: '2026-11-27',
      data_fim: '2026-11-29'
    })
    jornalId = jornal.jornal_id
    expect(jornal.tipo).toBe('especial')
    expect(jornal.status).toBe('rascunho')
    expect(jornal.titulo).toBe('Black Friday Fernandes')
  })

  // === Páginas ===

  it('should add page to journal', async () => {
    const pagina = await adicionarPagina(jornalId, 'full')
    paginaId = pagina.pagina_id
    expect(pagina.numero).toBe(1)
    expect(pagina.layout).toBe('full')
    expect(pagina.jornal_id).toBe(jornalId)
  })

  it('should auto-increment page number', async () => {
    const pagina2 = await adicionarPagina(jornalId, 'dupla')
    expect(pagina2.numero).toBe(2)
    expect(pagina2.layout).toBe('dupla')
  })

  // === Seções ===

  it('should add section to page', async () => {
    const secao = await adicionarSecao({
      jornal_id: jornalId,
      pagina_id: paginaId,
      nome_custom: 'Promoção Relâmpago',
      lado: 'full',
      grid_cols: 3,
      grid_rows: 3
    })
    secaoId = secao.jornal_secao_id
    expect(secao.nome_custom).toBe('Promoção Relâmpago')
    expect(secao.posicao).toBe(1)
    expect(secao.lado).toBe('full')
  })

  it('should auto-increment section position', async () => {
    const secao2 = await adicionarSecao({
      jornal_id: jornalId,
      pagina_id: paginaId,
      nome_custom: 'Bebidas',
      lado: 'esquerda'
    })
    expect(secao2.posicao).toBe(2)
  })

  // === Itens ===

  it('should add item to section with auto default image', async () => {
    await adicionarItemASecao({
      jornal_id: jornalId,
      jornal_secao_id: secaoId,
      produto_id: produtoId,
      preco_oferta: 12.99,
      preco_clube: 11.49
    })

    // Verify the item was created
    const data = await carregarJornal(jornalId)
    const item = data.itens.find(i => i.produto_id === produtoId)
    expect(item).toBeDefined()
    expect(Number(item!.preco_oferta)).toBe(12.99)
    expect(Number(item!.preco_clube)).toBe(11.49)
    expect(item!.posicao).toBe(1)
    expect(item!.imagem_id).not.toBeNull() // auto-attached default image
    expect(item!.is_fallback).toBe(false) // has default image
  })

  it('should mark is_fallback when product has no image', async () => {
    const p2 = await criarProduto({ codigo: 'J002', nome: 'PRODUTO SEM FOTO', unidade: 'KG' })
    await adicionarItemASecao({
      jornal_id: jornalId,
      jornal_secao_id: secaoId,
      produto_id: p2.produto_id,
      preco_oferta: 5.0
    })

    const data = await carregarJornal(jornalId)
    const item = data.itens.find(i => i.produto_id === p2.produto_id)
    expect(item!.imagem_id).toBeNull()
    expect(item!.is_fallback).toBe(true) // no image = fallback
  })

  // === Carregar Jornal Completo ===

  it('should load full journal data', async () => {
    const data = await carregarJornal(jornalId)
    expect(data.jornal.jornal_id).toBe(jornalId)
    expect(data.paginas.length).toBe(2) // added 2 pages
    expect(data.secoes.length).toBe(2) // added 2 sections
    expect(data.itens.length).toBe(2) // 2 items
    expect(data.produtos.length).toBe(2) // J001 + J002
    expect(data.templates.length).toBe(5) // seeded templates
    expect(data.loja).not.toBeNull()
    expect(data.loja?.nome).toContain('Fernandes')
  })

  it('should throw on nonexistent journal', async () => {
    await expect(carregarJornal(99999)).rejects.toThrow('não encontrado')
  })

  // === Atualizar Item ===

  it('should update item fields', async () => {
    const data = await carregarJornal(jornalId)
    const item = data.itens[0]
    await atualizarItem(item.item_id, {
      preco_oferta: 9.99,
      img_scale: 1.5,
      img_offset_x: 10
    })

    const updated = await carregarJornal(jornalId)
    const updatedItem = updated.itens.find(i => i.item_id === item.item_id)!
    expect(Number(updatedItem.preco_oferta)).toBe(9.99)
    expect(Number(updatedItem.img_scale)).toBe(1.5)
    expect(updatedItem.img_offset_x).toBe(10)
  })

  it('should ignore non-whitelisted columns in update', async () => {
    const data = await carregarJornal(jornalId)
    const item = data.itens[0]

    // Attempt to inject a non-whitelisted column — should be silently ignored
    await atualizarItem(item.item_id, {
      preco_oferta: 8.0,
      jornal_id: 9999 // not in whitelist
    } as any)

    const updated = await carregarJornal(jornalId)
    const updatedItem = updated.itens.find(i => i.item_id === item.item_id)!
    expect(Number(updatedItem.preco_oferta)).toBe(8.0)
    expect(updatedItem.jornal_id).toBe(jornalId) // unchanged
  })

  // === Listagem ===

  it('should list drafts', async () => {
    const rascunhos = await listarRascunhos()
    expect(rascunhos.length).toBeGreaterThanOrEqual(1)
    expect(rascunhos.every(j => j.status === 'rascunho')).toBe(true)
  })

  it('should list all journals', async () => {
    const todos = await listarJornais()
    expect(todos.length).toBeGreaterThanOrEqual(1)
  })

  // === Dashboard ===

  it('should return dashboard stats', async () => {
    const stats = await dashboardStats()
    expect(stats.total_produtos).toBeGreaterThanOrEqual(2)
    expect(stats.produtos_com_imagem).toBeGreaterThanOrEqual(1)
    expect(stats.total_jornais).toBeGreaterThanOrEqual(1)
    expect(stats.rascunho_atual).not.toBeNull()
    // No exported journal yet
    expect(stats.ultimo_exportado).toBeNull()
  })

  // === Loja ===

  it('should get loja data', async () => {
    const loja = await getLoja()
    expect(loja).not.toBeNull()
    expect(loja?.nome).toContain('Fernandes')
  })

  it('should update loja data', async () => {
    const updated = await atualizarLoja({ telefone: '(11) 99999-8888' })
    expect(updated.telefone).toBe('(11) 99999-8888')
    expect(updated.nome).toContain('Fernandes') // unchanged field preserved
  })
}, 60000)
