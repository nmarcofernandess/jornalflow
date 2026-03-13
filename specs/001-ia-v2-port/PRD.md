# PRD: JornalFlow IA v2 — Port do EscalaFlow Intelligence Stack

> **Workflow:** complex
> **Criado em:** 2026-03-12
> **Fonte:** docs/specs/PLANO-IA-V2.md (plano completo)

---

## Visão Geral

Port completo da infraestrutura de IA do EscalaFlow para o JornalFlow. O JornalFlow hoje tem um `generateText` seco com 15 tools CRUD e um prompt estático de 10 linhas. O objetivo é trazer: multi-provider, streaming, persistência de conversas, discovery automático, RAG local com embeddings offline, memória auto-extraída, knowledge graph, e tools inteligentes com discovery design.

## Stack Atual do JornalFlow (src/main/ia/)

- `config.ts` — API key in-memory, Gemini hardcoded, 23 linhas
- `cliente.ts` — `generateText` seco, sem streaming, sem follow-up, 23 linhas
- `tools.ts` — 15 tools CRUD básicos, sem pattern 3-status, 491 linhas
- `sistema-prompt.ts` — Prompt estático de 17 linhas

## Stack Alvo (baseado no EscalaFlow)

### FASE 1: Infraestrutura Base
- Multi-provider (Gemini + OpenRouter) com factory pattern
- Tabela `configuracao_ia` no PGlite
- Streaming via `streamText` + BrowserWindow broadcast
- Persistência de conversas (ia_conversas + ia_mensagens)
- Follow-up pattern (se tools rodam sem texto → auto follow-up)
- Tool result truncation (TOOL_RESULT_MAX_CHARS = 1500)

### FASE 2: Discovery Automático
- `discovery.ts` com `buildContextBriefing(contexto, mensagemUsuario)`
- IaContexto por página (rota, jornal_id, produto_id)
- Auto-inject: resumo global + jornal em foco + alertas proativos
- System prompt enriquecido (9 seções)

### FASE 3: Knowledge Base (RAG Local)
- Tabelas knowledge_sources + knowledge_chunks (pgvector)
- Embeddings offline via @huggingface/transformers (multilingual-e5-base, ONNX)
- Chunking (recursive text splitter)
- Ingestion pipeline (source → chunk → embed → FTS)
- Hybrid search (70% vector + 30% FTS + trigram)
- Conteúdo seed (seções, regras layout, padrões nome)

### FASE 4: Memória e Session Management
- Auto-extração de memórias (LLM extrai fatos de cada conversa)
- Dedup por cosine similarity > 0.85
- History compaction (resume msgs antigas quando > 30K tokens)
- Tabela ia_memorias

### FASE 5: Knowledge Graph
- Tabelas knowledge_entities + knowledge_relations
- Entity extraction via LLM (1 call por chunk)
- Graph traversal (CTE recursivo)
- Graph enrichment no search

### FASE 6: Tools V2
- Pattern 3-status em todas as tools (status + summary + data + _meta)
- 10 novas tools (buscar_conhecimento, sugerir_produtos, diagnosticar_jornal, etc.)
- Discovery design (tools de entrada → tools de detalhe)

## Referência de Implementação

O EscalaFlow tem implementação real e funcionando em:
- `/Users/marcofernandes/escalaflow/src/main/ia/` — cliente, discovery, session-processor, tools, config
- `/Users/marcofernandes/escalaflow/src/main/knowledge/` — graph, chunking, embeddings, search, ingest
- `/Users/marcofernandes/escalaflow/docs/flowai/TOOL_CALLING_PLAYBOOK.md` — patterns completos

## Regras

1. Copiar patterns, adaptar domínio (CLT/RH → produtos/jornais)
2. Manter compatibilidade com as 15 tools existentes
3. PGlite schema migrations versionadas
4. Testes com real PGlite (sem mock)
5. Graceful degradation sempre
6. Zero breaking changes no frontend
