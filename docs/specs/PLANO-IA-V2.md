# PLANO: JornalFlow IA v2 — Port do EscalaFlow Intelligence Stack

> **Objetivo:** Trazer toda a infraestrutura de IA do EscalaFlow pro JornalFlow, adaptada ao domínio de jornais de supermercado.
>
> **Status:** PLANEJAMENTO
>
> **Baseado em:** EscalaFlow (TOOL_CALLING_PLAYBOOK.md + RESEARCH-RAG-MEMORY-PATTERNS.md + implementação real)
>
> **Data:** 2026-03-12

---

## TL;DR

O JornalFlow tem um `generateText` com 15 tools e um prompt estático. O EscalaFlow tem streaming, multi-provider, discovery automático, RAG semântico, knowledge graph, memória auto-extraída, history compaction, e 33+ tools. O plano é trazer essa stack inteira em **6 fases incrementais**, cada uma entregando valor isolado.

---

## FASE 1: INFRAESTRUTURA BASE (Fundação)

> **Entrega:** Provider multi-modelo, streaming, persistência de conversas, follow-up pattern
> **Dependências:** Nenhuma
> **Estimativa de complexidade:** Média

### 1.1 Multi-Provider (`src/main/ia/config.ts`)

**Hoje:** API key in-memory, Gemini hardcoded
**Depois:**
- Tabela `configuracao_ia` no PGlite (singleton)
  - `provider`: 'gemini' | 'openrouter'
  - `api_key`: encrypted via safeStorage
  - `modelo`: string (com defaults por provider)
  - `configs_json`: JSON (temperature, etc)
- `resolveProviderApiKey()`, `resolveModel()`, `buildModelFactory()`
- Suporte Gemini + OpenRouter (mesma factory pattern do EscalaFlow)
- UI de configuração na página de Settings (já existe parcialmente)

**Schema migration:**
```sql
CREATE TABLE IF NOT EXISTS configuracao_ia (
  id SERIAL PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'gemini',
  api_key TEXT,
  modelo TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  configs_json TEXT DEFAULT '{}',
  criada_em TIMESTAMP DEFAULT NOW()
);
```

### 1.2 Streaming (`src/main/ia/cliente.ts`)

**Hoje:** `generateText` → retorna string seca
**Depois:**
- `streamText` com broadcast via `BrowserWindow.webContents.send('ia:stream', event)`
- Eventos: `start-step`, `text-delta`, `tool-call-start`, `tool-result`, `finish`, `error`, `follow-up-start`
- Frontend escuta via `ipcRenderer.on('ia:stream')` e atualiza em tempo real
- Tipo `IaStreamEvent` em `shared/types.ts`

### 1.3 Persistência de Conversas

**Hoje:** Array in-memory no Zustand, perde tudo ao fechar
**Depois:**
- Tabelas `ia_conversas` e `ia_mensagens` no PGlite
- `ia_conversas`: id (UUID), titulo, status, resumo_compactado, criada_em
- `ia_mensagens`: id (UUID), conversa_id, papel, conteudo, tool_calls_json, anexos_json, criada_em
- Auto-título na 1ª mensagem
- Sidebar com histórico de conversas
- IPC handlers: `ia.conversas.listar`, `ia.conversas.criar`, `ia.mensagens.listar`

```sql
CREATE TABLE IF NOT EXISTS ia_conversas (
  id TEXT PRIMARY KEY,
  titulo TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  resumo_compactado TEXT,
  criada_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ia_mensagens (
  id TEXT PRIMARY KEY,
  conversa_id TEXT NOT NULL REFERENCES ia_conversas(id) ON DELETE CASCADE,
  papel TEXT NOT NULL, -- 'usuario' | 'assistente' | 'tool_result'
  conteudo TEXT,
  tool_calls_json TEXT, -- JSON array de ToolCall[]
  anexos_json TEXT, -- JSON array de IaAnexo[]
  criada_em TIMESTAMP DEFAULT NOW()
);
```

### 1.4 Follow-up Pattern

