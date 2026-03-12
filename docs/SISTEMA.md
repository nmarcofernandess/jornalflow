# JornalFlow — Documentacao do Sistema

> **Gerado em:** 2026-03-12
> **Status:** V1 scaffold completo. Backend funcional, frontend parcialmente integrado.
> **Spec original:** `docs/specs/DESIGN.md`
> **Plano de implementacao:** `docs/superpowers/plans/2026-03-11-jornalflow-v1.md`

---

## O Que E o JornalFlow

App desktop (Electron) que automatiza a criacao de jornais de ofertas semanais para o Supermercado Fernandes. A esposa do Marco recebe uma planilha com ~45 produtos, o app faz match com banco de imagens local, renderiza preview HTML, permite edicao visual, e exporta em multiplos formatos (PDF, PNG, Instagram Story, Carrossel).

---

## Stack

| Layer | Tecnologia | Versao |
|-------|-----------|--------|
| Shell | Electron | 39 |
| Build | electron-vite | 5 |
| IPC | @egoist/tipc | type-safe |
| Frontend | React + React Router | 19 |
| UI | shadcn/ui + Tailwind CSS | 4 |
| State | Zustand | 5 |
| Database | PGlite (Postgres WASM) | embedded |
| IA | Vercel AI SDK v6 + @ai-sdk/google | Gemini |
| Export | Electron Native APIs | BrowserWindow |

---

## Arquitetura

```
┌──────────────────────────────────────────────┐
│  Renderer (React 19)                          │
│  ┌────────┐ ┌────────┐ ┌────────┐            │
│  │ Paginas│ │ Stores │ │Servicos│            │
│  │  .tsx  │ │Zustand │ │ .ts    │            │
│  └────┬───┘ └────────┘ └───┬────┘            │
│       │                     │                 │
│       └──── tipc client ────┘                 │
│              (IPC invoke)                     │
├──────────────────────────────────────────────┤
│  Main Process (Node.js)                       │
│  ┌──────┐ ┌────────┐ ┌──────┐ ┌──────┐      │
│  │tipc  │ │servicos│ │import│ │export│      │
│  │router│→│  .ts   │ │  .ts │ │  .ts │      │
│  └──────┘ └───┬────┘ └──────┘ └──────┘      │
│               │                               │
│         ┌─────┴─────┐                         │
│         │  PGlite   │                         │
│         │  (WASM)   │                         │
│         └───────────┘                         │
├──────────────────────────────────────────────┤
│  IA System                                    │
│  Vercel AI SDK v6 + 15 tools + Gemini        │
└──────────────────────────────────────────────┘
```

---

## Mapa de Arquivos

### Main Process (`src/main/`)

| Arquivo | Funcao | Status |
|---------|--------|--------|
| `index.ts` | Entry point Electron, cria BrowserWindow | Funcional |
| `tipc.ts` | Router IPC central — 28 handlers | Funcional |
| `db/database.ts` | PGlite singleton, getDataDir, ensureDataDirs | Funcional |
| `db/query.ts` | queryAll, queryOne, execute, transaction | Funcional |
| `db/schema.ts` | 10 tabelas, migration system (versioned) | Funcional |
| `db/seed.ts` | Loja Sup Fernandes, 5 template_secoes, aliases | Funcional |
| `servicos/produtos.ts` | CRUD de produtos (6 funcoes) | Funcional |
| `servicos/imagens.ts` | CRUD de imagens (4 funcoes) | Funcional |
| `servicos/jornais.ts` | Journals, dashboard, history, loja (14 funcoes) | Funcional |
| `import/parser.ts` | Parse planilha TSV/CSV, decimais BR, extrai unidade | Funcional |
| `import/matcher.ts` | Match produto por codigo, detecta fallback | Funcional |
| `import/flow.ts` | Orquestra: parse + match + cria journal + itens | Funcional |
| `import/batch-images.ts` | Scan recursivo de pasta, match filename→codigo | Funcional |
| `export/engine.ts` | BrowserWindow hidden, renderToImage, renderToPdf | Funcional (nao testado E2E) |
| `export/html-builder.ts` | Gera HTML standalone com inline CSS | Funcional (nao testado E2E) |
| `export/cuts.ts` | Orquestra export: PDF + PNG + Story + Carrossel | Funcional (nao testado E2E) |
| `ia/tools.ts` | 15 AI tools com Zod inputSchema | Funcional (unit tested) |
| `ia/cliente.ts` | Chat orchestrator, generateText + stopWhen | Funcional (precisa API key) |
| `ia/config.ts` | Get/set Gemini API key (in-memory + safeStorage) | Funcional |
| `ia/sistema-prompt.ts` | System prompt em portugues para contexto supermercado | Funcional |

