import { generateText, type LanguageModel } from 'ai'
import { queryOne, execute, insertReturningId } from '../db/query'
import { generatePassageEmbedding } from '../knowledge/embeddings'
import type { IaMensagem } from '../../shared/types'

// =============================================================================
// CONSTANTS
// =============================================================================

const COMPACTION_TOKEN_THRESHOLD = 30_000
const COMPACTION_MIN_MESSAGES = 10
const COMPACTION_KEEP_RECENT = 6
const DEDUP_COSINE_THRESHOLD = 0.85
const TRANSCRIPT_MAX_CHARS = 8000
const IA_MEMORIAS_AUTO_LIMIT = 50

// =============================================================================
// SANITIZE
// =============================================================================

/**
 * Extrai texto limpo das mensagens (so usuario + assistente, sem tool_calls JSON).
 */
export function sanitizeTranscript(mensagens: IaMensagem[]): string {
  const parts: string[] = []
  for (const m of mensagens) {
    if (m.papel === 'tool_result') continue
    const label = m.papel === 'usuario' ? 'Usuario' : 'Assistente'
    const textoBase = m.conteudo?.trim() ?? ''
    const anexosMarcadores =
      m.anexos?.map((a) => `[Anexo: ${a.nome} (${a.mime_type})]`).join(' ') ?? ''
    const linha = [textoBase, anexosMarcadores].filter(Boolean).join(' ')
    if (!linha) continue
    parts.push(`${label}: ${linha}`)
  }
  return parts.join('\n')
}

/**
 * Estima tokens a partir do comprimento do texto (~4 chars/token).
 */
export function estimateTokens(text: string | null | undefined): number {
  return Math.ceil((text?.length ?? 0) / 4)
}

// =============================================================================
// MEMORY EXTRACTION (1 LLM call) -> ia_memorias
// =============================================================================

type MemoryItem = {
  tipo: 'fato' | 'preferencia' | 'correcao' | 'decisao' | 'entidade'
  conteudo: string
}

/**
 * Extrai fatos relevantes de uma conversa usando LLM.
 * Salva em ia_memorias (com origem='auto').
 * Dedup por cosine similarity > 0.85 contra ia_memorias.embedding.
 * Eviction: se > 50 memorias auto, deleta a mais antiga.
 *
 * Graceful: nunca lanca erro — loga warning e retorna.
 */
export async function extractMemories(
  _conversa_id: string,
  mensagens: IaMensagem[],
  createModel: (modelo: string) => LanguageModel,
  modelo: string
): Promise<void> {
  try {
    const transcript = sanitizeTranscript(mensagens).slice(0, TRANSCRIPT_MAX_CHARS)
    if (transcript.length < 100) return

    const { text } = await generateText({
      model: createModel(modelo),
      prompt: `Voce e um assistente especializado em jornais de ofertas de supermercado.
Analise esta conversa e extraia FATOS CONCRETOS relevantes para conversas futuras.

Foque em: decisoes tomadas sobre layout/secoes, preferencias de formatacao, correcoes de dados de produtos, entidades mencionadas (fornecedores, marcas, categorias), regras especificas do supermercado.

NAO extraia: saudacoes, perguntas genericas, dados que ja estao no banco (precos importados, imagens ja cadastradas).

Responda APENAS com um array JSON valido no formato:
[{"tipo": "fato|preferencia|correcao|decisao|entidade", "conteudo": "descricao em 1-2 frases"}]

Se nao houver fatos relevantes, retorne [].

CONVERSA:
${transcript}`
    })

    let items: MemoryItem[] = []
    try {
      // Extrair JSON do texto (pode vir com markdown code block)
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        items = JSON.parse(jsonMatch[0])
      }
    } catch {
      console.warn('[session-processor] Falha ao parsear JSON de memorias:', text.slice(0, 200))
      return
    }

    if (!items || items.length === 0) return

    for (const item of items) {
      if (!item.conteudo || item.conteudo.length < 5) continue

      try {
        await _insertMemoryWithDedup(item.conteudo)
      } catch (err) {
        console.warn('[session-processor] Falha ao inserir memoria:', (err as Error).message)
      }
    }
  } catch (err) {
    console.warn('[session-processor] extractMemories falhou:', (err as Error).message)
  }
}