**Hoje:** Se tools rodam mas modelo não gera texto → retorna vazio
**Depois:**
- Se `result.text` vazio e `acoes.length > 0` → follow-up automático
- Usa `result.response.messages` como base + "Com base nos resultados das ferramentas, responda ao usuario."
- Mesmo pattern do EscalaFlow (funciona tanto em generateText quanto streamText)

### 1.5 Tool Result Truncation

**Hoje:** Resultado bruto, sem limite
**Depois:**
- `TOOL_RESULT_MAX_CHARS = 1500`
- `safeCompactJson()` que preserva `summary` e `_meta` quando trunca
- Evita explodir o contexto com listas enormes de produtos

---

## FASE 2: DISCOVERY AUTOMÁTICO (Context Injection)

> **Entrega:** IA que JÁ SABE o que o usuário está vendo antes de perguntar
> **Dependências:** Fase 1 (precisa do novo cliente)
> **Estimativa de complexidade:** Média

### 2.1 Contexto de Página (`src/main/ia/discovery.ts`)

**Conceito:** Cada página do renderer envia `IaContexto` com a rota atual e IDs relevantes.

```typescript
interface IaContexto {
  rota: string        // '/editor', '/produtos', '/configuracoes'
  pagina: string      // 'editor', 'produtos', 'produto_detalhe', 'configuracoes'
  jornal_id?: number
  produto_id?: number
}
```

### 2.2 `buildContextBriefing()` — Montagem Automática

O briefing é injetado no system prompt antes de cada chamada. Seções:

1. **Resumo global** (sempre)
   - Produtos ativos, com/sem imagem
   - Jornais: total, rascunhos
   - Última importação

2. **Jornal em foco** (se `jornal_id`)
   - Título, período, status, total itens
   - Seções com contagem
   - Itens sem imagem (alerta)
   - Produtos repetidos (alerta)

3. **Produto em foco** (se `produto_id`)
   - Detalhes, imagens, histórico de preços
   - Jornais em que apareceu

4. **Alertas proativos**
   - Produtos sem imagem no jornal atual
   - Seções vazias
   - Preços zerados
   - Última importação com erros

5. **Dica de página**
   - Editor: "O usuário está editando o jornal. Pode querer trocar produtos, ajustar preços..."
   - Produtos: "O usuário está no catálogo. Pode querer buscar, cadastrar, ou ver imagens..."

### 2.3 System Prompt Enriquecido (`src/main/ia/sistema-prompt.ts`)

**Hoje:** 10 linhas genéricas
**Depois:**
- Seção de identidade e papel
- Seção de regras do domínio (seções do jornal, padrões de nome, etc.)
- Seção de formatação (Markdown, tabelas, preços em R$)
- Seção de tools (quando usar cada uma, discovery design)
- Auto-correção: se tool retorna erro, tenta novamente com parâmetros diferentes
- Resposta rica: pattern 3-status (status + dados + sugestão)

---

## FASE 3: KNOWLEDGE BASE (RAG Local)

> **Entrega:** Base de conhecimento pesquisável com embeddings offline
> **Dependências:** Fase 1 (PGlite schema)
> **Estimativa de complexidade:** Alta

### 3.1 Schema Knowledge

```sql
-- pgvector extension (PGlite já suporta)
-- CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS knowledge_sources (
  id SERIAL PRIMARY KEY,
  tipo TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'sistema' | 'auto_capture'
  titulo TEXT NOT NULL,
  conteudo_original TEXT,
  metadata TEXT DEFAULT '{}',
  importance TEXT NOT NULL DEFAULT 'low', -- 'high' | 'low'
  ativo BOOLEAN NOT NULL DEFAULT true,
  criada_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id SERIAL PRIMARY KEY,
  source_id INTEGER NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  conteudo TEXT NOT NULL,
  embedding vector(768), -- multilingual-e5-base
  search_tsv TSVECTOR,
  importance TEXT NOT NULL DEFAULT 'low',
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMP,
  criada_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
  ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_fts
  ON knowledge_chunks USING gin (search_tsv);
```

### 3.2 Embeddings Offline (`src/main/knowledge/embeddings.ts`)

