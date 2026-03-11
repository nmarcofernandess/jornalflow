import { PGlite } from '@electric-sql/pglite'

let db: PGlite | null = null

export async function getDb(): Promise<PGlite> {
  if (db) return db
  // In test/dev: in-memory. In prod: use app.getPath('userData') + '/pglite'
  const dataDir = process.env.PGLITE_DATA_DIR || undefined
  db = new PGlite(dataDir)
  return db
}

export async function closeDb(): Promise<void> {
  if (db) {
    await db.close()
    db = null
  }
}
