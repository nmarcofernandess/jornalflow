import { queryOne, queryAll } from '../db/query'
import type { IaContexto } from '../../shared/types'

/**
 * Auto-discovery: dado o contexto da pagina atual do usuario,
 * busca dados relevantes do DB e monta um briefing de texto
 * que e injetado no system instruction da IA.
 *
 * O objetivo e que a IA NUNCA precise perguntar informacoes
 * basicas que ja estao visiveis na tela do usuario.
 */
export async function buildContextBriefing(
  contexto?: IaContexto,
  mensagemUsuario?: string
): Promise<string> {
  if (!contexto) return ''

  const sections: string[] = []

  sections.push(`## CONTEXTO AUTOMATICO — PAGINA ATUAL DO USUARIO`)
  sections.push(`Rota: ${contexto.rota}`)

  // --- Memorias (GRACEFUL: tabela pode nao existir ainda) --------
  const memorias = await _memorias()
  if (memorias) sections.push(memorias)

  // --- Auto-RAG: busca semantica no knowledge --------------------
  if (mensagemUsuario && mensagemUsuario.trim().length > 10) {
    const ragContext = await _autoRag(mensagemUsuario)
    if (ragContext) sections.push(ragContext)
  }

  // --- Resumo global (sempre) ------------------------------------
  const resumo = await _resumoGlobal()
  sections.push(`\n### Resumo do sistema`)
  sections.push(`- Produtos ativos: ${resumo.produtosAtivos}`)
  sections.push(`- Produtos com imagem: ${resumo.produtosComImagem}`)
  sections.push(`- Total imagens: ${resumo.totalImagens}`)
  sections.push(`- Total jornais: ${resumo.totalJornais}`)
  sections.push(`- Jornais rascunho: ${resumo.jornaisRascunho}`)

  // --- Secoes do template (sempre — sao poucas) ------------------
  const secoes = await _secoesTemplate()
  if (secoes) sections.push(secoes)

  // --- Jornal em foco (se contexto.jornal_id) --------------------
  if (contexto.jornal_id) {
    const jornalInfo = await _infoJornal(contexto.jornal_id)
    if (jornalInfo) sections.push(jornalInfo)
  }

  // --- Alertas proativos -----------------------------------------
  const alertas = await _alertasProativos(contexto.jornal_id)
  if (alertas) sections.push(alertas)

  // --- Stats Knowledge Base (GRACEFUL) ---------------------------
  const knowledgeStats = await _statsKnowledge()
  if (knowledgeStats) sections.push(knowledgeStats)

  // --- Dica de pagina --------------------------------------------
  sections.push(_dicaPagina(contexto.pagina))

  return sections.join('\n')
}

// =============================================================================
// HELPERS INTERNOS
// =============================================================================

async function _resumoGlobal() {
  return {
    produtosAtivos:
      (
        await queryOne<{ c: number }>(
          'SELECT COUNT(*)::int as c FROM produtos WHERE ativo = true'
        )
      )?.c ?? 0,
    produtosComImagem:
      (
        await queryOne<{ c: number }>(
          `SELECT COUNT(DISTINCT p.produto_id)::int as c
           FROM produtos p
           JOIN produto_imagens pi ON p.produto_id = pi.produto_id
           WHERE p.ativo = true`
        )
      )?.c ?? 0,
    totalImagens:
      (
        await queryOne<{ c: number }>(
          'SELECT COUNT(*)::int as c FROM produto_imagens'
        )
      )?.c ?? 0,
    totalJornais:
      (await queryOne<{ c: number }>('SELECT COUNT(*)::int as c FROM jornais'))
        ?.c ?? 0,
    jornaisRascunho:
      (
        await queryOne<{ c: number }>(
          "SELECT COUNT(*)::int as c FROM jornais WHERE status = 'rascunho'"
        )
      )?.c ?? 0,
  }
}

async function _secoesTemplate(): Promise<string | null> {
  try {
    const secoes = await queryAll<{
      secao_id: number
      nome_display: string
      slug: string
      ordem: number
      aliases: string[] | null
    }>(
      `SELECT ts.secao_id, ts.nome_display, ts.slug, ts.posicao as ordem,
              array_agg(sa.alias) FILTER (WHERE sa.alias IS NOT NULL) as aliases
       FROM template_secoes ts
       LEFT JOIN secao_aliases sa ON ts.secao_id = sa.secao_id
       GROUP BY ts.secao_id, ts.nome_display, ts.slug, ts.posicao
       ORDER BY ts.posicao`
    )
    if (secoes.length === 0) return null

    const lines: string[] = []
    lines.push(`\n### Secoes do template (${secoes.length})`)
    for (const s of secoes) {
      const aliasStr =
        s.aliases && s.aliases.length > 0
          ? ` (aliases: ${s.aliases.join(', ')})`
          : ''
      lines.push(`- **${s.nome_display}** [${s.slug}]${aliasStr}`)
    }
    return lines.join('\n')
  } catch {
    return null
  }
}

