import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getDb, closeDb } from '../../src/main/db/database'
import { applyMigrations } from '../../src/main/db/schema'
import { seed } from '../../src/main/db/seed'
import { criarProduto } from '../../src/main/servicos/produtos'
import { execute, queryAll, queryOne } from '../../src/main/db/query'
import { importarPlanilha } from '../../src/main/import/flow'

const SAMPLE_TSV = `Produto\tDescrição\tPreço Oferta\tTipo Oferta\tclube
515\tCERVEJA CRYSTAL 350 ML LATA\t2,49\tACOUGUE\t2,39
5920\tCOXAO MOLE KG\t45,98\tACOUGUE\t44,98
6536\tLARANJA PERA KG\t3,89\tHORTIFRUTI\t3,59
1001\tARROZ BRANCO 5KG\t22,90\tMERCEARIA\t21,90`

describe('import flow', () => {
  beforeAll(async () => {
    await getDb()
    await applyMigrations()
    await seed()

    // Pre-create one product with default image (to test 'match' status)
    const p = await criarProduto({ codigo: '515', nome: 'CERVEJA CRYSTAL 350ML', unidade: 'UN', categoria: 'bebidas' })
    await execute(
      `INSERT INTO produto_imagens (produto_id, arquivo_path, is_default)
       VALUES ($1, 'images/products/515/foto.png', true)`,
      [p.produto_id]
    )
  })

  afterAll(async () => { await closeDb() })

  it('should import planilha and create journal with items', async () => {
    const result = await importarPlanilha({
      text: SAMPLE_TSV,
      data_inicio: '2026-03-10',
      data_fim: '2026-03-16',
      arquivo_nome: 'ofertas-semana-10.tsv'
    })

    expect(result.total).toBe(4)
    expect(result.matched).toBeGreaterThanOrEqual(1) // cerveja has default image
    expect(result.fallbacks).toBeGreaterThanOrEqual(1) // auto-created products have no image

    // Verify journal was created
    const jornal = await queryOne<{ titulo: string; tipo: string; status: string }>(
      'SELECT * FROM jornais ORDER BY jornal_id DESC LIMIT 1'
    )
    expect(jornal?.tipo).toBe('semanal')
    expect(jornal?.status).toBe('rascunho')

    // Verify 3 pages created
    const paginas = await queryAll<{ numero: number; layout: string }>(
      'SELECT numero, layout FROM jornal_paginas ORDER BY numero'
    )
    expect(paginas.map(p => p.numero)).toEqual([1, 2, 3])
    expect(paginas[0].layout).toBe('full')
    expect(paginas[1].layout).toBe('dupla')
    expect(paginas[2].layout).toBe('dupla')

    // Verify all 5 template sections were created as jornal_secoes
    const secoes = await queryAll<{ jornal_secao_id: number }>(
      'SELECT * FROM jornal_secoes'
    )
    expect(secoes.length).toBe(5)

    // Verify items assigned to correct sections
    const itens = await queryAll<{ produto_id: number; preco_oferta: number; is_fallback: boolean }>(
      'SELECT * FROM jornal_itens'
    )
    expect(itens.length).toBe(4)

    // Verify importacao record
    const imp = await queryOne<{ total_itens: number; arquivo_nome: string }>(
      'SELECT * FROM importacoes ORDER BY importacao_id DESC LIMIT 1'
    )
    expect(imp?.total_itens).toBe(4)
    expect(imp?.arquivo_nome).toBe('ofertas-semana-10.tsv')
  })

  it('should auto-create products not in DB', async () => {
    // Products 5920, 6536, 1001 didn't exist before import — they should now
    const coxao = await queryOne<{ codigo: string; nome: string }>(
      'SELECT * FROM produtos WHERE codigo = $1', ['5920']
    )
    expect(coxao).not.toBeNull()
    expect(coxao?.nome).toBe('COXAO MOLE KG')

    const laranja = await queryOne<{ codigo: string }>(
      'SELECT * FROM produtos WHERE codigo = $1', ['6536']
    )
    expect(laranja).not.toBeNull()

    const arroz = await queryOne<{ codigo: string }>(
      'SELECT * FROM produtos WHERE codigo = $1', ['1001']
    )
    expect(arroz).not.toBeNull()
  })

  it('should assign items to correct sections by tipo_oferta alias', async () => {
    // Get the jornal
    const jornal = await queryOne<{ jornal_id: number }>(
      'SELECT jornal_id FROM jornais ORDER BY jornal_id DESC LIMIT 1'
    )

    // ACOUGUE items should be in acougue section
    const acougueSecao = await queryOne<{ jornal_secao_id: number }>(
      `SELECT js.jornal_secao_id FROM jornal_secoes js
       JOIN template_secoes ts ON ts.secao_id = js.template_secao_id
       WHERE ts.slug = 'acougue' AND js.jornal_id = $1`,
      [jornal!.jornal_id]
    )
    const acougueItens = await queryAll<{ item_id: number }>(
      'SELECT * FROM jornal_itens WHERE jornal_secao_id = $1',
      [acougueSecao!.jornal_secao_id]
    )
    expect(acougueItens.length).toBe(2) // cerveja + coxao mole

    // HORTIFRUTI items
    const hortifrutiSecao = await queryOne<{ jornal_secao_id: number }>(
      `SELECT js.jornal_secao_id FROM jornal_secoes js
       JOIN template_secoes ts ON ts.secao_id = js.template_secao_id
       WHERE ts.slug = 'hortifruti' AND js.jornal_id = $1`,
      [jornal!.jornal_id]
    )
    const hortifrutiItens = await queryAll<{ item_id: number }>(
      'SELECT * FROM jornal_itens WHERE jornal_secao_id = $1',
      [hortifrutiSecao!.jornal_secao_id]
    )
    expect(hortifrutiItens.length).toBe(1) // laranja

    // MERCEARIA items
    const merceariaSecao = await queryOne<{ jornal_secao_id: number }>(
      `SELECT js.jornal_secao_id FROM jornal_secoes js
       JOIN template_secoes ts ON ts.secao_id = js.template_secao_id
       WHERE ts.slug = 'mercearia' AND js.jornal_id = $1`,
      [jornal!.jornal_id]
    )
    const merceariaItens = await queryAll<{ item_id: number }>(
      'SELECT * FROM jornal_itens WHERE jornal_secao_id = $1',
      [merceariaSecao!.jornal_secao_id]
    )
    expect(merceariaItens.length).toBe(1) // arroz
  })

  it('should track nao_encontrados as 0 since all are auto-created', async () => {
    // The import auto-creates missing products, so nao_encontrados should be 0
    const imp = await queryOne<{ nao_encontrados: number }>(
      'SELECT * FROM importacoes ORDER BY importacao_id DESC LIMIT 1'
    )
    expect(imp?.nao_encontrados).toBe(0)
  })
})
