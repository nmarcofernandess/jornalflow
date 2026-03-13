# Progress — Vision Product Namer

---

## Phase: Discovery
**Status:** Complete
**Completed At:** 2026-03-13T02:45:00Z

### Findings Summary
- Files identified: 14 (7 to create, 7 to modify)
- Patterns found: InstaFlow vision.ts port (generateText + base64 + JSON parse/clean), buildModelFactory reuse, 3-status toolResult, broadcastToRenderer for progress, sequential batch with per-item try/catch
- Recommended approach: Port InstaFlow vision.ts with supermarket prompt into src/main/ia/vision.ts, create batch-vision.ts with progress events, add 3 IPC handlers, add IA tool, create VisionRevisaoPagina.tsx with grid + batch accept. No DB schema changes needed.
- Risks identified: 6 (OpenRouter vision guard, memory on large images, rate limiting, JSON parse failure, IPC progress side-channel, missing batch-products-with-images query)

---

## Phase: Plan
**Status:** Complete
**Completed At:** 2026-03-13T03:00:00Z

### Plan Summary
- Feature: Vision Product Namer
- Workflow: feature
- Phases: 8
- Subtasks: 8
- Complexity: medium

### Phases Overview
1. Tipos Compartilhados — 1 subtask (AnaliseVisionProduto + VisionProgressEvent em shared/types.ts)
2. Core Vision Analysis — 1 subtask (src/main/ia/vision.ts com analisarProdutoImagem)
3. Batch Vision Processor — 1 subtask (src/main/ia/batch-vision.ts com progress events)
4. IPC Handlers — 1 subtask (3 handlers: vision.analisar, vision.batch, vision.listar_com_imagem)
5. IA Tool — Chat Integration — 1 subtask (analisar_imagem_produto no iaTools)
6. Frontend Service Wrapper — 1 subtask (src/renderer/src/servicos/vision.ts)
7. Frontend — Tela de Revisao Vision — 1 subtask (VisionRevisaoPagina.tsx com grid + batch accept)
8. Router e Navegacao — 1 subtask (App.tsx route + AppSidebar nav item)

### Architecture Decisions
- Use buildModelFactory(config) from config.ts — never import provider SDKs directly
- Use broadcastToRenderer('vision:progress', data) for batch progress (same side-channel as ia:stream)
- Sequential batch with 200ms delay between calls to avoid rate limits
- Read images inside the loop (not pre-loaded) to avoid memory bloat
- Clean JSON response with regex before parsing (InstaFlow pattern)
- No DB schema changes — all fields already exist on produtos table

---

## Subtask: subtask-1-1
**Phase:** phase-1-types
**Status:** Complete
**Completed At:** 2026-03-13T03:30:00Z

### Implementation
- Files modified: src/shared/types.ts
- Files created: (none)

### Changes
Added new section `// === VISION AI ===` at the end of the file with three interfaces:
- `AnaliseVisionProduto` — output estruturado da analise de imagem por Vision AI
- `VisionProgressEvent` — evento de progresso emitido durante batch processing
- `VisionBatchSummary` — retorno final do batch com totais e array de resultados individuais

### Verification
- Type: typecheck
- Command: npx tsc --noEmit
- Result: PASS
- Output: No errors

### Self-Critique
- Pattern adherence: true (secao com comentario `// === X ===`, sem virgulas finais, campos comentados inline onde util)
- Error handling: true (nao aplicavel para interfaces de tipos)
- Code cleanliness: true (sem debug, sem hardcoded values)

---

## Subtask: subtask-2-1
**Phase:** phase-2-core
**Status:** Complete
**Completed At:** 2026-03-13T03:45:00Z

### Implementation
- Files modified: (none)
- Files created: src/main/ia/vision.ts

### Changes
Created `src/main/ia/vision.ts` com:
- `VISION_PROMPT` — prompt exportado especifico para dominio supermercado: instrui a IA a ler rotulo/embalagem, identificar marca/nome/peso, gerar nome_sugerido padrao supermercado em MAIUSCULAS (ex: "CERVEJA CRYSTAL LATA 350ML"), nome_card curto (ex: "CRYSTAL 350ML"), categoria e confianca 0-100
- `analisarProdutoImagem(filePath, createModel, modelo)` — le arquivo com readFile, faz base64 encode, detecta mimeType (.png / .webp / fallback jpeg), chama generateText() com messages=[{role:'user', content:[{type:'image'}, {type:'text'}]}] maxTokens:1000, limpa resposta com replace regex, JSON.parse com typeof validation em cada campo, fallback a objeto vazio com confianca:0 em caso de erro

### Verification
- Type: typecheck
- Command: npx tsc --noEmit
- Result: PASS
- Output: No errors

### Self-Critique
- Pattern adherence: true (porte fiel do InstaFlow vision.ts: readFile → base64 → generateText → regex clean → JSON.parse → typeof validates)
- Error handling: true (try/catch no JSON.parse retorna objeto parcial com confianca:0, sem throw)
- Code cleanliness: true (sem console.log, sem hardcoded values, sem providers importados diretamente)

