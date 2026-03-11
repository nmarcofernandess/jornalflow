import { PGlite } from '@electric-sql/pglite'
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