### Renderer (`src/renderer/src/`)

| Arquivo | Funcao | Status |
|---------|--------|--------|
| `App.tsx` | HashRouter, 9 rotas, layout com sidebar | Funcional |
| **Paginas** | | |
| `paginas/Dashboard.tsx` | Stats, rascunho atual, acoes rapidas | Funcional (UI) |
| `paginas/ProdutosLista.tsx` | Grid de produtos, busca, dialog novo produto | Funcional (UI) |
| `paginas/ProdutoDetalhe.tsx` | Edicao produto, upload imagem, gallery | Funcional (UI) |
| `paginas/EditorJornal.tsx` | Split-view editor: painel + preview | Parcial* |
| `paginas/HistoricoLista.tsx` | Lista jornais com badges de status | Funcional (UI) |
| `paginas/HistoricoDetalhe.tsx` | Preview read-only de jornal passado | Funcional (UI) |
| `paginas/IaPagina.tsx` | Chat IA full page | Funcional (precisa API key) |
| `paginas/ConfiguracoesPagina.tsx` | Loja, API key, DB stats | Funcional (UI) |
| **Componentes Jornal** | | |
| `componentes/jornal/JornalPreview.tsx` | Organiza paginas/secoes/itens em preview | Funcional |
| `componentes/jornal/PaginaJornal.tsx` | Renderiza 1 pagina com layout full/dupla | Funcional |
| `componentes/jornal/SecaoJornal.tsx` | Renderiza 1 secao com grid de cards | Funcional |
| `componentes/jornal/CardProduto.tsx` | Card de produto: imagem, nome, precos | Funcional |
| `componentes/jornal/BannerTopo.tsx` | Banner promocional topo | Funcional (placeholder) |
| `componentes/jornal/BarraDatas.tsx` | Barra "Ofertas validas de X a Y" | Funcional |
| `componentes/jornal/RodapeLoja.tsx` | Info da loja no rodape | Funcional |
| **Componentes Editor** | | |
| `componentes/editor/PainelImport.tsx` | Drop zone + datas + botao importar | Funcional |
| `componentes/editor/PainelSecoes.tsx` | Tree view de paginas→secoes→itens | Funcional |
| `componentes/editor/PainelItem.tsx` | Editor de item: precos, imagem, zoom, offset | Funcional |
| `componentes/editor/PainelAlertas.tsx` | Lista alertas (fallback, missing) | Funcional |
| `componentes/editor/ImagePicker.tsx` | Modal p/ trocar imagem do item | Funcional |
| `componentes/editor/ImageComposer.tsx` | Multi-imagem (2-3 compostas) | Funcional |
| `componentes/editor/ExportDialog.tsx` | Selecao formato + progresso export | Funcional |
| `componentes/editor/PoolProdutos.tsx` | Busca produtos p/ modo especial | Funcional |
| **Componentes Produtos** | | |
| `componentes/produtos/ProdutoCard.tsx` | Card na grid de produtos | Funcional |
| `componentes/produtos/NovoProdutoDialog.tsx` | Dialog criar produto | Funcional |
| `componentes/produtos/ImageUpload.tsx` | Input file para upload de imagem | Funcional |
| `componentes/produtos/BatchImport.tsx` | Importar pasta de imagens em lote | Funcional |
| **IA** | | |
| `componentes/ia/IaChatPanel.tsx` | Slide-out chat no editor | Funcional |
| **Stores** | | |
| `store/editorStore.ts` | Zustand: jornal, paginas, secoes, itens, maps, alerts | Funcional |
| `store/iaStore.ts` | Zustand: messages, open, loading | Funcional |
| **Servicos (IPC wrappers)** | | |
| `servicos/client.ts` | tipc createClient | Funcional |
| `servicos/produtos.ts` | Wrappers: listar, buscar, criar, atualizar, deletar, imagens | Funcional |
| `servicos/jornais.ts` | Wrappers: carregar, atualizar, import, historico, dashboard | Funcional |
| `servicos/exportacao.ts` | Wrapper: exportar jornal | Funcional |
| `servicos/ia.ts` | Wrapper: enviar mensagem IA | Funcional |

