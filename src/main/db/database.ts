import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite/vector'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import fs from 'fs/promises'
import path from 'path'

let db: PGlite | null = null

// Electron app — guarded for test environments where electron isn't available
let electronApp: { getPath(name: string): string; isPackaged: boolean } | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  electronApp = require('electron').app
} catch {
  // Not running in Electron (e.g. vitest) — that's fine
}

export function getDataDir(): string {
  if (electronApp?.isPackaged) {
    return path.join(electronApp.getPath('userData'), 'data')
  }
  return path.join(process.cwd(), 'data')
}

export async function ensureDataDirs(): Promise<void> {
  const base = getDataDir()
  const dirs = [
    path.join(base, 'images', 'products'),
    path.join(base, 'images', 'playground'),
    path.join(base, 'images', 'assets', 'backgrounds'),
    path.join(base, 'images', 'assets', 'headers'),
    path.join(base, 'images', 'assets', 'banners'),
    path.join(base, 'images', 'assets', 'loja'),
    path.join(base, 'exports'),
    path.join(base, 'pglite')
  ]
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true })
  }
}

export async function getDb(): Promise<PGlite> {
  if (db) return db
  // In test/dev: in-memory (no dataDir). In prod: use PGLITE_DATA_DIR env var.
  const dataDir = process.env.PGLITE_DATA_DIR || undefined
  db = await PGlite.create({
    dataDir,
    extensions: { vector, pg_trgm }
  })
  // Enable extensions — must run before any migration that uses vector() or gin_trgm_ops
  await db.exec('CREATE EXTENSION IF NOT EXISTS vector')
  await db.exec('CREATE EXTENSION IF NOT EXISTS pg_trgm')
  return db
}

export async function closeDb(): Promise<void> {
  if (db) {
    await db.close()
    db = null
  }
}
