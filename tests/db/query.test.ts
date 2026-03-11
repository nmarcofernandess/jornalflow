import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getDb, closeDb } from '../../src/main/db/database'
import { queryAll, queryOne, execute, transaction } from '../../src/main/db/query'

describe('database', () => {
  beforeAll(async () => {
    await getDb() // in-memory for tests
  })

  afterAll(async () => {
    await closeDb()
  })

  it('should connect and execute a simple query', async () => {
    const db = await getDb()
    const result = await db.query('SELECT 1 as num')
    expect(result.rows[0].num).toBe(1)
  })
})

describe('query helpers', () => {
  beforeAll(async () => {
    const db = await getDb()
    await db.query(`
      CREATE TABLE IF NOT EXISTS _test (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        valor DECIMAL(10,2)
      )
    `)
  })

  afterAll(async () => {
    await closeDb()
  })

  it('execute should insert a row', async () => {
    await execute('INSERT INTO _test (nome, valor) VALUES ($1, $2)', ['item1', 10.5])
    const result = await queryOne<{ nome: string }>('SELECT nome FROM _test WHERE nome = $1', ['item1'])
    expect(result?.nome).toBe('item1')
  })

  it('queryAll should return all rows', async () => {
    await execute('INSERT INTO _test (nome, valor) VALUES ($1, $2)', ['item2', 20.0])
    const rows = await queryAll<{ nome: string }>('SELECT nome FROM _test ORDER BY nome')
    expect(rows.length).toBeGreaterThanOrEqual(2)
  })

  it('transaction should rollback on error', async () => {
    const countBefore = await queryOne<{ count: number }>('SELECT COUNT(*)::int as count FROM _test')
    try {
      await transaction(async () => {
        await execute('INSERT INTO _test (nome, valor) VALUES ($1, $2)', ['rollback_test', 0])
        throw new Error('force rollback')
      })
    } catch { /* expected */ }
    const countAfter = await queryOne<{ count: number }>('SELECT COUNT(*)::int as count FROM _test')
    expect(countAfter?.count).toBe(countBefore?.count)
  })
})
