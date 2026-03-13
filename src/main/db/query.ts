import { getDb } from './database'

export async function queryAll<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDb()
  const result = await db.query(sql, params)
  return result.rows as T[]
}

export async function queryOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await queryAll<T>(sql, params)
  return rows[0] ?? null
}

export async function execute(sql: string, params: unknown[] = []): Promise<void> {
  const db = await getDb()
  await db.query(sql, params)
}

/**
 * INSERT com RETURNING — appends RETURNING <column> se não tiver na query.
 * Retorna o valor da coluna inserida como number.
 * Tabelas novas (ia_*) usam 'id'; tabelas legadas permitem override (ex: 'produto_id').
 */
export async function insertReturningId(
  sql: string,
  params: unknown[] = [],
  returningColumn: string = 'id'
): Promise<number> {
  const db = await getDb()
  const withReturning = sql.match(/RETURNING\s/i) ? sql : `${sql} RETURNING ${returningColumn}`
  const result = await db.query(withReturning, params)
  const row = result.rows[0] as Record<string, unknown> | undefined
  return (row?.[returningColumn] as number) ?? 0
}

export async function transaction(fn: () => Promise<void>): Promise<void> {
  const db = await getDb()
  await db.query('BEGIN')
  try {
    await fn()
    await db.query('COMMIT')
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}