// =============================================================================
// DEDUP + INSERT helper
// =============================================================================

async function _insertMemoryWithDedup(conteudo: string): Promise<void> {
  const embedding = await generatePassageEmbedding(conteudo)

  if (embedding) {
    const embeddingStr = `[${embedding.join(',')}]`

    // Dedup: busca memoria similar em ia_memorias (apenas auto)
    const similar = await queryOne<{ id: number; similarity: number }>(
      `SELECT id,
              1 - (embedding <=> $1::vector) as similarity
       FROM ia_memorias
       WHERE origem = 'auto' AND embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT 1`,
      [embeddingStr]
    )

    if (similar && similar.similarity > DEDUP_COSINE_THRESHOLD) {
      // Duplicata detectada — skip
      return
    }

    // Eviction: se total auto > limite, deleta o mais antigo
    await _evictOldestIfNeeded()

    // Insert nova memoria auto com embedding
    await insertReturningId(
      `INSERT INTO ia_memorias (conteudo, origem, embedding) VALUES ($1, 'auto', $2::vector)`,
      [conteudo, embeddingStr]
    )
  } else {
    // Sem embedding disponivel — insert sem dedup
    await _evictOldestIfNeeded()

    await insertReturningId(
      `INSERT INTO ia_memorias (conteudo, origem) VALUES ($1, 'auto')`,
      [conteudo]
    )
  }
}

async function _evictOldestIfNeeded(): Promise<void> {
  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*)::int as total FROM ia_memorias WHERE origem = 'auto'`,
    []
  )
  const total = countRow?.total ?? 0

  if (total >= IA_MEMORIAS_AUTO_LIMIT) {
    const excesso = total - IA_MEMORIAS_AUTO_LIMIT + 1
    await execute(
      `DELETE FROM ia_memorias WHERE id IN (
        SELECT id FROM ia_memorias WHERE origem = 'auto'
        ORDER BY criada_em ASC LIMIT $1
      )`,
      [excesso]
    )
  }
}

// =============================================================================
// HISTORY COMPACTION (1 LLM call quando necessario)
// =============================================================================

/**
 * Se o historico excede 30K tokens E tem > 10 msgs, resume as msgs antigas.
 * Retorna resumo se compactou, null se nao precisa.
 * Cache em ia_conversas.resumo_compactado.
 *
 * Graceful: nunca lanca erro — loga warning e retorna null.
 */
export async function maybeCompact(
  conversa_id: string,
  historico: IaMensagem[],
  createModel: (modelo: string) => LanguageModel,
  modelo: string
): Promise<string | null> {
  try {
    // Estima tokens total
    const totalText = historico.map((m) => m.conteudo || '').join(' ')
    const tokens = estimateTokens(totalText)

    if (tokens < COMPACTION_TOKEN_THRESHOLD || historico.length <= COMPACTION_MIN_MESSAGES) {
      return null
    }

    // Busca cache
    const cached = await queryOne<{ resumo_compactado: string | null }>(
      'SELECT resumo_compactado FROM ia_conversas WHERE id = $1',
      [conversa_id]
    )
    if (cached?.resumo_compactado) return cached.resumo_compactado

    // Gera resumo das msgs antigas (exceto as ultimas COMPACTION_KEEP_RECENT)
    const msgsAntigas = historico.slice(0, -COMPACTION_KEEP_RECENT)
    const transcriptAntigas = sanitizeTranscript(msgsAntigas).slice(0, 6000)

    if (transcriptAntigas.length < 100) return null

    const { text: resumo } = await generateText({
      model: createModel(modelo),
      prompt: `Resuma a conversa abaixo preservando: decisoes tomadas, dados consultados, acoes executadas, preferencias expressas.
Contexto: conversa sobre jornal de ofertas de supermercado (produtos, secoes, layout, imagens, precos).
Formato: lista concisa de fatos em portugues. Maximo 500 palavras.

CONVERSA:
${transcriptAntigas}`
    })

    if (resumo && resumo.length > 20) {
      // Salva cache
      await execute(
        'UPDATE ia_conversas SET resumo_compactado = $1, atualizada_em = NOW() WHERE id = $2',
        [resumo, conversa_id]
      )
      return resumo
    }
  } catch (err) {
    console.warn('[session-processor] maybeCompact falhou:', (err as Error).message)
  }

  return null
}
