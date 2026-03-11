import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getDb, closeDb } from '../../src/main/db/database'
import { applyMigrations } from '../../src/main/db/schema'

describe('schema', () => {
  beforeAll(async () => {
    await getDb()
  })
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
  })

  it('should be idempotent (running twice is safe)', async () => {
    await applyMigrations() // second run
    const db = await getDb()
    const result = await db.query('SELECT version FROM _migrations ORDER BY version')
    expect(result.rows.length).toBeGreaterThan(0)
  })
})
