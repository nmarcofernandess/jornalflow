# JornalFlow V1 — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a desktop Electron app that automates supermarket flyer creation — import product spreadsheet, match with image database, render HTML preview, edit, export multi-format.

**Architecture:** Electron 39 + React 19 frontend with split-view editor (panel + preview). PGlite database for products/journals/history. Type-safe IPC via tipc. HTML/CSS template rendering with Puppeteer export. Vercel AI SDK + Gemini for ~15 assistant tools.

**Tech Stack:** Electron 39, electron-vite 5, React 19, Tailwind 4, shadcn/ui, PGlite, @egoist/tipc, Zustand, Vercel AI SDK, Puppeteer, Zod, Vitest

**Spec:** `docs/specs/DESIGN.md`

**Pre-existing files (already in repo):**
- `src/shared/types.ts` — all TypeScript interfaces (Produto, Jornal, JornalItem, etc.)
- `src/shared/constants.ts` — SECOES_DEFAULT, UNIDADES, CATEGORIAS, UNIDADE_PATTERNS, EXPORT_DIMENSIONS
- `src/shared/index.ts` — re-exports
- `src/renderer/src/lib/utils.ts` — cn() utility
- `src/renderer/src/assets/main.css` — Tailwind 4 + shadcn theme
- `components.json` — shadcn/ui config for electron-vite
- `electron.vite.config.ts` — aliases: @renderer, @shared

**Conventions:**
- `snake_case` end-to-end (DB → IPC → React props)
- Components: `PascalCase.tsx`
- Services: `servicos/{entity}.ts`
- All shared types: import from `@shared/types` (renderer) or `../../shared/types` (main)
- All DB queries through `src/main/db/query.ts` helpers

---

## Chunk 1: Database Foundation

### Task 1: PGlite Database Connection + Query Helpers

**Files:**
- Create: `src/main/db/database.ts`
- Create: `src/main/db/query.ts`
- Test: `tests/db/query.test.ts`

- [ ] **Step 1: Install vitest + create config**

```bash
npm install -D vitest
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

Create `vitest.config.ts` at project root:
```typescript
import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared')
    }
  },
  test: {
    globals: true,
    environment: 'node'
  }
})
```

- [ ] **Step 2: Write test for database connection**

```typescript
// tests/db/query.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getDb, closeDb } from '../../src/main/db/database'

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
```

- [ ] **Step 3: Run test — expect FAIL**

```bash
npx vitest run tests/db/query.test.ts
```

- [ ] **Step 4: Implement database.ts**

```typescript
// src/main/db/database.ts
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
```

- [ ] **Step 5: Write tests for query helpers**

```typescript
// tests/db/query.test.ts (add to existing)
import { queryAll, queryOne, execute, transaction } from '../../src/main/db/query'

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
```

- [ ] **Step 6: Implement query.ts**

```typescript
// src/main/db/query.ts
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
```

- [ ] **Step 7: Run tests — expect PASS**

```bash
npx vitest run tests/db/query.test.ts
```

- [ ] **Step 8: Commit**

```bash
git add src/main/db/database.ts src/main/db/query.ts tests/db/query.test.ts package.json package-lock.json
git commit -m "feat(db): PGlite connection + query helpers with tests"
```

---

### Task 2: Schema + Migrations

**Files:**
- Create: `src/main/db/schema.ts`
- Test: `tests/db/schema.test.ts`

- [ ] **Step 1: Write test for schema application**

```typescript
// tests/db/schema.test.ts
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
    // Verify core tables exist
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
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement schema.ts with full DDL**