- `@huggingface/transformers` com `Xenova/multilingual-e5-base`
- ONNX Runtime, quantizado int8, ~150MB
- Prefixes e5: `"query: "` para busca, `"passage: "` para indexação
- Graceful degradation: retorna `null` se modelo indisponível
- **Bundling:** Modelo empacotado em `models/embeddings/` no app

### 3.3 Chunking (`src/main/knowledge/chunking.ts`)

- Port direto do EscalaFlow
- Recursive text splitter: `\n\n` → `\n` → `. ` → fallback por tamanho
- `maxChars = 1500`, `overlap = 200`
- Funciona com qualquer texto (regras de negócio, guias, etc.)

### 3.4 Ingestion (`src/main/knowledge/ingest.ts`)

- `ingestKnowledge(titulo, conteudo, importance, metadata)`
- Source → Chunk → Embed → FTS
- Context hint via `<!-- quando_usar: ... -->` no topo do documento

### 3.5 Hybrid Search (`src/main/knowledge/search.ts`)

- `searchKnowledge(query, options)`
- **Hybrid:** 70% vector + 30% FTS
- Boost para `importance = 'high'`
- Lazy decay: ignora chunks low/unused/velhos
- Track access count
- Fallback keyword-only se embeddings offline
- Retorna `context_for_llm` formatado pra injeção no prompt

### 3.6 Conteúdo Seed do Knowledge

Conhecimento que já nasce com o app:
- **Seções padrão:** O que é cada seção (Açougue, Horti Fruti, Mercearia, Padaria, Casa & Higiene)
- **Regras de layout:** Quantos produtos por seção, grid padrão
- **Padrões de nome:** Como normalizar nomes de produtos
- **Dicas de importação:** Formatos aceitos, colunas esperadas
- **Boas práticas:** Preços, imagens, organização de jornal

### 3.7 Auto-RAG no Discovery

- Em cada mensagem do usuário, `_autoRag(mensagemUsuario)` busca knowledge relevante
- Injeta no system prompt como "Conhecimento relevante"
- Leve: só título + context_hint (~300 chars total)
- Tool `buscar_conhecimento` para deep dive

---

## FASE 4: MEMÓRIA E SESSION MANAGEMENT

> **Entrega:** IA que lembra de conversas passadas e aprende com o uso
> **Dependências:** Fase 1 (conversas) + Fase 3 (embeddings)
> **Estimativa de complexidade:** Média-Alta

### 4.1 Auto-Extração de Memórias (`src/main/ia/session-processor.ts`)

- Port do EscalaFlow: `extractMemories(conversa_id, mensagens, createModel, modelo)`
- No fim de cada conversa (ou ao trocar de conversa), extrai fatos relevantes
- Categorias: `fato`, `preferencia`, `correcao`, `decisao`, `entidade`
- Dedup por cosine similarity > 0.85
- Limite de 50 memórias auto (FIFO para low-importance)

```sql
CREATE TABLE IF NOT EXISTS ia_memorias (
  id SERIAL PRIMARY KEY,
  conteudo TEXT NOT NULL,
  origem TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'auto'
  embedding vector(768),
  criada_em TIMESTAMP DEFAULT NOW(),
  atualizada_em TIMESTAMP DEFAULT NOW()
);
```

### 4.2 History Compaction

- Port do EscalaFlow: `maybeCompact(conversa_id, historico, createModel, modelo)`
- Se histórico > 30K tokens E > 10 msgs → resume msgs antigas
- Cache em `ia_conversas.resumo_compactado`
- Prepend resumo + mantém 10 msgs recentes

### 4.3 Injeção de Memórias no Discovery

- `_memorias()` busca todas as memórias e injeta no briefing
- A IA sempre sabe o que o RH já decidiu/preferiu

---

## FASE 5: KNOWLEDGE GRAPH

> **Entrega:** Grafo de entidades e relações do domínio
> **Dependências:** Fase 3 (knowledge base + embeddings)
> **Estimativa de complexidade:** Alta

### 5.1 Schema Graph