### Testes (`tests/`)

| Arquivo | Testes | Status |
|---------|--------|--------|
| `tests/db/query.test.ts` | 4 | Passando |
| `tests/db/schema.test.ts` | 2 | Passando |
| `tests/db/seed.test.ts` | 2 | Passando |
| `tests/produtos/crud.test.ts` | 12 | Passando |
| `tests/produtos/imagens.test.ts` | 5 | Passando |
| `tests/import/parser.test.ts` | 8 | Passando |
| `tests/import/matcher.test.ts` | 4 | Passando |
| `tests/import/flow.test.ts` | 4 | Passando |
| `tests/import/batch-images.test.ts` | 4 | Passando |
| `tests/ia/tools.test.ts` | 11 | Passando |
| `tests/ia/tools-extended.test.ts` | 15 | Passando |
| **Total** | **71** | **Todos passando** |

---

## IPC Routes (28 handlers)

| Route | Input | Descricao |
|-------|-------|-----------|
| `app.health` | — | Health check |
| `dashboard.stats` | — | Stats: produtos, imagens, jornais, rascunho, ultimo exportado |
| `produtos.listar` | — | Lista todos os produtos |
| `produtos.buscar` | `{ termo }` | Busca por nome/codigo |
| `produtos.criar` | `{ codigo, nome, unidade, ... }` | Cria produto |
| `produtos.atualizar` | `{ produto_id, nome?, ... }` | Atualiza produto |
| `produtos.por_codigo` | `{ codigo }` | Busca por codigo exato |
| `produtos.deletar` | `{ produto_id }` | Deleta produto |
| `imagens.listar` | `{ produto_id }` | Lista imagens do produto |
| `imagens.adicionar` | `{ produto_id, source_path, variacao? }` | Adiciona imagem |
| `imagens.definir_default` | `{ imagem_id }` | Seta imagem como default |
| `imagens.remover` | `{ imagem_id }` | Remove imagem |
| `import.planilha` | `{ text, data_inicio, data_fim, arquivo_nome }` | Importa planilha |
| `import.batch_imagens` | `{ dir_path }` | Importa pasta de imagens em lote |
| `jornal.carregar` | `{ jornal_id }` | Carrega journal completo com todos os dados |
| `jornal.atualizar_item` | `{ item_id, changes }` | Atualiza item do jornal |
| `jornal.listar_rascunhos` | — | Lista jornais em rascunho |
| `jornal.criar_especial` | `{ titulo, data_inicio, data_fim }` | Cria journal modo especial |
| `jornal.adicionar_pagina` | `{ jornal_id, layout? }` | Adiciona pagina |
| `jornal.adicionar_secao` | `{ jornal_id, pagina_id, nome_custom, ... }` | Adiciona secao |
| `jornal.adicionar_item` | `{ jornal_id, jornal_secao_id, produto_id, preco_oferta, ... }` | Adiciona item a secao |
| `historico.listar` | — | Lista todos os jornais |
| `historico.detalhe` | `{ jornal_id }` | Detalhe completo de journal |
| `historico.buscar_produto` | `{ produto_id }` | Historico de precos do produto |
| `export.gerar` | `{ jornal_id }` | Exporta journal (PDF + PNG + Story + Carrossel) |
| `shell.abrir_pasta` | `{ caminho }` | Abre pasta no Finder |
| `config.get_loja` | — | Dados da loja |
| `config.atualizar_loja` | `{ changes }` | Atualiza dados da loja |
| `config.db_stats` | — | Contadores do DB |
| `ia.chat` | `{ messages }` | Envia mensagem para IA |
| `ia.set_api_key` | `{ key }` | Salva API key Gemini |
| `ia.get_api_key` | — | Recupera API key |