---

## Subtask: subtask-3-1
**Phase:** phase-3-batch
**Status:** Complete
**Completed At:** 2026-03-13T04:10:00Z

### Implementation
- Files modified: (none)
- Files created: src/main/ia/batch-vision.ts

### Changes
Created `src/main/ia/batch-vision.ts` com:
- `analisarBatch(options)` — aceita `produto_ids?`, `limite?` (default 30), `createModel` e `modelo`
- Se `produto_ids` fornecido: SQL com `IN ($1, $2, ...)` parametrizado (compativel com PGlite, sem `ANY($1)`)
- Se sem `produto_ids`: busca todos produtos com imagem default ordenado por nome, limitado por `limite`
- Loop sequencial `for-of` com try/catch por item: chama `analisarProdutoImagem()`, emite `broadcastToRenderer('vision:progress', ...)` em cada passo (sucesso e erro)
- Delay de 200ms entre chamadas (pulado na ultima iteracao)
- `path.isAbsolute()` para resolver caminho: se relativo, prefixa `getDataDir() + '/imagens/'`
- Acumula `VisionBatchSummary` com `total`, `sucesso`, `falhas` e array `resultados`

### Verification
- Type: typecheck
- Command: npx tsc --noEmit
- Result: PASS
- Output: No errors (clean exit)

### Self-Critique
- Pattern adherence: true (mesmo estilo de batch-images.ts: for-of, try/catch por item, acumula resultados)
- Error handling: true (catch por item nao interrumpe o loop, emite evento com erro, incrementa falhas)
- Code cleanliness: true (sem console.log, sem hardcoded values, delay otimizado pulando ultima iteracao)

---

## Subtask: subtask-5-1
**Phase:** phase-5-tool
**Status:** Complete
**Completed At:** 2026-03-13T05:00:00Z

### Implementation
- Files modified: src/main/ia/tools.ts
- Files created: (none)

### Changes
Added new tool `analisar_imagem_produto` at the end of the `iaTools` object in `src/main/ia/tools.ts`:
- Added 4 imports at top: `path from 'node:path'`, `buildModelFactory from './config'`, `analisarProdutoImagem from './vision'`, `getDataDir from '../db/database'`
- Added `IaConfiguracao` to existing `import type` line from `../../shared/types`
- Added trailing comma to previous last tool (`exportar_relatorio`) before the new one
- Tool uses `inputSchema` (matching existing pattern, not `parameters` as in spec)
- Execute: queryOne ProdutoImagem -> resolve absolute path -> queryOne configuracao_ia -> buildModelFactory -> analisarProdutoImagem -> toolResult
- 3-status: `'vazio'` for missing image, `'erro'` for missing config or API key, `'ok'` for successful analysis

### Verification
- Type: typecheck
- Command: npx tsc --noEmit
- Result: PASS
- Output: Clean exit, no errors

### Self-Critique
- Pattern adherence: true (inputSchema instead of parameters, same execute structure as all other tools)
- Error handling: true (all 3 error cases handled with appropriate status codes)
- Code cleanliness: true (no debug logs, no hardcoded values, consistent with codebase style)

---

## Subtask: subtask-6-1
**Phase:** phase-6-frontend-service
**Status:** Complete
**Completed At:** 2026-03-13T06:00:00Z

### Implementation
- Files modified: (none)
- Files created: src/renderer/src/servicos/vision.ts

### Verification
- Type: typecheck
- Command: npx tsc --noEmit
- Result: PASS
- Output: Clean exit, no errors

### Self-Critique
- Pattern adherence: true (exact mirror of produtos.ts: import client + import types + export async functions with no logic)
- Error handling: true (thin wrapper delegates error handling to IPC layer)
- Code cleanliness: true (no debug logs, no hardcoded values, section comment consistent with style)

---

## Subtask: subtask-4-1
**Phase:** phase-4-ipc
**Status:** Complete
**Completed At:** 2026-03-13T05:30:00Z

### Implementation
- Files modified: src/main/tipc.ts
- Files created: (none)

### Changes
Added 3 IPC handlers in a new `// -- Vision AI` section at the end of the router object (before closing `}`), after `ia.graph.explore`:
- `vision.analisar` — input `{imagem_id}`, fetches ProdutoImagem from DB, resolves absolute path with getDataDir(), loads IA config, calls buildModelFactory, calls analisarProdutoImagem(). Returns `{ok, resultado}` or `{ok: false, erro}`.
- `vision.batch` — input `{produto_ids?, limite?}`, loads IA config, calls analisarBatch() with createModel and modelo. Returns `{ok, resultado}` or `{ok: false, erro}`.
- `vision.listar_com_imagem` — input void, SQL JOIN produtos + produto_imagens (is_default=true), returns array of produto+imagem info for the review page.
- Added trailing comma to `ia.graph.explore` to accommodate the new handlers.

### Verification
- Type: typecheck
- Command: npx tsc --noEmit
- Result: PASS
- Output: Clean exit, no errors