async function _infoJornal(jornal_id: number): Promise<string | null> {
  try {
    const jornal = await queryOne<{
      jornal_id: number
      titulo: string | null
      tipo: string
      data_inicio: string
      data_fim: string
      status: string
      criado_em: string
    }>('SELECT * FROM jornais WHERE jornal_id = $1', [jornal_id])
    if (!jornal) return null

    const lines: string[] = []
    lines.push(
      `\n### Jornal em foco: ${jornal.titulo ?? 'Sem titulo'} (ID: ${jornal.jornal_id})`
    )
    lines.push(`- Tipo: ${jornal.tipo} | Status: ${jornal.status}`)
    lines.push(`- Periodo: ${jornal.data_inicio} a ${jornal.data_fim}`)

    // Paginas
    const paginas = await queryAll<{
      pagina_id: number
      numero: number
      layout: string
    }>(
      'SELECT pagina_id, numero, layout FROM jornal_paginas WHERE jornal_id = $1 ORDER BY numero',
      [jornal_id]
    )
    if (paginas.length > 0) {
      lines.push(`- Paginas: ${paginas.length}`)
      for (const p of paginas) {
        lines.push(`  - Pag ${p.numero}: layout ${p.layout}`)
      }
    }

    // Secoes com contagem de itens
    const secoes = await queryAll<{
      jornal_secao_id: number
      template_secao_id: number | null
      secao_nome: string | null
      nome_custom: string | null
    }>(
      `SELECT js.jornal_secao_id, js.template_secao_id,
              ts.nome_display as secao_nome, js.nome_custom
       FROM jornal_secoes js
       LEFT JOIN template_secoes ts ON js.template_secao_id = ts.secao_id
       WHERE js.jornal_id = $1`,
      [jornal_id]
    )

    const itensCount = await queryAll<{
      jornal_secao_id: number
      total_itens: number
    }>(
      `SELECT js.jornal_secao_id, COUNT(ji.item_id)::int as total_itens
       FROM jornal_secoes js
       LEFT JOIN jornal_itens ji ON js.jornal_secao_id = ji.jornal_secao_id
       WHERE js.jornal_id = $1
       GROUP BY js.jornal_secao_id`,
      [jornal_id]
    )
    const itensMap = new Map(
      itensCount.map((r) => [r.jornal_secao_id, r.total_itens])
    )

    if (secoes.length > 0) {
      lines.push(`\n#### Secoes do jornal (${secoes.length}):`)
      for (const s of secoes) {
        const nome = s.nome_custom ?? s.secao_nome ?? 'Sem nome'
        const count = itensMap.get(s.jornal_secao_id) ?? 0
        lines.push(`- ${nome}: ${count} iten(s)`)
      }
    }

    // Importacao mais recente
    const importacao = await queryOne<{
      importacao_id: number
      arquivo_nome: string
      total_itens: number
      matched: number
      fallbacks: number
      nao_encontrados: number
      criado_em: string
    }>(
      'SELECT * FROM importacoes WHERE jornal_id = $1 ORDER BY criado_em DESC LIMIT 1',
      [jornal_id]
    )
    if (importacao) {
      lines.push(`\n#### Ultima importacao:`)
      lines.push(`- Arquivo: ${importacao.arquivo_nome}`)
      lines.push(
        `- Itens: ${importacao.total_itens} total | ${importacao.matched} match | ${importacao.fallbacks} fallback | ${importacao.nao_encontrados} nao encontrados`
      )
    }

    return lines.join('\n')
  } catch {
    return null
  }
}

async function _alertasProativos(
  jornal_id?: number
): Promise<string | null> {
  try {
    const alertas: string[] = []

    // Produtos sem imagem (global)
    const semImagem = await queryOne<{ c: number }>(
      `SELECT COUNT(*)::int as c FROM produtos p
       WHERE p.ativo = true
         AND NOT EXISTS (SELECT 1 FROM produto_imagens pi WHERE pi.produto_id = p.produto_id)`
    )
    if (semImagem && semImagem.c > 0) {
      alertas.push(
        `- WARNING: ${semImagem.c} produto(s) ativo(s) sem nenhuma imagem`
      )
    }

    if (jornal_id) {
      // Secoes vazias no jornal
      const secoesVazias = await queryAll<{
        secao_nome: string | null
        nome_custom: string | null
      }>(
        `SELECT ts.nome_display as secao_nome, js.nome_custom
         FROM jornal_secoes js
         LEFT JOIN template_secoes ts ON js.template_secao_id = ts.secao_id
         LEFT JOIN jornal_itens ji ON js.jornal_secao_id = ji.jornal_secao_id
         WHERE js.jornal_id = $1
         GROUP BY js.jornal_secao_id, ts.nome_display, js.nome_custom
         HAVING COUNT(ji.item_id) = 0`,
        [jornal_id]
      )
      if (secoesVazias.length > 0) {
        const nomes = secoesVazias
          .map((s) => s.nome_custom ?? s.secao_nome ?? 'Sem nome')
          .join(', ')
        alertas.push(
          `- WARNING: Secoes vazias no jornal: ${nomes}`
        )
      }

      // Itens com fallback
      const fallbacks = await queryOne<{ c: number }>(
        `SELECT COUNT(*)::int as c FROM jornal_itens ji
         JOIN jornal_secoes js ON ji.jornal_secao_id = js.jornal_secao_id
         WHERE js.jornal_id = $1 AND ji.is_fallback = true`,
        [jornal_id]
      )
      if (fallbacks && fallbacks.c > 0) {
        alertas.push(
          `- WARNING: ${fallbacks.c} item(ns) com imagem fallback no jornal`
        )
      }

      // Precos zerados
      const precosZerados = await queryOne<{ c: number }>(
        `SELECT COUNT(*)::int as c FROM jornal_itens ji
         JOIN jornal_secoes js ON ji.jornal_secao_id = js.jornal_secao_id
         WHERE js.jornal_id = $1 AND (ji.preco_oferta IS NULL OR ji.preco_oferta = 0)`,
        [jornal_id]
      )
      if (precosZerados && precosZerados.c > 0) {
        alertas.push(
          `- WARNING: ${precosZerados.c} item(ns) com preco zerado no jornal`
        )
      }
    }

    if (alertas.length === 0) return null
    return `\n### Alertas proativos\n${alertas.join('\n')}`
  } catch {
    return null
  }
}

