import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getDb, closeDb } from '../../src/main/db/database'
import { applyMigrations } from '../../src/main/db/schema'

describe('schema', () => {
  beforeAll(async () => {
    await getDb()
  }, 30000)
  afterAll(async () => { await closeDb() })

  it('should apply all migrations without error', async () => {
    await applyMigrations()
    const db = await getDb()
    const tables = await db.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `)
    const names = tables.rows.map((r: any) => r.table_name)
    expect(names).toContain('produtos')
    expect(names).toContain('produto_imagens')
    expect(names).toContain('jornais')
    expect(names).toContain('jornal_paginas')
    expect(names).toContain('jornal_secoes')
    expect(names).toContain('jornal_itens')
    expect(names).toContain('template_secoes')
    expect(names).toContain('secao_aliases')
    expect(names).toContain('lojas')
    expect(names).toContain('importacoes')
    // IA v2 tables (migration v3)
    expect(names).toContain('configuracao_ia')
    expect(names).toContain('ia_conversas')
    expect(names).toContain('ia_mensagens')
    // Knowledge tables (migration v4)
    expect(names).toContain('knowledge_sources')
    expect(names).toContain('knowledge_chunks')
    // Memory table (migration v5)
    expect(names).toContain('ia_memorias')
    // Knowledge graph tables (migration v6)
    expect(names).toContain('knowledge_entities')
    expect(names).toContain('knowledge_relations')
  })

  it('should be idempotent (running twice is safe)', async () => {
    await applyMigrations() // second run
    const db = await getDb()
    const result = await db.query('SELECT version FROM _migrations ORDER BY version')
    expect(result.rows.length).toBeGreaterThan(0)
  })
})