```sql
CREATE TABLE IF NOT EXISTS knowledge_entities (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL, -- 'produto', 'secao', 'categoria', 'fornecedor', 'regra', 'conceito'
  embedding vector(768),
  origem TEXT NOT NULL DEFAULT 'usuario', -- 'sistema' | 'usuario'
  valid_from TIMESTAMP DEFAULT NOW(),
  valid_to TIMESTAMP,
  criada_em TIMESTAMP DEFAULT NOW(),
  UNIQUE(nome, tipo)
);

CREATE TABLE IF NOT EXISTS knowledge_relations (
  id SERIAL PRIMARY KEY,
  entity_from_id INTEGER NOT NULL REFERENCES knowledge_entities(id) ON DELETE CASCADE,
  entity_to_id INTEGER NOT NULL REFERENCES knowledge_entities(id) ON DELETE CASCADE,
  tipo_relacao TEXT NOT NULL, -- 'pertence_a', 'substitui', 'combina_com', 'concorre_com', 'mesma_marca'
  peso REAL NOT NULL DEFAULT 1.0,
  valid_from TIMESTAMP DEFAULT NOW(),
  valid_to TIMESTAMP,
  criada_em TIMESTAMP DEFAULT NOW()
);
```

### 5.2 Entity Types (Domínio JornalFlow)

| Tipo | Exemplos |
|------|----------|
| `produto` | "Cerveja Crystal 350ml", "Picanha Bovina" |
| `secao` | "Açougue", "Horti Fruti", "Mercearia" |
| `categoria` | "carnes", "hortifruti", "bebidas" |
| `fornecedor` | "Ambev", "JBS", "Nestlé" |
| `marca` | "Crystal", "Seara", "Nescafé" |
| `conceito` | "oferta semanal", "produto âncora", "mix de categorias" |

### 5.3 Relation Types

| Relação | Exemplo |
|---------|---------|
| `pertence_a` | "Cerveja Crystal" → "Bebidas" |
| `substitui` | "Picanha Bovina" → "Maminha Bovina" |
| `combina_com` | "Carvão" → "Carnes" (complementar) |
| `mesma_marca` | "Nescafé Original" → "Nescafé Cappuccino" |
| `concorre_com` | "Coca-Cola 2L" → "Guaraná Antarctica 2L" |

### 5.4 Graph Operations

- `extractEntitiesFromChunk()` — LLM extrai entidades/relações de texto
- `rebuildGraph()` — Rebuild completo a partir dos chunks
- `graphStats()` — Contagem de entidades/relações
- `exploreRelations()` — CTE recursivo, traversal a partir de uma entidade
- `importGraphSeed()` / `exportGraphSeed()` — Seed pré-computado

### 5.5 Graph Enrichment no Search

- Quando a busca retorna chunks, busca entidades mencionadas
- Retorna relações como contexto adicional
- Ex: "Cerveja Crystal" → mostra "substitui: Skol 350ml", "pertence_a: Bebidas"

---

## FASE 6: TOOLS V2 (Discovery Design + Novas Tools)

> **Entrega:** Tools inteligentes com auto-descoberta e 25+ tools
> **Dependências:** Fases 1-4
> **Estimativa de complexidade:** Média

### 6.1 Pattern 3-Status (Todas as Tools)

Toda tool retorna:
```typescript
{
  status: 'ok' | 'empty' | 'error',
  summary: string,        // Frase resumindo resultado
  data: any,              // Dados úteis
  _meta?: {               // Metadata para a IA
    next_actions?: string[] // Sugestões de próxima tool
  }
}
```

### 6.2 Novas Tools

| Tool | Descrição |
|------|-----------|
| `buscar_conhecimento` | Deep dive na knowledge base (RAG completo) |
| `salvar_conhecimento` | Adiciona novo conhecimento à base |
| `buscar_memorias` | Busca memórias do RH |
| `salvar_memoria` | Salva memória manualmente |
| `sugerir_produtos` | Sugere produtos para uma seção baseado em histórico |
| `analisar_mix` | Analisa mix de categorias do jornal (diversidade, equilíbrio) |
| `comparar_jornais` | Compara dois jornais (produtos, preços, seções) |
| `sugerir_precos` | Sugere preços baseado em histórico e tendências |
| `diagnosticar_jornal` | Análise completa: gaps, problemas, sugestões |
| `explorar_grafo` | Traversal do knowledge graph (relações entre entidades) |