async function _memorias(): Promise<string | null> {
  try {
    const rows = await queryAll<{ id: number; conteudo: string }>(
      'SELECT id, conteudo FROM ia_memorias ORDER BY atualizada_em DESC LIMIT 50'
    )
    if (rows.length === 0) return null
    const lines = rows.map((m) => `- ${m.conteudo}`)
    return `\n### Memorias (${rows.length}/50)\n${lines.join('\n')}`
  } catch {
    // tabela ia_memorias pode nao existir ainda (Phase 4)
    return null
  }
}

async function _autoRag(query: string): Promise<string | null> {
  try {
    // Dynamic import — modulo pode nao existir ainda (Phase 3)
    // @ts-ignore — module will be created in Phase 3 (subtask-3-6)
    const { searchKnowledge } = await import('../knowledge/search')
    const result = await searchKnowledge(query, { limite: 3 })
    if (result.chunks.length === 0) return null

    const sourceIds = [...new Set(result.chunks.map((c: any) => c.source_id))]
    const sources = await queryAll<{
      id: number
      titulo: string
      metadata: string
    }>(
      'SELECT id, titulo, metadata::text as metadata FROM knowledge_sources WHERE id = ANY($1)',
      [sourceIds]
    )
    if (sources.length === 0) return null

    const lines = sources.map((s) => {
      let hint = ''
      try {
        const meta = JSON.parse(s.metadata)
        hint = meta.context_hint ?? ''
      } catch {
        /* ignore parse error */
      }
      return hint ? `- **${s.titulo}**: ${hint}` : `- **${s.titulo}**`
    })

    return `\n### Conhecimento relevante (use buscar_conhecimento para detalhes)\n${lines.join('\n')}`
  } catch {
    // modulo knowledge/search ou tabelas podem nao existir ainda
    return null
  }
}

async function _statsKnowledge(): Promise<string | null> {
  try {
    const sources = await queryOne<{ count: number }>(
      'SELECT COUNT(*)::int as count FROM knowledge_sources'
    )
    if (!sources?.count) return null
    const chunks = await queryOne<{ count: number }>(
      'SELECT COUNT(*)::int as count FROM knowledge_chunks'
    )
    return `\n### Base de Conhecimento\n- ${sources.count} fonte(s) | ${chunks?.count ?? 0} chunks indexados`
  } catch {
    // tabelas knowledge_* podem nao existir ainda (Phase 3)
    return null
  }
}

function _dicaPagina(
  pagina:
    | 'dashboard'
    | 'produtos'
    | 'editor'
    | 'historico'
    | 'galeria'
    | 'configuracoes'
    | 'ia'
    | 'outro'
): string {
  const dicas: Record<string, string> = {
    dashboard:
      '\nDica: O usuario esta no Dashboard. Visao geral. Pode querer status geral ou comecar novo jornal.',
    produtos:
      '\nDica: O usuario esta na lista de produtos. Pode querer buscar, cadastrar ou ver imagens.',
    editor:
      '\nDica: O usuario esta no editor do jornal. Pode querer trocar itens, ajustar layout ou exportar.',
    historico:
      '\nDica: O usuario esta no historico de jornais. Pode querer comparar jornais ou ver precos anteriores.',
    galeria:
      '\nDica: O usuario esta na galeria de imagens. Pode querer buscar ou associar imagens.',
    configuracoes:
      '\nDica: O usuario esta nas configuracoes. Pode querer alterar dados da loja ou config IA.',
    ia: '\nDica: O usuario esta no chat IA. Pode ter qualquer duvida sobre o sistema.',
  }
  return dicas[pagina] || ''
}