---

## IA System — 15 Tools

| # | Tool | O Que Faz |
|---|------|-----------|
| 1 | buscar_produtos | Busca catalogo por nome, codigo, categoria |
| 2 | ver_produto | Detalhe de 1 produto com imagens |
| 3 | cadastrar_produto | Cria produto novo |
| 4 | atualizar_produto | Edita produto |
| 5 | listar_imagens | Imagens de um produto |
| 6 | definir_imagem_default | Seta default de imagem |
| 7 | buscar_jornal_atual | Journal em edicao |
| 8 | status_importacao | Stats da ultima importacao |
| 9 | trocar_item | Troca produto numa posicao |
| 10 | atualizar_item | Edita preco/imagem de item |
| 11 | buscar_historico | Jornais anteriores |
| 12 | comparar_precos | Compara precos entre edicoes |
| 13 | listar_secoes | Secoes do jornal atual |
| 14 | adicionar_secao | Cria secao (modo especial) |
| 15 | stats_banco | Estatisticas do catalogo |

**Dependencia:** Requer API key do Google Gemini. Configurar em: Configuracoes → IA → API Key.

---

## Limitacoes Tecnicas Conhecidas

### PGlite
- `db.query()` NAO suporta multi-statement SQL → usar `db.exec()` para DDL
- `ANY($1)` com array params NAO funciona → usar `IN(...)` com spread params
- `::int` cast necessario em COUNT queries

### tipc
- `.input()` e TYPE-LEVEL ONLY — nao aceita Zod runtime validation
- Usar `.input<Type>()` (generic, sem argumento)

### Vercel AI SDK v6
- `maxSteps` removido → usar `stopWhen: stepCountIs(10)`
- `parameters` renomeado para `inputSchema` nas tool definitions

### Export Engine
- Usa Electron native APIs (BrowserWindow hidden + capturePage/printToPDF)
- NAO usa Puppeteer (decisao de implementacao — mais leve)
- `capturePage()` so captura viewport visivel → cada target renderiza HTML standalone nas dimensoes exatas

---

## O Que Funciona (Backend — 71 testes)

- DB: conexao, migrations, seed, queries
- Produtos: CRUD completo com 12 testes
- Imagens: upload, default, remocao com 5 testes
- Parser: TSV/CSV, decimais BR, unidades com 8 testes
- Matcher: codigo exato, fallback com 4 testes
- Import flow: parse+match+journal creation com 4 testes
- Batch images: scan recursivo, match filename com 4 testes
- IA tools: 15 tools com 26 testes (core 8 + extended 7)

## O Que Precisa de Trabalho (Frontend — Gaps Conhecidos)

### Problemas Criticos

1. **Import de planilha pode falhar no UI** — O `PainelImport` le o arquivo via `file.text()` que funciona, mas o parser espera formato especifico. Se a planilha nao vier no formato esperado (5 colunas: Produto, Descricao, Preco Oferta, Tipo Oferta, clube) nao vai dar feedback claro.

2. **Imagens nao renderizam no preview** — O `CardProduto` usa `file://` protocol pra imagens, mas os paths no banco sao relativos (`images/products/codigo/file.png`). Precisa resolver pra path absoluto usando `getDataDir()`. O `ProdutoDetalhe` tem o mesmo problema.

3. **Export nao testado E2E** — O engine usa BrowserWindow hidden. Funciona em teoria mas nunca foi executado no Electron real. Pode ter problemas com paths de imagem, timing de load, etc.

4. **IA precisa de API key** — Sem a API key do Gemini configurada, o chat nao funciona. A pagina de configuracoes permite setar, mas o "Testar Conexao" faz uma chamada real que pode falhar se a key for invalida.

### Melhorias Necessarias