### Self-Critique
- Pattern adherence: true (all handlers use dynamic import(), section header matches existing style, inline type imports with import('../shared/types').TypeName)
- Error handling: true (try/catch on vision.analisar and vision.batch with graceful {ok: false, erro} return — never crash)
- Code cleanliness: true (no debug logs, no hardcoded values, vision.listar_com_imagem has no trailing comma as last handler)

---

## Subtask: subtask-7-1
**Phase:** phase-7-frontend-page
**Status:** Complete
**Completed At:** 2026-03-13T06:15:00Z

### Implementation
- Files modified: (none)
- Files created: src/renderer/src/paginas/VisionRevisaoPagina.tsx

### Changes
Created `src/renderer/src/paginas/VisionRevisaoPagina.tsx` com:
- `BadgeConfianca` sub-component — verde (>80), amarelo (>50), vermelho (<50)
- `CardProduto` sub-component — thumbnail via imageUrl() + useDataDir(), nome atual, sugestao IA com confianca badge, 3 botoes (Aceitar/Editar/Rejeitar), inputs inline para edicao
- State: `produtos`, `resultados: Map<number, AnaliseVisionProduto>`, `progresso {running, current, total}`, `editando: Map<number, {nome, nome_card}>`, `rejeitados: Set<number>`
- IPC listener: `window.electron.ipcRenderer.on('vision:progress', handler)` com cleanup no return do useEffect
- Progress bar visivel durante batch com porcentagem calculada
- Grid `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`
- Botao "Aceitar todos > 80%" so aparece quando `totalAcima80 > 0`, mostra contagem inline
- Optimistic update: apos aceitar/salvar, atualiza lista local sem reload
- Loading skeletons com `animate-pulse` matching padrao ProdutosLista

### Verification
- Type: typecheck
- Command: npx tsc --noEmit
- Result: PASS
- Output: Clean exit, no errors

### Self-Critique
- Pattern adherence: true (useDataDir + imageUrl de GaleriaImagens, skeleton de ProdutosLista, layout de paginas existentes)
- Error handling: true (try/catch em todas operacoes async com console.error, IPC listener com cleanup)
- Code cleanliness: true (sem console.log de debug, sem hardcoded values, export default)

---

## Subtask: subtask-8-1
**Phase:** phase-8-wiring
**Status:** Complete
**Completed At:** 2026-03-13T06:30:00Z

### Implementation
- Files modified: src/renderer/src/App.tsx, src/renderer/src/componentes/AppSidebar.tsx
- Files created: (none)

### Changes
- `App.tsx`: added `import VisionRevisaoPagina from '@renderer/paginas/VisionRevisaoPagina'` after ConfiguracoesPagina import; added `<Route path="/vision" element={<VisionRevisaoPagina />} />` between /ia and /configuracoes routes
- `AppSidebar.tsx`: added `ScanEye` to existing lucide-react import; added `{ to: '/vision', label: 'Vision AI', icon: ScanEye }` nav item after Assistente IA

### Verification
- Type: typecheck
- Command: npx tsc --noEmit
- Result: PASS
- Output: Clean exit, no errors

### Self-Critique
- Pattern adherence: true (import style matches all existing page imports; route placement matches existing pattern; ScanEye added to existing import line)
- Error handling: true (not applicable — routing/nav wiring only)
- Code cleanliness: true (no debug code, no hardcoded values, no commented-out code)

---

## Phase: QA Review
**Status:** Complete
**Completed At:** 2026-03-13T07:00:00Z
**Verdict:** NEEDS_FIXES
**Iteration:** 1

### Test Results
- Unit: PASS (193/193)
- Typecheck: PASS (zero errors)
- Integration: SKIPPED

### Code Review
- Security: PASS
- Patterns: FAIL (path resolution bug in batch-vision.ts)
- Quality: PASS

### Issues Found
- Critical: 1
- Major: 0
- Minor: 0

### Issues Detail
1. [CRITICAL] src/main/ia/batch-vision.ts:79 — Wrong path join adds spurious 'imagens/' prefix. Correct: path.join(getDataDir(), item.arquivo_path). DB stores paths as 'images/products/{codigo}/{filename}'.

### Suggestions
- VisionRevisaoPagina.tsx:347 — totalAcima80 counter doesn't exclude rejected items (minor UX cosmetic)
- batch-vision.ts:44 — Consider logging a warning when OpenRouter model doesn't support vision

---

## Phase: Fix (Iteration 1)
**Status:** Complete
**Completed At:** 2026-03-13T08:00:00Z

### Issues Fixed
1. [CRITICAL] src/main/ia/batch-vision.ts:79 — Removed spurious 'imagens/' segment. Changed `path.join(getDataDir(), 'imagens', item.arquivo_path)` to `path.join(getDataDir(), item.arquivo_path)`. DB stores paths as 'images/products/{codigo}/{filename}'; the old join produced a double-prefixed path that never existed on disk, causing every batch item to throw ENOENT and be counted as a failure.

### Issues Remaining
(none)

### Test Results After Fix
- Typecheck: PASS (npx tsc --noEmit, clean exit)

### Ready for QA
- Yes

---