```typescript
// src/main/db/schema.ts
import { getDb } from './database'

interface Migration {
  version: number
  up: string
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up: `
      CREATE TABLE lojas (
        loja_id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        endereco TEXT,
        telefone TEXT,
        horario_func TEXT,
        logo_path TEXT
      );

      CREATE TABLE produtos (
        produto_id SERIAL PRIMARY KEY,
        codigo TEXT UNIQUE NOT NULL,
        nome TEXT NOT NULL,
        nome_card TEXT,
        unidade TEXT NOT NULL,
        categoria TEXT,
        ativo BOOLEAN DEFAULT true,
        criado_em TIMESTAMP DEFAULT NOW(),
        atualizado_em TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE produto_imagens (
        imagem_id SERIAL PRIMARY KEY,
        produto_id INT NOT NULL REFERENCES produtos(produto_id) ON DELETE CASCADE,
        arquivo_path TEXT NOT NULL,
        variacao TEXT,
        is_default BOOLEAN DEFAULT false,
        criado_em TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE template_secoes (
        secao_id SERIAL PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        nome_display TEXT NOT NULL,
        posicao INT NOT NULL,
        pagina INT NOT NULL,
        lado TEXT,
        grid_cols INT DEFAULT 3,
        grid_rows INT DEFAULT 3,
        bg_path TEXT,
        header_path TEXT,
        cor_tema TEXT
      );

      CREATE TABLE secao_aliases (
        alias_id SERIAL PRIMARY KEY,
        secao_id INT NOT NULL REFERENCES template_secoes(secao_id) ON DELETE CASCADE,
        alias TEXT UNIQUE NOT NULL
      );

      CREATE TABLE jornais (
        jornal_id SERIAL PRIMARY KEY,
        titulo TEXT,
        tipo TEXT DEFAULT 'semanal',
        data_inicio DATE NOT NULL,
        data_fim DATE NOT NULL,
        banner_path TEXT,
        status TEXT DEFAULT 'rascunho',
        criado_em TIMESTAMP DEFAULT NOW(),
        atualizado_em TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE jornal_paginas (
        pagina_id SERIAL PRIMARY KEY,
        jornal_id INT NOT NULL REFERENCES jornais(jornal_id) ON DELETE CASCADE,
        numero INT NOT NULL,
        layout TEXT DEFAULT 'dupla',
        banner_path TEXT,
        UNIQUE(jornal_id, numero)
      );

      CREATE TABLE jornal_secoes (
        jornal_secao_id SERIAL PRIMARY KEY,
        jornal_id INT NOT NULL REFERENCES jornais(jornal_id) ON DELETE CASCADE,
        pagina_id INT NOT NULL REFERENCES jornal_paginas(pagina_id) ON DELETE CASCADE,
        template_secao_id INT REFERENCES template_secoes(secao_id) ON DELETE SET NULL,
        posicao INT NOT NULL,
        lado TEXT,
        grid_cols INT DEFAULT 3,
        grid_rows INT DEFAULT 3,
        nome_custom TEXT,
        bg_custom TEXT,
        header_custom TEXT
      );

      CREATE TABLE jornal_itens (
        item_id SERIAL PRIMARY KEY,
        jornal_id INT NOT NULL REFERENCES jornais(jornal_id) ON DELETE CASCADE,
        jornal_secao_id INT NOT NULL REFERENCES jornal_secoes(jornal_secao_id) ON DELETE CASCADE,
        posicao INT NOT NULL,
        produto_id INT NOT NULL REFERENCES produtos(produto_id) ON DELETE RESTRICT,
        preco_oferta DECIMAL(10,2) NOT NULL,
        preco_clube DECIMAL(10,2) NOT NULL,
        unidade_display TEXT,
        imagem_id INT REFERENCES produto_imagens(imagem_id),
        is_fallback BOOLEAN DEFAULT false,
        img_scale DECIMAL(4,2) DEFAULT 1.0,
        img_offset_x INT DEFAULT 0,
        img_offset_y INT DEFAULT 0,
        imgs_compostas JSONB,
        criado_em TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE importacoes (
        importacao_id SERIAL PRIMARY KEY,
        jornal_id INT NOT NULL REFERENCES jornais(jornal_id) ON DELETE CASCADE,
        arquivo_nome TEXT NOT NULL,
        total_itens INT,
        matched INT,
        fallbacks INT,
        nao_encontrados INT,
        criado_em TIMESTAMP DEFAULT NOW()
      );
    `
  }
]

export async function applyMigrations(): Promise<void> {
  const db = await getDb()

  // Create migrations tracking table
  await db.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INT PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `)

  // Get applied versions
  const applied = await db.query('SELECT version FROM _migrations ORDER BY version')
  const appliedVersions = new Set(applied.rows.map((r: any) => r.version))

  // Apply pending migrations
  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) continue

    await db.query('BEGIN')
    try {
      await db.query(migration.up)
      await db.query('INSERT INTO _migrations (version) VALUES ($1)', [migration.version])
      await db.query('COMMIT')
    } catch (err) {
      await db.query('ROLLBACK')
      throw new Error(`Migration v${migration.version} failed: ${err}`)
    }
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/main/db/schema.ts tests/db/schema.test.ts
git commit -m "feat(db): schema with all tables + migration system"
```

---

### Task 3: Seed Data

**Files:**
- Create: `src/main/db/seed.ts`
- Test: `tests/db/seed.test.ts`

- [ ] **Step 1: Write test for seed**

```typescript
// tests/db/seed.test.ts
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

    const secoes = await queryAll<{ slug: string }>('SELECT slug FROM template_secoes ORDER BY posicao')
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
```

- [ ] **Step 2: Implement seed.ts**

```typescript
// src/main/db/seed.ts
import { execute, queryOne } from './query'
import { SECOES_DEFAULT } from '../../shared/constants'

export async function seed(): Promise<void> {
  // Loja default
  await execute(`
    INSERT INTO lojas (loja_id, nome, endereco, telefone, horario_func)
    VALUES (1, 'Sup Fernandes', 'R. Américo de Araújo Pires, 533 - Luis Antônio - SP',
            '(16) 3983-1144 / (16) 99741-2979',
            'SEG A SÁB: 8:00 - 19:00 | DOM: 8:00 - 12:00')
    ON CONFLICT (loja_id) DO NOTHING
  `)

  // Template sections + aliases
  for (const secao of SECOES_DEFAULT) {
    await execute(`
      INSERT INTO template_secoes (slug, nome_display, posicao, pagina, lado, grid_cols, grid_rows, cor_tema)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (slug) DO NOTHING
    `, [secao.slug, secao.nome_display, secao.posicao, secao.pagina,
        secao.lado, secao.grid_cols, secao.grid_rows, secao.cor_tema])

    const inserted = await queryOne<{ secao_id: number }>(
      'SELECT secao_id FROM template_secoes WHERE slug = $1', [secao.slug]
    )
    if (!inserted) continue

    for (const alias of secao.aliases) {
      await execute(`
        INSERT INTO secao_aliases (secao_id, alias)
        VALUES ($1, $2)
        ON CONFLICT (alias) DO NOTHING
      `, [inserted.secao_id, alias])
    }
  }
}
```

- [ ] **Step 3: Run tests — expect PASS**

- [ ] **Step 4: Commit**

```bash
git add src/main/db/seed.ts tests/db/seed.test.ts
git commit -m "feat(db): seed data — loja, template sections, aliases"
```

---

### Task 4: IPC Setup (tipc)

**Files:**
- Create: `src/main/tipc.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Create tipc router with a health check handler**

```typescript
// src/main/tipc.ts
import { tipc } from '@egoist/tipc/main'
import { getDb } from './db/database'
import { applyMigrations } from './db/schema'
import { seed } from './db/seed'

const t = tipc.create()

export const router = {
  'app.init': t.procedure.action(async () => {
    await getDb()
    await applyMigrations()
    await seed()
    return { ok: true }
  }),

  'app.health': t.procedure.action(async () => {
    return { status: 'ok', timestamp: new Date().toISOString() }
  })
}

export type Router = typeof router
```

- [ ] **Step 2: Update main/index.ts to register tipc handlers**

```typescript
// src/main/index.ts — add to the app.whenReady() block:
import { tipc } from '@egoist/tipc/main'
import { router } from './tipc'

// Register all IPC handlers
for (const [channel, handler] of Object.entries(router)) {
  tipc.handle(channel, handler)
}

// Initialize DB on startup
import { getDb } from './db/database'
import { applyMigrations } from './db/schema'
import { seed } from './db/seed'

// Ensure data directories exist
import { ensureDataDirs } from './db/database'

app.whenReady().then(async () => {
  await ensureDataDirs()
  await getDb()
  await applyMigrations()
  await seed()
  createWindow()
})
```

Add to `database.ts`:
```typescript
import { app } from 'electron'
import fs from 'fs/promises'
import path from 'path'

export function getDataDir(): string {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'data')
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
```

- [ ] **Step 3: Update preload/index.ts to expose ipcRenderer**

```typescript
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
    on: (channel: string, listener: (...args: unknown[]) => void) => {
      ipcRenderer.on(channel, (_event, ...args) => listener(...args))
      return () => ipcRenderer.removeListener(channel, listener)
    }
  }
})
```

Create renderer-side tipc client:
```typescript
// src/renderer/src/servicos/client.ts
import { createClient } from '@egoist/tipc/renderer'
import type { Router } from '../../../main/tipc'

export const client = createClient<Router>({
  ipcInvoke: window.electron.ipcRenderer.invoke
})
```

- [ ] **Step 4: Verify app boots with `npm run dev`**

```bash
npm run dev
```
Expected: Electron window opens showing "JornalFlow" text. No console errors about IPC.

- [ ] **Step 5: Commit**

```bash
git add src/main/tipc.ts src/main/index.ts src/preload/index.ts
git commit -m "feat(ipc): tipc router + app.init + app.health handlers"
```

---

### Task 5: App Shell (React Router + Sidebar)

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Create: `src/renderer/src/componentes/AppSidebar.tsx`
- Create: `src/renderer/src/paginas/Dashboard.tsx`
- Create: `src/renderer/src/paginas/ProdutosLista.tsx`
- Create: `src/renderer/src/paginas/EditorJornal.tsx`
- Create: `src/renderer/src/paginas/HistoricoLista.tsx`
- Create: `src/renderer/src/paginas/ConfiguracoesPagina.tsx`

- [ ] **Step 1: Install shadcn sidebar + button + card components**

```bash
npx shadcn@latest add sidebar button card badge -y 2>/dev/null || true
```
If shadcn CLI fails (electron-vite detection issue), manually copy component files from shadcn/ui source, adapting to `@renderer/` alias.

- [ ] **Step 2: Create stub pages (all return placeholder UI)**

Each page: export default function with a simple `<div>` and heading.

- [ ] **Step 3: Create AppSidebar with navigation links**

Navigation items: Dashboard, Produtos, Editor, Histórico, Configurações. Use lucide-react icons: `Home`, `Package`, `Newspaper`, `Clock`, `Settings`.

- [ ] **Step 4: Update App.tsx with React Router + SidebarProvider layout**

```tsx
// src/renderer/src/App.tsx
import { HashRouter, Routes, Route } from 'react-router-dom'
import { SidebarProvider } from '@renderer/components/ui/sidebar'
import { AppSidebar } from '@renderer/componentes/AppSidebar'
import Dashboard from '@renderer/paginas/Dashboard'
import ProdutosLista from '@renderer/paginas/ProdutosLista'
import EditorJornal from '@renderer/paginas/EditorJornal'
import HistoricoLista from '@renderer/paginas/HistoricoLista'
import ProdutoDetalhe from '@renderer/paginas/ProdutoDetalhe'
import HistoricoDetalhe from '@renderer/paginas/HistoricoDetalhe'
import IaPagina from '@renderer/paginas/IaPagina'
import ConfiguracoesPagina from '@renderer/paginas/ConfiguracoesPagina'

export default function App() {
  return (
    <HashRouter>
      <SidebarProvider>
        <AppSidebar />
        <main className="flex-1 overflow-auto min-h-0">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/produtos" element={<ProdutosLista />} />
            <Route path="/produtos/:produto_id" element={<ProdutoDetalhe />} />
            <Route path="/editor" element={<EditorJornal />} />
            <Route path="/editor/:jornal_id" element={<EditorJornal />} />
            <Route path="/historico" element={<HistoricoLista />} />
            <Route path="/historico/:jornal_id" element={<HistoricoDetalhe />} />
            <Route path="/ia" element={<IaPagina />} />
            <Route path="/configuracoes" element={<ConfiguracoesPagina />} />
          </Routes>
        </main>
      </SidebarProvider>
    </HashRouter>
  )
}
```

- [ ] **Step 5: Verify app boots with sidebar navigation**

```bash
npm run dev
```
Expected: Sidebar with nav links. Clicking navigates between stub pages.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/ src/renderer/src/componentes/ src/renderer/src/paginas/
git commit -m "feat(ui): app shell with React Router + sidebar navigation"
```

---

## Chunk 2: Product Catalog

### Task 6: Product CRUD IPC Handlers

**Files:**
- Modify: `src/main/tipc.ts` — add produto handlers
- Test: `tests/produtos/crud.test.ts`

- [ ] **Step 1: Write tests for product CRUD**

Test `produtos.criar`, `produtos.listar`, `produtos.buscar`, `produtos.atualizar`, `produtos.deletar`. Use query helpers directly (not IPC) for unit testing the logic.

- [ ] **Step 2: Implement produto handlers in tipc.ts**

Handlers:
- `produtos.listar` — `SELECT * FROM produtos WHERE ativo = true ORDER BY nome`
- `produtos.buscar` — search by codigo, nome (ILIKE), or categoria
- `produtos.criar` — INSERT with codigo uniqueness check
- `produtos.atualizar` — UPDATE nome, nome_card, unidade, categoria
- `produtos.por_codigo` — exact match by codigo
- `produtos.deletar` — soft delete (set ativo = false)

- [ ] **Step 3: Run tests — expect PASS**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(produtos): CRUD IPC handlers with tests"
```

---

### Task 7: Product Image Management IPC Handlers

**Files:**
- Modify: `src/main/tipc.ts` — add imagem handlers
- Test: `tests/produtos/imagens.test.ts`

- [ ] **Step 1: Write tests for image operations**

Test adding image record, setting default, listing images for a product.

- [ ] **Step 2: Implement image handlers**

Handlers:
- `imagens.listar` — images for a produto_id
- `imagens.adicionar` — copy file to `data/images/products/{codigo}/`, INSERT record, set default if first
- `imagens.definir_default` — set is_default = true (unset others)
- `imagens.remover` — DELETE record + remove file

- [ ] **Step 3: Run tests — expect PASS**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(imagens): product image CRUD + default management"
```

---

### Task 8: Produtos UI (List + Detail)

**Files:**
- Modify: `src/renderer/src/paginas/ProdutosLista.tsx`
- Create: `src/renderer/src/paginas/ProdutoDetalhe.tsx`
- Create: `src/renderer/src/componentes/produtos/ProdutoCard.tsx`
- Create: `src/renderer/src/componentes/produtos/ImageUpload.tsx`
- Create: `src/renderer/src/servicos/produtos.ts`

- [ ] **Step 1: Create IPC client service**

```typescript
// src/renderer/src/servicos/produtos.ts
// Wrapper around tipc client calls for produtos.* and imagens.*
```

- [ ] **Step 2: Build ProdutosLista page**

Search bar + grid of ProdutoCard components. Each card shows: image thumbnail (default), nome, codigo, unidade. Click navigates to detail.

- [ ] **Step 3: Build ProdutoDetalhe page**

Product info (editable fields), image gallery, upload button, set default button. Route: `/produtos/:produto_id`.

- [ ] **Step 4: Build ImageUpload component**

File picker → copies to data dir → registers in DB → refreshes gallery.

- [ ] **Step 5: Verify flow: create product → upload image → see in list**

```bash
npm run dev
```

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(ui): product catalog — list, detail, image upload"
```

---

## Chunk 3: Import Engine

### Task 9: Spreadsheet Parser

**Files:**
- Create: `src/main/import/parser.ts`
- Test: `tests/import/parser.test.ts`

- [ ] **Step 1: Write parser tests with real sample data**

```typescript
// tests/import/parser.test.ts
import { describe, it, expect } from 'vitest'
import { parsePlanilha } from '../../src/main/import/parser'

const SAMPLE_TSV = `Produto\tDescrição\tPreço Oferta\tTipo Oferta\tclube
\t\t\t\t
\t\t\t\t
515\tCERVEJA CRYSTAL 350 ML LATA\t2,49\tACOUGUE\t2,39
5920\tCOXAO MOLE KG\t45,98\tACOUGUE\t44,98
\t\t\t\t
6536\tLARANJA PERA KG\t3,89\tHORTIFRUTI\t3,59`

describe('parsePlanilha', () => {
  it('should parse TSV with Brazilian decimal format', () => {
    const result = parsePlanilha(SAMPLE_TSV)
    expect(result.rows.length).toBe(3)
    expect(result.rows[0].codigo).toBe('515')
    expect(result.rows[0].preco_oferta).toBe(2.49)
    expect(result.rows[0].preco_clube).toBe(2.39)
    expect(result.rows[0].tipo_oferta).toBe('ACOUGUE')
  })

  it('should skip empty lines', () => {
    const result = parsePlanilha(SAMPLE_TSV)
    expect(result.rows.length).toBe(3) // not 6
  })

  it('should extract unit from description', () => {
    const result = parsePlanilha(SAMPLE_TSV)
    const coxao = result.rows.find(r => r.codigo === '5920')
    expect(coxao?.unidade_extraida).toBe('KG')
    const crystal = result.rows.find(r => r.codigo === '515')
    expect(crystal?.unidade_extraida).toBe('UN')
  })

  it('should auto-detect delimiter (CSV with semicolon)', () => {
    const csv = 'Produto;Descrição;Preço Oferta;Tipo Oferta;clube\n515;CERVEJA CRYSTAL;2,49;ACOUGUE;2,39'
    const result = parsePlanilha(csv)
    expect(result.rows[0].codigo).toBe('515')
  })

  it('should handle Latin-1 encoded text', () => {
    // Simulate Latin-1 by testing accented chars survive parsing
    const tsv = 'Produto\tDescrição\tPreço Oferta\tTipo Oferta\tclube\n515\tCERVEJA CRYSTAL 350 ML LATA\t2,49\tACOUGUE\t2,39'
    const result = parsePlanilha(tsv)
    expect(result.rows[0].descricao).toContain('CERVEJA')
  })

  it('should report invalid lines in errors', () => {
    const bad = 'Produto\tDescrição\tPreço Oferta\tTipo Oferta\tclube\n\tSEM CODIGO\t2,49\tACOUGUE\t2,39'
    const result = parsePlanilha(bad)
    expect(result.rows.length).toBe(0)
    expect(result.errors.length).toBe(1)
  })
})
```

- [ ] **Step 2: Implement parser.ts**

Handle: delimiter auto-detect, Brazilian decimal (`,` → `.`), empty line skip, unit extraction via regex, validation per row, header matching.

Return type:
```typescript
interface ParseResult {
  rows: PlanilhaRow[]
  errors: { line: number; reason: string }[]
}
```

- [ ] **Step 3: Run tests — expect PASS**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(import): spreadsheet parser — TSV/CSV, Brazilian decimals, unit extraction"
```

---

### Task 10: Product Matcher

**Files:**
- Create: `src/main/import/matcher.ts`
- Test: `tests/import/matcher.test.ts`

- [ ] **Step 1: Write matcher tests**

Test: given a PlanilhaRow, match against products in DB by codigo. Return MatchResult with status (match/fallback/nao_encontrado).

- [ ] **Step 2: Implement matcher.ts**

Logic:
1. Query `produtos` by `codigo` (exact)
2. If found, query `produto_imagens` for that produto_id
3. If exact variacao match → status: 'match'
4. If only default image → status: 'fallback', motivo: 'Imagem genérica usada'
5. If no image at all → status: 'nao_encontrado'

- [ ] **Step 3: Run tests — expect PASS**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(import): product matcher — code lookup + fallback detection"
```

---

### Task 11: Import Flow (Parser + Matcher + Journal Creation)

**Files:**
- Modify: `src/main/tipc.ts` — add import handler
- Test: `tests/import/flow.test.ts`

- [ ] **Step 1: Write integration test**

Test full flow: parse sample TSV → match against seeded products → create jornal + paginas + secoes + itens.

- [ ] **Step 2: Implement `import.planilha` handler**

1. Parse text with `parsePlanilha()`
2. Match each row with `matchProduto()`
3. Create `jornais` row (semanal, dates from input)
4. Create `jornal_paginas` (3 pages for semanal)
5. Create `jornal_secoes` (5 sections mapped from aliases)
6. Create `jornal_itens` (matched products in their sections)
7. Create `importacoes` record with stats
8. Return `ImportResult`

- [ ] **Step 3: Run tests — expect PASS**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(import): full import flow — parse + match + journal creation"
```

---

## Chunk 4: Journal Rendering

### Task 12: CardProduto Component

**Files:**
- Create: `src/renderer/src/componentes/jornal/CardProduto.tsx`

- [ ] **Step 1: Build CardProduto**

Props: `JornalItem & { produto: Produto, imagem_path: string | null, status: 'match' | 'fallback' | 'nao_encontrado' }`.

Layout (CSS):
- Image area (60-70% height): `object-fit: cover`, `transform: scale(img_scale)`, `object-position` from offsets
- Name area: uppercase, centered
- Price area: preco_oferta large + unidade small, badge "CLUBE FERNANDES" + preco_clube
- Status border: green/yellow/red based on match status
- Multi-image support: if `imgs_compostas` has entries, render flex row of 2-3 images

- [ ] **Step 2: Verify visually with hardcoded data in a test page**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(jornal): CardProduto component — image, name, prices, status"
```

---

### Task 13: Section + Page + Full Preview Components

**Files:**
- Create: `src/renderer/src/componentes/jornal/SecaoJornal.tsx`
- Create: `src/renderer/src/componentes/jornal/PaginaJornal.tsx`
- Create: `src/renderer/src/componentes/jornal/JornalPreview.tsx`
- Create: `src/renderer/src/componentes/jornal/BannerTopo.tsx`
- Create: `src/renderer/src/componentes/jornal/BarraDatas.tsx`
- Create: `src/renderer/src/componentes/jornal/RodapeLoja.tsx`

- [ ] **Step 1: Build SecaoJornal**

Props: `JornalSecao & { items: JornalItem[], template: TemplateSecao | null }`.
Layout: themed background + header image + CSS grid of CardProduto components. Add `data-export="secao-{slug}"` attribute.

- [ ] **Step 2: Build PaginaJornal**

Props: `JornalPagina & { secoes: SecaoData[] }`.
Layout: if `full` → single section full width. If `dupla` → two sections side by side (50/50). Add `data-export="pagina-{numero}"`.

- [ ] **Step 3: Build helper components**

- `BannerTopo`: renders banner image if path provided
- `BarraDatas`: "OFERTAS VÁLIDAS DE {inicio} A {fim} OU ENQUANTO DURAREM OS ESTOQUES"
- `RodapeLoja`: store info (address, phone, hours) from loja data

- [ ] **Step 4: Build JornalPreview**

Composes all pages vertically. Scrollable container. Accepts full journal data.

- [ ] **Step 5: Verify with mock data — visually compare to reference PDF**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(jornal): section, page, and full preview components"
```

---

## Chunk 5: Editor UI

### Task 14: Editor Store (Zustand)

**Files:**
- Create: `src/renderer/src/store/editorStore.ts`
- Create: `src/renderer/src/servicos/jornais.ts`

- [ ] **Step 1: Create editorStore**

State:
```typescript
interface EditorState {
  jornal: Jornal | null
  paginas: JornalPagina[]
  secoes: JornalSecao[]
  itens: JornalItem[]
  produtos_map: Record<number, Produto>
  imagens_map: Record<number, ProdutoImagem>
  selected_item_id: number | null
  alerts: Alert[]
  // actions
  loadJornal: (jornal_id: number) => Promise<void>
  selectItem: (item_id: number | null) => void
  updateItem: (item_id: number, changes: Partial<JornalItem>) => void
  // ... more actions
}
```

- [ ] **Step 2: Create jornais.ts service**

IPC client wrappers for jornal operations.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(editor): Zustand store + journal service"
```

---

### Task 15: Editor Page (Split View)

**Files:**
- Modify: `src/renderer/src/paginas/EditorJornal.tsx`
- Create: `src/renderer/src/componentes/editor/PainelImport.tsx`
- Create: `src/renderer/src/componentes/editor/PainelSecoes.tsx`
- Create: `src/renderer/src/componentes/editor/PainelItem.tsx`
- Create: `src/renderer/src/componentes/editor/PainelAlertas.tsx`

- [ ] **Step 1: Build EditorJornal as split layout**

Left panel (350px fixed) + right panel (flex-1, JornalPreview). Left panel has tabs/sections: Import, Seções (tree), Item Editor, Alertas.

- [ ] **Step 2: Build PainelImport**

File drop zone + "Importar Planilha" button. Shows import result stats after import.

- [ ] **Step 3: Build PainelSecoes**

Tree view: Páginas → Seções → Items. Click item → select in store → highlight in preview.

- [ ] **Step 4: Build PainelItem**

Form for selected item: nome, preco_oferta, preco_clube, unidade, image selector, zoom slider, offset sliders. Changes update store → preview updates live.

- [ ] **Step 5: Build PainelAlertas**

List of alerts from store: fallbacks (yellow), missing images (red). Click alert → select that item.

- [ ] **Step 6: Wire up bidirectional selection + reordering**

Click card in preview → select in panel. Click in panel → highlight in preview.

Install `@dnd-kit/core @dnd-kit/sortable` for drag-and-drop reordering in PainelSecoes item list. Drag an item in the list → swap `posicao` values → update store → preview reorders live.

Also add "Trocar Produto" button in PainelItem that opens a search modal (by nome/código), allowing full product swap on a position (not just field edits).

- [ ] **Step 7: Verify full editor flow: import → review → edit → see changes live**

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(editor): split-view editor — panel + live preview"
```

---

### Task 16: Image Picker + Composer

**Files:**
- Create: `src/renderer/src/componentes/editor/ImagePicker.tsx`
- Create: `src/renderer/src/componentes/editor/ImageComposer.tsx`

- [ ] **Step 1: Build ImagePicker modal**

Shows all images for current product. Grid of thumbnails. Click to select. Shows which is default.

- [ ] **Step 2: Build ImageComposer**

For cards with 2-3 images. Slots: [img1] [+ Add] [+ Add]. Each slot opens ImagePicker. Saves paths to `imgs_compostas` JSONB.

- [ ] **Step 3: Verify: pick image → see in preview, compose 2 images → see in preview**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(editor): image picker + multi-image composer"
```

---

## Chunk 6: Export Engine

### Task 17: Export via Electron Native APIs

**Files:**
- Create: `src/main/export/engine.ts`
- Create: `src/main/export/html-builder.ts`
- Create: `src/main/export/cuts.ts`
- Modify: `src/main/tipc.ts` — add export handlers

Start with Electron native APIs (BrowserWindow hidden + printToPDF/capturePage) as the primary approach. Puppeteer can be added later if needed.

- [ ] **Step 1: Build html-builder.ts**

Takes journal data → produces standalone HTML string with:
- Inline CSS (Tailwind compiled)
- Images as base64 data URIs
- `data-export` attributes on all sections/pages
- Fixed viewport dimensions

- [ ] **Step 2: Build engine.ts**

Strategy: one hidden BrowserWindow per export target. For individual sections/pages, render **only that piece** in a standalone HTML at exact dimensions.

```typescript
// src/main/export/engine.ts
import { BrowserWindow } from 'electron'
import { buildFullHtml, buildSectionHtml, buildPageHtml } from './html-builder'
import path from 'path'
import fs from 'fs/promises'

async function renderToImage(html: string, width: number, height: number, outputPath: string): Promise<void> {
  const win = new BrowserWindow({
    width, height,
    show: false,
    webPreferences: { offscreen: true }
  })
  const tmpFile = path.join(app.getPath('temp'), `jf-export-${Date.now()}.html`)
  await fs.writeFile(tmpFile, html, 'utf-8')
  await win.loadFile(tmpFile)
  // Wait for images to load
  await win.webContents.executeJavaScript('new Promise(r => { if (document.readyState === "complete") r(); else window.onload = r; })')
  const image = await win.webContents.capturePage()
  await fs.writeFile(outputPath, image.toPNG())
  win.destroy()
  await fs.unlink(tmpFile)
}

async function renderToPdf(html: string, outputPath: string): Promise<void> {
  const win = new BrowserWindow({ width: 1080, height: 1920, show: false })
  const tmpFile = path.join(app.getPath('temp'), `jf-export-${Date.now()}.html`)
  await fs.writeFile(tmpFile, html, 'utf-8')
  await win.loadFile(tmpFile)
  await win.webContents.executeJavaScript('new Promise(r => { if (document.readyState === "complete") r(); else window.onload = r; })')
  const pdfData = await win.webContents.printToPDF({ printBackground: true })
  await fs.writeFile(outputPath, pdfData)
  win.destroy()
  await fs.unlink(tmpFile)
}
```

Key insight: for **Story cuts**, `html-builder.ts` generates a standalone HTML containing ONLY that section at 1080×1920. For **Carrossel**, only that page at 1080×1080. This avoids the `capturePage()` limitation of only capturing the visible viewport — because the viewport IS the target.

- [ ] **Step 3: Build cuts.ts**

```typescript
// src/main/export/cuts.ts
// Orchestrates generating all export variants for a journal
export async function exportAll(jornal_id: number, outputDir: string): Promise<ExportResult> {
  const journal = await loadFullJournal(jornal_id)
  const results: string[] = []

  // PDF full: all pages in one HTML, multi-page
  const fullHtml = buildFullHtml(journal)
  await renderToPdf(fullHtml, path.join(outputDir, 'jornal-completo.pdf'))
  results.push('jornal-completo.pdf')

  // PNG per page
  for (const pagina of journal.paginas) {
    const pageHtml = buildPageHtml(journal, pagina, { width: 1080, height: 1920 })
    await renderToImage(pageHtml, 1080, 1920, path.join(outputDir, `jornal-pagina-${pagina.numero}.png`))
    results.push(`jornal-pagina-${pagina.numero}.png`)
  }

  // Story per section
  for (const secao of journal.secoes) {
    const sectionHtml = buildSectionHtml(journal, secao, { width: 1080, height: 1920 })
    await renderToImage(sectionHtml, 1080, 1920, path.join(outputDir, `story-${secao.slug}.png`))
    results.push(`story-${secao.slug}.png`)
  }

  // Carrossel per page
  for (const pagina of journal.paginas) {
    const pageHtml = buildPageHtml(journal, pagina, { width: 1080, height: 1080 })
    await renderToImage(pageHtml, 1080, 1080, path.join(outputDir, `carrossel-pagina-${pagina.numero}.png`))
    results.push(`carrossel-pagina-${pagina.numero}.png`)
  }

  return { files: results, outputDir }
}
```

- [ ] **Step 4: Add export IPC handlers**

- `export.gerar` — generate all exports for a journal
- `export.preview` — generate single format for preview

- [ ] **Step 5: Verify: export a journal → check PDF and PNGs in data/exports/**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(export): Electron native export — PDF, PNG, Story, Carrossel"
```

---

### Task 18: Export Dialog UI

**Files:**
- Create: `src/renderer/src/componentes/editor/ExportDialog.tsx`
- Create: `src/renderer/src/servicos/exportacao.ts`

- [ ] **Step 1: Build ExportDialog**

Checkboxes for each format (PDF, PNG pages, Stories, Carrossel). "Gerar Tudo" button. Progress bar during export. Results: file list with "Abrir Pasta" button.

- [ ] **Step 2: Wire to editor page**

"Exportar" button in editor header opens dialog.

- [ ] **Step 3: Verify full flow: edit journal → export → open files**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(ui): export dialog with format selection + progress"
```

---

## Chunk 7: IA System

### Task 19: IA Tools (Core 8)

**Files:**
- Create: `src/main/ia/tools.ts`
- Test: `tests/ia/tools.test.ts`

- [ ] **Step 1: Implement first 8 tools with tests**

Priority tools:
1. `buscar_produtos` — search by name/code/category
2. `ver_produto` — product detail with images
3. `cadastrar_produto` — create new product
4. `atualizar_produto` — update product fields
5. `listar_imagens` — images for a product
6. `definir_imagem_default` — set default image
7. `buscar_jornal_atual` — current draft journal
8. `status_importacao` — import stats summary

Each tool: Zod schema for input + handler function + toolOk/toolError/toolTruncated pattern.

- [ ] **Step 2: Write unit tests for each tool**

- [ ] **Step 3: Run tests — expect PASS**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(ia): core 8 tools — products, images, journal query"
```

---

### Task 20: IA Tools (Remaining 7)

**Files:**
- Modify: `src/main/ia/tools.ts`
- Test: `tests/ia/tools-extended.test.ts`

- [ ] **Step 1: Implement remaining tools**

9. `trocar_item` — swap product in a journal position
10. `atualizar_item` — update item price/club/image
11. `buscar_historico` — query past journals
12. `comparar_precos` — compare prices across editions
13. `listar_secoes` — sections of current journal
14. `adicionar_secao` — create custom section
15. `stats_banco` — catalog statistics

- [ ] **Step 2: Write tests**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(ia): remaining 7 tools — journal editing, history, stats"
```

---

### Task 21: IA Chat Integration

**Files:**
- Create: `src/main/ia/sistema-prompt.ts`
- Create: `src/main/ia/discovery.ts`
- Create: `src/main/ia/cliente.ts`
- Create: `src/main/ia/config.ts`
- Modify: `src/main/tipc.ts` — add IA handlers
- Create: `src/renderer/src/componentes/ia/IaChatPanel.tsx`
- Create: `src/renderer/src/componentes/ia/IaChatView.tsx`
- Create: `src/renderer/src/store/iaStore.ts`
- Create: `src/renderer/src/servicos/ia.ts`

- [ ] **Step 1: Build IA backend**

- `config.ts`: Gemini provider setup via Vercel AI SDK
- `sistema-prompt.ts`: system prompt describing JornalFlow assistant role
- `discovery.ts`: auto-context injection (current journal, alerts, stats)
- `cliente.ts`: orchestrator (multi-turn, tool loop, max 10 steps)

- [ ] **Step 2: Add IPC handlers**

- `ia.chat` — send message, return response (with tool calls)
- `ia.config` — get/set API key

- [ ] **Step 3: Build chat UI**

- `iaStore.ts`: messages, open/close state
- `IaChatPanel.tsx`: slide-out panel (same as EscalaFlow)
- `IaChatView.tsx`: message list + input

- [ ] **Step 4: Wire chat panel to App.tsx layout**

Add chat panel alongside main content. Toggle button in header.

- [ ] **Step 5: Verify: open chat → ask "quantos produtos tem?" → get response**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(ia): chat system — 15 tools + slide-out panel + Gemini"
```

---

## Chunk 8: History + Dashboard + Polish

### Task 22: Journal History

**Files:**
- Modify: `src/renderer/src/paginas/HistoricoLista.tsx`
- Create: `src/renderer/src/paginas/HistoricoDetalhe.tsx`
- Modify: `src/main/tipc.ts` — add history handlers

- [ ] **Step 1: Add history IPC handlers**

- `historico.listar` — all journals ordered by date desc
- `historico.detalhe` — full journal with all items
- `historico.buscar_produto` — find product across journals

- [ ] **Step 2: Build HistoricoLista**

List of past journals: title, dates, status, product count. Click → detail.

- [ ] **Step 3: Build HistoricoDetalhe**

Read-only JornalPreview + metadata (import stats, export dates).

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(historico): journal history list + detail view"
```

---

### Task 23: Dashboard

**Files:**
- Modify: `src/renderer/src/paginas/Dashboard.tsx`

- [ ] **Step 1: Build Dashboard with quick stats + actions**

Cards:
- Current journal (if draft exists): title, status, progress, "Continuar Editando" button
- Last exported: title, date
- Catalog stats: total products, products with images, coverage %
- Quick actions: "Novo Jornal Semanal", "Novo Jornal Especial", "Ver Produtos"

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(ui): dashboard with stats and quick actions"
```

---

### Task 24: Batch Image Import

**Files:**
- Create: `src/main/import/batch-images.ts`
- Create: `src/renderer/src/componentes/produtos/BatchImport.tsx`
- Test: `tests/import/batch-images.test.ts`

- [ ] **Step 1: Implement batch-images.ts**

Read directory recursively. Match filenames to product codes (patterns from spec). Copy matched files to `data/images/products/{code}/`. Register in DB. Return report.

- [ ] **Step 2: Write tests**

- [ ] **Step 3: Build BatchImport UI**

Folder picker → progress → results report (matched, unmatched with manual association).

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(import): batch image import from folder"
```

---

### Task 25: Special Journal Mode

**Files:**
- Create: `src/renderer/src/componentes/editor/PoolProdutos.tsx`
- Modify: `src/renderer/src/paginas/EditorJornal.tsx`
- Modify: `src/main/tipc.ts`

- [ ] **Step 1: Add IPC handlers for special journal creation**

- `jornal.criar_especial` — create journal with tipo='especial', no auto-layout
- `jornal.adicionar_pagina` — add page to journal
- `jornal.adicionar_secao` — add section to page

- [ ] **Step 2: Build PoolProdutos component**

Shows imported products not yet assigned to sections. Drag or click to assign.

- [ ] **Step 3: Update EditorJornal to support both modes**

If tipo='especial': show PoolProdutos panel, allow adding pages/sections. If tipo='semanal': current flow (auto-layout).

- [ ] **Step 4: Verify: create special journal → add pages → assign products → export**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(editor): special journal mode — free layout + product pool"
```

---

### Task 26: Configurações Page

**Files:**
- Modify: `src/renderer/src/paginas/ConfiguracoesPagina.tsx`

- [ ] **Step 1: Build settings page**

Sections:
- **Loja**: edit nome, endereco, telefone, horario (persisted in DB)
- **IA**: API key input (Gemini), test connection button
- **Templates**: view/manage template sections (read-only for V1)
- **Dados**: DB stats, "Exportar Backup" button (future), data dir path

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(ui): settings page — store info, API key, data management"
```

---

### Task 27: Final Integration + Typecheck

- [ ] **Step 1: Run full typecheck**

```bash
npm run typecheck
```
Fix any type errors.

- [ ] **Step 2: Run all tests**

```bash
npm run test
```
Fix any failures.

- [ ] **Step 3: Test full flow manually**

1. Boot app → Dashboard shows
2. Go to Produtos → create product → upload image
3. Go to Editor → import sample TSV → see preview render
4. Edit item (change price, swap image, zoom)
5. Export PDF + Stories
6. Check Histórico → see exported journal
7. Open IA → ask about products
8. Create special journal → manual layout

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: final integration — typecheck clean, tests passing"
```

- [ ] **Step 5: Push to GitHub**

```bash
git push origin main
```