1. **Resolucao de paths de imagem** — Criar helper que converte path relativo do banco para path absoluto (`file://{dataDir}/{relativePath}`)
2. **Feedback de erro no import** — Mostrar erros de parse detalhados pro usuario
3. **Loading states** — Algumas paginas nao tem loading adequado
4. **Validacao de formularios** — Os forms usam validacao basica mas faltam mensagens claras
5. **Modo especial (Jornal Especial)** — Usa `window.prompt()` para preco, precisa de form modal adequado
6. **Drag & drop na reordenacao** — Especificado no design mas nao implementado
7. **Template visual** — Os cards e secoes renderizam estrutura mas falta o visual final (cores, backgrounds, headers tematicos dos templates)

---

## Como Rodar

```bash
# Dev
cd ~/jornalflow
npm run dev

# Testes
npm run test          # vitest (71 testes)

# Typecheck
npx tsc --noEmit -p tsconfig.node.json
npx tsc --noEmit -p tsconfig.web.json

# Build
npm run build
```

---

## Banco de Dados

10 tabelas com migration system versionado:
- `_migrations` — controle de versao
- `lojas` — dados da loja (1 registro seed)
- `produtos` — catalogo de produtos
- `produto_imagens` — imagens por produto
- `template_secoes` — 5 secoes template (acougue, horti, mercearia, padaria, casa)
- `secao_aliases` — aliases pra match com planilha
- `jornais` — jornais criados (semanal/especial)
- `jornal_paginas` — paginas do jornal
- `jornal_secoes` — secoes do jornal (linkam template ou custom)
- `jornal_itens` — itens do jornal (produto + preco + imagem + ajustes)
- `importacoes` — log de importacoes

Schema completo em: `src/main/db/schema.ts`
Seed data em: `src/main/db/seed.ts`
Design spec com DDL: `docs/specs/DESIGN.md`

---

## Convencoes

- **snake_case ponta a ponta** — DB colunas, IPC params, React props
- **Componentes:** PascalCase.tsx
- **Servicos:** `servicos/{entidade}.ts` (wrappers IPC no renderer)
- **Path aliases:** `@renderer/*` → `src/renderer/src/*`, `@shared/*` → `src/shared/*`
- **Tipos centralizados:** `src/shared/types.ts`
- **Constantes:** `src/shared/constants.ts`

---

## Git History (28 commits)

```
d8e8db0 chore: final integration — typecheck clean, all 71 tests passing
0b63bfe feat(editor): special journal mode — free layout + product pool
cef625d feat(import): batch image import from folder
234376b feat(ui): settings page — store info, API key, data management
ed9c471 feat(ui): dashboard with stats and quick actions
5de2ae5 feat(historico): journal history list + detail view
5205787 feat(ia): chat system — Gemini integration + slide-out panel
d92a5f8 feat(ia): remaining 7 tools — journal editing, history, stats
58a73f3 feat(ia): core 8 tools — products, images, journal query
b038fbc feat(ui): export dialog with format selection + progress
6f944ac feat(export): Electron native export — PDF, PNG, Story, Carrossel
afc0be6 feat(editor): image picker + multi-image composer
a3f51ac feat(editor): split-view editor — panel + live preview
d57220d feat(editor): Zustand store + journal service + load/update handlers
69c849c feat(jornal): section, page, and full preview components
c3d0d91 feat(jornal): CardProduto component — image, name, prices, status
62f7432 feat(import): full import flow — parse + match + journal creation
86f5f8c feat(import): product matcher — code lookup + fallback detection
dfa5194 feat(import): spreadsheet parser — TSV/CSV, Brazilian decimals, unit extraction
ee18c15 feat(ui): product catalog — list, detail, image upload
dbaa168 feat(imagens): product image CRUD + default management
59950d4 feat(produtos): CRUD IPC handlers with tests
f7d46a3 feat(ui): app shell — React Router + sidebar + stub pages
bd167ec feat(ipc): tipc router + DB init on startup + data dirs
5e7d0b7 feat(db): seed data — loja, template sections, aliases
773dafb feat(db): schema with all tables + migration system
15b5440 feat(db): PGlite connection + query helpers with tests
b86ac5a docs: implementation plan V1 — 27 tasks across 8 chunks
aa1d5d8 feat: scaffold JornalFlow — gerador de jornais de ofertas
```