### 6.3 Discovery Design

- Tools de "entrada" (buscar_produtos, buscar_jornal_atual) retornam IDs e resumos
- Tools de "detalhe" (ver_produto, comparar_precos) usam os IDs
- A IA descobre o sistema progressivamente em vez de receber tudo de uma vez
- System prompt guia: "Use buscar_produtos primeiro, depois ver_produto para detalhes"

---

## SEQUÊNCIA DE IMPLEMENTAÇÃO

```
FASE 1 ──→ FASE 2 ──→ FASE 3 ──→ FASE 4
  │                       │          │
  │                       └──────────┤
  │                                  │
  └──────────────────────────────────┴──→ FASE 5 ──→ FASE 6
```

| Fase | Blocker? | Valor isolado? |
|------|----------|----------------|
| 1 - Infraestrutura | Não | SIM — streaming + persistência já muda tudo |
| 2 - Discovery | Fase 1 | SIM — IA contextual sem knowledge base |
| 3 - Knowledge | Fase 1 | SIM — RAG funciona sem graph |
| 4 - Memória | Fase 1 + 3 | SIM — IA que aprende |
| 5 - Graph | Fase 3 | Opcional — enriquece RAG |
| 6 - Tools V2 | Fases 1-4 | SIM — IA completa |

---

## REGRAS DE PORT

1. **Copiar patterns, adaptar domínio.** O EscalaFlow tem CLT/RH, o JornalFlow tem produtos/jornais. A infraestrutura é a mesma.
2. **Manter compatibilidade.** As 15 tools atuais continuam funcionando. Novas tools são adicionais.
3. **PGlite schema migrations.** Tudo versionado no `schema.ts` existente.
4. **Testes.** Cada fase tem testes. RAG/embeddings testados com real PGlite (sem mock).
5. **Graceful degradation.** Se embeddings offline → fallback keyword. Se API key faltando → funciona sem IA.
6. **Zero breaking changes no frontend.** Chat existente continua funcionando, streaming é opt-in.

---

## ARQUIVOS A CRIAR

```
src/main/ia/
  config.ts          ← REESCREVER (multi-provider, safeStorage)
  cliente.ts         ← REESCREVER (streaming, follow-up, compaction)
  tools.ts           ← EXPANDIR (pattern 3-status, novas tools)
  sistema-prompt.ts  ← REESCREVER (9 seções, rico)
  discovery.ts       ← NOVO (auto-context injection)
  session-processor.ts ← NOVO (memory extraction, compaction)

src/main/knowledge/
  embeddings.ts      ← NOVO (offline ONNX embeddings)
  chunking.ts        ← NOVO (recursive text splitter)
  ingest.ts          ← NOVO (source → chunk → embed → FTS)
  search.ts          ← NOVO (hybrid vector + FTS)
  graph.ts           ← NOVO (entity extraction, persist, traversal)

src/shared/types.ts  ← EXPANDIR (IaContexto, IaStreamEvent, IaMensagem, etc.)
src/main/db/schema.ts ← EXPANDIR (6 novas tabelas)

knowledge/           ← NOVO (seed files .md com conteúdo de domínio)
  secoes.md
  regras-layout.md
  padroes-nome.md
  dicas-importacao.md
  boas-praticas.md

models/embeddings/   ← NOVO (modelo ONNX empacotado)
```

---

## O QUE NÃO TRAZER

- **IA Local (node-llama-cpp):** Overkill pro JornalFlow. Mantém Gemini + OpenRouter.
- **DevTools middleware:** Nice-to-have, mas não prioritário.
- **Attachment support (multimodal):** O JornalFlow lida com imagens de produto por path, não por upload no chat.
- **Ciclo rotativo e motor Python:** Específico do EscalaFlow.

---

*Gerado por Miss Monday | 2026-03-12*
