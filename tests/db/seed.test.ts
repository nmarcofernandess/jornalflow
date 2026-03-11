import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getDb, closeDb } from '../../src/main/db/database'
import { applyMigrations } from '../../src/main/db/schema'
import { seed } from '../../src/main/db/seed'
import { queryAll, queryOne } from '../../src/main/db/query'

describe('seed', () => {
  beforeAll(async () => {
    await getDb()
    await applyMigrations()
  })
  afterAll(async () => { await closeDb() })

  it('should seed loja, template_secoes, and secao_aliases', async () => {
    await seed()

    const loja = await queryOne<{ nome: string }>('SELECT nome FROM lojas LIMIT 1')
    expect(loja?.nome).toBe('Sup Fernandes')

    const secoes = await queryAll<{ slug: string }>('SELECT slug FROM template_secoes ORDER BY pagina, posicao')
    expect(secoes.map(s => s.slug)).toEqual([
      'acougue', 'hortifruti', 'mercearia', 'padaria', 'casa-higiene'
    ])

    const aliases = await queryAll<{ alias: string }>('SELECT alias FROM secao_aliases ORDER BY alias')
    expect(aliases.map(a => a.alias)).toContain('ACOUGUE')
    expect(aliases.map(a => a.alias)).toContain('PEREC-MAT')
    expect(aliases.map(a => a.alias)).toContain('CASA-HIGIENE')
  })

  it('should be idempotent', async () => {
    await seed() // second run
    const count = await queryOne<{ count: number }>('SELECT COUNT(*)::int as count FROM template_secoes')
    expect(count?.count).toBe(5)
  })
})
