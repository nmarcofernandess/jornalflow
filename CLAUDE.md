# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JornalFlow is a desktop Electron app that generates weekly promotional newspapers for Supermercado Fernandes. It accepts spreadsheets with ~45 products, matches them against a local image database, provides a WYSIWYG editor, and exports to PDF/PNG/Instagram Story/Carousel formats.

## Commands

```bash
npm run dev              # Dev server with HMR
npm run build            # Typecheck + build
npm test                 # Run all tests (vitest, single run)
npm run test:watch       # Watch mode
npx vitest run tests/import/parser.test.ts   # Single test file
npx vitest run -t "nome do teste"            # Single test by name
npm run typecheck        # TypeScript check (main + renderer)
npm run lint             # ESLint
npm run format           # Prettier
```

## Architecture

```
Renderer (React 19 + Zustand + Tailwind + shadcn/ui)
    ↕ tipc (type-safe IPC)
Main Process (Node.js + Electron)
    ↕ raw SQL
PGlite (PostgreSQL WASM, embedded)
    + Gemini AI (Vercel AI SDK v6)
```

### IPC Layer

`@egoist/tipc` provides type-safe RPC between processes:
- **Router**: `src/main/tipc.ts` — 40+ handlers with pattern `t.procedure.input<Type>().action()`
- **Client**: `src/renderer/src/servicos/client.ts` — typed client created from router
- **Service wrappers**: `src/renderer/src/servicos/*.ts` — thin IPC call wrappers, no business logic

### Database

PGlite (PostgreSQL compiled to WASM). No ORM — raw SQL via helpers in `src/main/db/query.ts`:
- `queryAll<T>(sql, params)`, `queryOne<T>(sql, params)`, `execute(sql, params)`, `transaction(fn)`
- Schema with versioned migrations in `src/main/db/schema.ts`
- 10 tables: `lojas`, `produtos`, `produto_imagens`, `template_secoes`, `secao_aliases`, `jornais`, `jornal_paginas`, `jornal_secoes`, `jornal_itens`, `importacoes`
- Data dir: `~/Library/Application Support/jornalflow/data/` (prod) or `./data/` (dev)

### Main Process Layers

| Layer | Path | Role |
|-------|------|------|
| IPC Router | `src/main/tipc.ts` | Entry point, routes to services |
| Services | `src/main/servicos/` | Business logic (produtos, imagens, jornais) |
| Import | `src/main/import/` | Spreadsheet pipeline: parse → match → create journal |
| Export | `src/main/export/` | HTML generation → PDF/PNG rendering |
| IA | `src/main/ia/` | Gemini chat with 15 tools (Zod schemas) |
| DB | `src/main/db/` | PGlite singleton, schema, query helpers, seed |

### Renderer Layers

| Layer | Path | Role |
|-------|------|------|
| Pages | `src/renderer/src/paginas/` | 8 route pages |
| Components | `src/renderer/src/componentes/` | editor/, jornal/, produtos/ |
| UI Primitives | `src/renderer/src/components/` | shadcn/ui (auto-generated) |
| Stores | `src/renderer/src/store/` | Zustand (editorStore, iaStore) |
| Services | `src/renderer/src/servicos/` | IPC client wrappers |

### Path Aliases

```
@renderer → src/renderer/src
@shared   → src/shared
```

### Shared Types

All domain types live in `src/shared/types.ts`. Both processes import from `@shared/types`.

## Key Patterns

- **All text in Portuguese** (BR) — variable names, DB columns, UI labels, comments
- **Services are pure async functions**, not classes
- **No ORM** — raw parameterized SQL everywhere (`$1, $2` style)
- **Renderer services** are thin IPC wrappers — business logic stays in main process
- **Zustand stores** hold editor/IA state; components read via `useEditorStore()`
- **Tests use real PGlite** — no mocks for database. Each test suite gets a fresh DB instance

## Testing

Vitest with node environment, 30s timeout. Tests organized by domain under `tests/`. All 71+ tests passing. Tests import directly from `src/main/` (not through IPC).
