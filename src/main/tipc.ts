import { tipc } from '@egoist/tipc/main'
import { dialog, BrowserWindow, shell } from 'electron'
import {
  listarProdutos,
  buscarProdutos,
  criarProduto,
  atualizarProduto,
  porCodigo,
  deletarProduto
} from './servicos/produtos'
import {
  listarImagens,
  adicionarImagem,
  definirDefault,
  removerImagem,
  listarOrfas,
  atribuirAProduto,
  listarTodasImagens
} from './servicos/imagens'
import {
  carregarJornal,
  atualizarItem,
  listarRascunhos,
  listarJornais,
  buscarProdutoNoHistorico,
  dashboardStats,
  getLoja,
  atualizarLoja,
  criarJornalEspecial,
  adicionarPagina,
  adicionarSecao,
  adicionarItemASecao
} from './servicos/jornais'
import { importarPlanilha } from './import/flow'
import { parseUploadedFile } from './import/upload-handler'
import { revisarImportacaoComIA } from './import/ia-revisor'

const t = tipc.create()

export const router = {
  'app.health': t.procedure.action(async () => {
    return { status: 'ok' as const, timestamp: new Date().toISOString() }
  }),

  'dashboard.stats': t.procedure.action(async () => {
    return dashboardStats()
  }),

  'produtos.listar': t.procedure.action(async () => {
    return listarProdutos()
  }),

  'produtos.buscar': t.procedure
    .input<{ termo: string }>()
    .action(async ({ input }) => {
      return buscarProdutos(input.termo)
    }),

  'produtos.criar': t.procedure
    .input<{
      codigo: string
      nome: string
      unidade: string
      nome_card?: string
      categoria?: string
    }>()
    .action(async ({ input }) => {
      return criarProduto(input)
    }),

  'produtos.atualizar': t.procedure
    .input<{
      produto_id: number
      nome?: string
      nome_card?: string
      unidade?: string
      categoria?: string
    }>()
    .action(async ({ input }) => {
      const { produto_id, ...changes } = input
      return atualizarProduto(produto_id, changes)
    }),

  'produtos.por_codigo': t.procedure
    .input<{ codigo: string }>()
    .action(async ({ input }) => {
      return porCodigo(input.codigo)
    }),

  'produtos.deletar': t.procedure
    .input<{ produto_id: number }>()
    .action(async ({ input }) => {
      await deletarProduto(input.produto_id)
      return { ok: true }
    }),

  'imagens.listar': t.procedure
    .input<{ produto_id: number }>()
    .action(async ({ input }) => {
      return listarImagens(input.produto_id)
    }),

  'imagens.adicionar': t.procedure
    .input<{ produto_id: number; source_path: string; variacao?: string }>()
    .action(async ({ input }) => {
      return adicionarImagem(input.produto_id, input.source_path, input.variacao)
    }),

  'imagens.definir_default': t.procedure
    .input<{ imagem_id: number }>()
    .action(async ({ input }) => {
      await definirDefault(input.imagem_id)
      return { ok: true }
    }),

  'imagens.remover': t.procedure
    .input<{ imagem_id: number }>()
    .action(async ({ input }) => {
      await removerImagem(input.imagem_id)
      return { ok: true }
    }),

  'imagens.orfas': t.procedure.action(async () => {
    return listarOrfas()
  }),

  'imagens.atribuir': t.procedure
    .input<{ imagem_id: number; produto_id: number }>()
    .action(async ({ input }) => {
      return atribuirAProduto(input.imagem_id, input.produto_id)
    }),

  'imagens.todas': t.procedure.action(async () => {
    return listarTodasImagens()
  }),

  'import.planilha': t.procedure
    .input<{
      text: string
      data_inicio: string
      data_fim: string
      arquivo_nome: string
    }>()
    .action(async ({ input }) => {
      return importarPlanilha(input)
    }),

  // Parse any spreadsheet file (TSV, CSV, XLS, XLSX) — returns parsed rows for review
  'import.parse_arquivo': t.procedure
    .input<{ file_path: string }>()
    .action(async ({ input }) => {
      return parseUploadedFile(input.file_path)
    }),

  // IA reviews parsed rows and suggests corrections
  'import.revisar_ia': t.procedure
    .input<{ rows: Array<{ codigo: string; descricao: string; preco_oferta: number; tipo_oferta: string | null; preco_clube: number; unidade_extraida: string | null }> }>()
    .action(async ({ input }) => {
      return revisarImportacaoComIA(input.rows)
    }),

  // Full pipeline: parse file → IA review → import to journal
  'import.arquivo_completo': t.procedure
    .input<{
      file_path: string
      data_inicio: string
      data_fim: string
      usar_ia: boolean
    }>()
    .action(async ({ input }) => {
      // Step 1: Parse the file
      const parsed = parseUploadedFile(input.file_path)
      if (parsed.rows.length === 0) {
        return { success: false as const, parsed, revisao: null, import_result: null }
      }

      // Step 2: IA review (optional)
      let rowsParaImportar = parsed.rows
      let revisao = null
      if (input.usar_ia) {
        try {
          revisao = await revisarImportacaoComIA(parsed.rows)
          rowsParaImportar = revisao.rows_revisadas
        } catch (err: any) {
          revisao = { rows_revisadas: parsed.rows, sugestoes: [], resumo: `Erro na revisão IA: ${err.message}` }
        }
      }

      // Step 3: Convert back to text format for the existing import flow
      const header = 'Produto\tDescrição\tPreço Oferta\tTipo Oferta\tclube'
      const lines = rowsParaImportar.map(r =>
        `${r.codigo}\t${r.descricao}\t${r.preco_oferta.toFixed(2).replace('.', ',')}\t${r.tipo_oferta || ''}\t${r.preco_clube.toFixed(2).replace('.', ',')}`
      )
      const text = [header, ...lines].join('\n')

      // Step 4: Import using existing flow
      const import_result = await importarPlanilha({
        text,
        data_inicio: input.data_inicio,
        data_fim: input.data_fim,
        arquivo_nome: parsed.arquivo_nome
      })

      return { success: true as const, parsed, revisao, import_result }
    }),

  'import.batch_imagens': t.procedure
    .input<{ dir_path: string }>()
    .action(async ({ input }) => {
      const { importarImagensBatch } = await import('./import/batch-images')
      return importarImagensBatch(input.dir_path)
    }),

  'jornal.carregar': t.procedure
    .input<{ jornal_id: number }>()
    .action(async ({ input }) => {
      return carregarJornal(input.jornal_id)
    }),

  'jornal.atualizar_item': t.procedure
    .input<{ item_id: number; changes: Record<string, unknown> }>()
    .action(async ({ input }) => {
      await atualizarItem(input.item_id, input.changes)
      return { ok: true }
    }),

  'jornal.listar_rascunhos': t.procedure.action(async () => {
    return listarRascunhos()
  }),

  'jornal.criar_especial': t.procedure
    .input<{ titulo: string; data_inicio: string; data_fim: string }>()
    .action(async ({ input }) => {
      return criarJornalEspecial(input)
    }),

  'jornal.adicionar_pagina': t.procedure
    .input<{ jornal_id: number; layout?: 'full' | 'dupla' }>()
    .action(async ({ input }) => {
      return adicionarPagina(input.jornal_id, input.layout)
    }),

  'jornal.adicionar_secao': t.procedure
    .input<{
      jornal_id: number
      pagina_id: number
      nome_custom: string
      lado?: 'full' | 'esquerda' | 'direita'
      grid_cols?: number
      grid_rows?: number
    }>()
    .action(async ({ input }) => {
      return adicionarSecao(input)
    }),

  'jornal.adicionar_item': t.procedure
    .input<{
      jornal_id: number
      jornal_secao_id: number
      produto_id: number
      preco_oferta: number
      preco_clube?: number
    }>()
    .action(async ({ input }) => {
      await adicionarItemASecao(input)
      return { ok: true }
    }),

  'historico.listar': t.procedure.action(async () => {
    return listarJornais()
  }),

  'historico.detalhe': t.procedure
    .input<{ jornal_id: number }>()
    .action(async ({ input }) => {
      return carregarJornal(input.jornal_id)
    }),

  'historico.buscar_produto': t.procedure
    .input<{ produto_id: number }>()
    .action(async ({ input }) => {
      return buscarProdutoNoHistorico(input.produto_id)
    }),

  'export.gerar': t.procedure
    .input<{ jornal_id: number }>()
    .action(async ({ input }) => {
      const { exportAll } = await import('./export/cuts')
      return exportAll(input.jornal_id)
    }),

  'shell.abrir_pasta': t.procedure
    .input<{ caminho: string }>()
    .action(async ({ input }) => {
      await shell.openPath(input.caminho)
      return { ok: true }
    }),

  'shell.mostrar_no_finder': t.procedure
    .input<{ caminho: string }>()
    .action(async ({ input }) => {
      shell.showItemInFolder(input.caminho)
      return { ok: true }
    }),

  'config.get_loja': t.procedure.action(async () => {
    return getLoja()
  }),

  'config.atualizar_loja': t.procedure
    .input<{ changes: Record<string, unknown> }>()
    .action(async ({ input }) => {
      return atualizarLoja(input.changes)
    }),

  'config.db_stats': t.procedure.action(async () => {
    const { queryOne } = await import('./db/query')
    const produtos = await queryOne<{ count: number }>('SELECT COUNT(*)::int as count FROM produtos')
    const imagens = await queryOne<{ count: number }>('SELECT COUNT(*)::int as count FROM produto_imagens')
    const jornais = await queryOne<{ count: number }>('SELECT COUNT(*)::int as count FROM jornais')
    return {
      produtos: produtos?.count ?? 0,
      imagens: imagens?.count ?? 0,
      jornais: jornais?.count ?? 0
    }
  }),

  'ia.chat': t.procedure
    .input<{ messages: Array<{ role: 'user' | 'assistant'; content: string }> }>()
    .action(async ({ input }) => {
      const { chat } = await import('./ia/cliente')
      return { response: await chat(input.messages) }
    }),

  'ia.set_api_key': t.procedure
    .input<{ key: string }>()
    .action(async ({ input }) => {
      const { setApiKey } = await import('./ia/config')
      setApiKey(input.key)
      return { ok: true }
    }),

  'ia.get_api_key': t.procedure.action(async () => {
    const { getApiKey } = await import('./ia/config')
    return { key: getApiKey() }
  }),

  // --- IA v2: streaming + config handlers ---

  'ia.stream': t.procedure
    .input<{
      mensagem: string
      historico: Array<{
        id: string
        papel: 'usuario' | 'assistente' | 'tool_result'
        conteudo: string
        criada_em: string
        tool_calls?: Array<{ id: string; name: string; args?: Record<string, unknown>; result?: unknown }>
        anexos?: Array<{ tipo: 'image' | 'file'; nome: string; tamanho?: number; mime_type?: string; file_path?: string; data_base64?: string }>
      }>
      contexto?: { rota: string; pagina: string; jornal_id?: number; produto_id?: number }
      conversa_id?: string
      stream_id: string
    }>()
    .action(async ({ input }) => {
      const { iaEnviarMensagemStream } = await import('./ia/cliente')
      const result = await iaEnviarMensagemStream(
        input.mensagem,
        input.historico,
        input.stream_id,
        input.contexto as import('../shared/types').IaContexto | undefined,
        input.conversa_id
      )

      // Fire-and-forget: extract memories from conversation
      if (input.conversa_id && input.historico.length > 2) {
        Promise.all([
          import('./ia/session-processor'),
          import('./ia/config'),
          import('./db/query')
        ]).then(async ([{ extractMemories }, { buildModelFactory }, { queryOne }]) => {
          const config = await queryOne<import('../shared/types').IaConfiguracao>(
            'SELECT * FROM configuracao_ia LIMIT 1',
            []
          )
          if (!config) return
          const factory = buildModelFactory(config)
          if (!factory) return
          await extractMemories(
            input.conversa_id!,
            input.historico as import('../shared/types').IaMensagem[],
            factory.createModel,
            factory.modelo
          )
        }).catch((err: Error) => console.warn('[tipc] extractMemories falhou:', err.message))
      }

      return result
    }),

  'ia.config.get': t.procedure.action(async () => {
    const { queryOne } = await import('./db/query')
    return queryOne<import('../shared/types').IaConfiguracao>(
      'SELECT * FROM configuracao_ia LIMIT 1',
      []
    )
  }),

  'ia.config.save': t.procedure
    .input<{
      provider: string
      api_key?: string
      modelo?: string
      provider_configs_json?: string
    }>()
    .action(async ({ input }) => {
      const { execute } = await import('./db/query')
      await execute(
        `UPDATE configuracao_ia
         SET provider = $1,
             api_key = COALESCE($2, api_key),
             modelo = COALESCE($3, modelo),
             provider_configs_json = COALESCE($4, provider_configs_json)
         WHERE id = (SELECT id FROM configuracao_ia LIMIT 1)`,
        [input.provider, input.api_key ?? null, input.modelo ?? null, input.provider_configs_json ?? null]
      )
      return { ok: true }
    }),

  'ia.config.test': t.procedure
    .input<{ provider: string; api_key: string; modelo: string }>()
    .action(async ({ input }) => {
      const { iaTestarConexao } = await import('./ia/cliente')
      return iaTestarConexao(input.provider, input.api_key, input.modelo)
    }),

  'config.data_dir': t.procedure.action(async () => {
    const { getDataDir } = await import('./db/database')
    return { path: getDataDir() }
  }),

  'dialog.abrir_imagem': t.procedure.action(async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const result = await dialog.showOpenDialog(win, {
      title: 'Selecionar Imagem',
      filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return { canceled: true as const, path: null }
    return { canceled: false as const, path: result.filePaths[0] }
  }),

  'dialog.abrir_pasta': t.procedure.action(async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const result = await dialog.showOpenDialog(win, {
      title: 'Selecionar Pasta de Imagens',
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return { canceled: true as const, path: null }
    return { canceled: false as const, path: result.filePaths[0] }
  }),

  'dialog.abrir_planilha': t.procedure.action(async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const result = await dialog.showOpenDialog(win, {
      title: 'Selecionar Planilha',
      filters: [
        { name: 'Planilhas', extensions: ['xls', 'xlsx', 'csv', 'tsv', 'txt'] }
      ],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return { canceled: true as const, path: null }
    return { canceled: false as const, path: result.filePaths[0] }
  }),

  // ── Conversation CRUD ──────────────────────────────────────────

  'ia_conversas.listar': t.procedure
    .input<{ status?: string }>()
    .action(async ({ input }) => {
      const { queryAll } = await import('./db/query')
      if (input.status) {
        return queryAll<import('../shared/types').IaConversa>(
          'SELECT * FROM ia_conversas WHERE status = $1 ORDER BY atualizada_em DESC',
          [input.status]
        )
      }
      return queryAll<import('../shared/types').IaConversa>(
        'SELECT * FROM ia_conversas ORDER BY atualizada_em DESC'
      )
    }),

  'ia_conversas.criar': t.procedure
    .input<{ titulo?: string }>()
    .action(async ({ input }) => {
      const { execute } = await import('./db/query')
      const crypto = await import('node:crypto')
      const id = crypto.randomUUID()
      await execute(
        'INSERT INTO ia_conversas (id, titulo) VALUES ($1, $2)',
        [id, input.titulo ?? null]
      )
      return { id }
    }),

  'ia_conversas.arquivar': t.procedure
    .input<{ conversa_id: string }>()
    .action(async ({ input }) => {
      const { execute } = await import('./db/query')
      await execute(
        "UPDATE ia_conversas SET status = 'arquivada', atualizada_em = NOW() WHERE id = $1",
        [input.conversa_id]
      )
      return { ok: true }
    }),

  // ── Message CRUD ───────────────────────────────────────────────

  'ia_mensagens.listar': t.procedure
    .input<{ conversa_id: string }>()
    .action(async ({ input }) => {
      const { queryAll } = await import('./db/query')
      return queryAll<import('../shared/types').IaMensagemDB>(
        'SELECT * FROM ia_mensagens WHERE conversa_id = $1 ORDER BY criada_em ASC',
        [input.conversa_id]
      )
    }),

  'ia_mensagens.salvar': t.procedure
    .input<{
      conversa_id: string
      papel: string
      conteudo: string
      tool_calls_json?: string
      anexos_meta_json?: string
    }>()
    .action(async ({ input }) => {
      const { execute } = await import('./db/query')
      const crypto = await import('node:crypto')
      const id = crypto.randomUUID()
      await execute(
        `INSERT INTO ia_mensagens (id, conversa_id, papel, conteudo, tool_calls_json, anexos_meta_json)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          id,
          input.conversa_id,
          input.papel,
          input.conteudo,
          input.tool_calls_json ?? null,
          input.anexos_meta_json ?? null
        ]
      )
      await execute(
        'UPDATE ia_conversas SET atualizada_em = NOW() WHERE id = $1',
        [input.conversa_id]
      )
      return { id }
    }),

  // ── Knowledge ────────────────────────────────────────────────

  'ia.knowledge.search': t.procedure
    .input<{ query: string; limite?: number }>()
    .action(async ({ input }) => {
      const { searchKnowledge } = await import('./knowledge/search')
      return await searchKnowledge(input.query, { limite: input.limite })
    }),

  'ia.knowledge.ingest': t.procedure
    .input<{ titulo: string; conteudo: string; importance?: 'high' | 'low' }>()
    .action(async ({ input }) => {
      const { ingestKnowledge } = await import('./knowledge/ingest')
      return await ingestKnowledge(
        input.titulo,
        input.conteudo,
        input.importance ?? 'low'
      )
    }),

  'ia.knowledge.list': t.procedure
    .input<void>()
    .action(async () => {
      const { queryAll } = await import('./db/query')
      return await queryAll(
        'SELECT id, tipo, titulo, importance, ativo, criada_em FROM knowledge_sources ORDER BY criada_em DESC',
        []
      )
    }),

  // ── Memorias IA ────────────────────────────────────────────────

  'ia.memorias.listar': t.procedure
    .input<void>()
    .action(async () => {
      const { queryAll } = await import('./db/query')
      return await queryAll(
        'SELECT id, conteudo, origem, criada_em, atualizada_em FROM ia_memorias ORDER BY atualizada_em DESC',
        []
      )
    }),

  'ia.memorias.salvar': t.procedure
    .input<{ conteudo: string }>()
    .action(async ({ input }) => {
      const { insertReturningId } = await import('./db/query')
      const id = await insertReturningId(
        "INSERT INTO ia_memorias (conteudo, origem) VALUES ($1, 'manual')",
        [input.conteudo]
      )
      return { id }
    }),

  'ia.memorias.remover': t.procedure
    .input<{ id: number }>()
    .action(async ({ input }) => {
      const { execute } = await import('./db/query')
      await execute('DELETE FROM ia_memorias WHERE id = $1', [input.id])
      return { ok: true }
    }),

  // ── Knowledge Graph ────────────────────────────────────────────

  'ia.graph.rebuild': t.procedure
    .input<{ origem?: 'sistema' | 'usuario' }>()
    .action(async ({ input }) => {
      const { rebuildGraph } = await import('./knowledge/graph')
      const { buildModelFactory, resolveModel } = await import('./ia/config')
      const { queryOne } = await import('./db/query')
      const config = await queryOne<import('../shared/types').IaConfiguracao>(
        'SELECT * FROM configuracao_ia LIMIT 1',
        []
      )
      if (!config) throw new Error('IA não configurada')
      const factory = buildModelFactory(config)
      if (!factory) throw new Error('API key não configurada')
      const providerLabel = config.provider as 'gemini' | 'openrouter'
      return await rebuildGraph(
        factory.createModel,
        resolveModel(config, providerLabel),
        input.origem ?? 'usuario'
      )
    }),

  'ia.graph.stats': t.procedure
    .input<{ origem?: 'sistema' | 'usuario' }>()
    .action(async ({ input }) => {
      const { graphStats } = await import('./knowledge/graph')
      return await graphStats(input.origem)
    }),

  'ia.graph.explore': t.procedure
    .input<{ entidade: string; profundidade?: number }>()
    .action(async ({ input }) => {
      const { exploreRelations } = await import('./knowledge/search')
      return await exploreRelations(input.entidade, input.profundidade)
    }),

  // ── Vision AI ─────────────────────────────────────────────────

  'vision.analisar': t.procedure
    .input<{ imagem_id: number }>()
    .action(async ({ input }) => {
      try {
        const { queryOne } = await import('./db/query')
        const { getDataDir } = await import('./db/database')
        const { buildModelFactory } = await import('./ia/config')
        const path = await import('node:path')

        const imagem = await queryOne<import('../shared/types').ProdutoImagem>(
          'SELECT * FROM produto_imagens WHERE imagem_id = $1',
          [input.imagem_id]
        )
        if (!imagem) return { ok: false, erro: 'Imagem não encontrada' }

        const filePath = path.isAbsolute(imagem.arquivo_path)
          ? imagem.arquivo_path
          : path.join(getDataDir(), imagem.arquivo_path)

        const config = await queryOne<import('../shared/types').IaConfiguracao>(
          'SELECT * FROM configuracao_ia LIMIT 1',
          []
        )
        if (!config) return { ok: false, erro: 'IA não configurada' }

        const factory = buildModelFactory(config)
        if (!factory) return { ok: false, erro: 'API key não configurada' }

        const { analisarProdutoImagem } = await import('./ia/vision')
        const resultado = await analisarProdutoImagem(filePath, factory.createModel, factory.modelo)
        return { ok: true, resultado }
      } catch (err: any) {
        return { ok: false, erro: err.message }
      }
    }),

  'vision.batch': t.procedure
    .input<{ produto_ids?: number[]; limite?: number }>()
    .action(async ({ input }) => {
      try {
        const { buildModelFactory } = await import('./ia/config')
        const { queryOne } = await import('./db/query')

        const config = await queryOne<import('../shared/types').IaConfiguracao>(
          'SELECT * FROM configuracao_ia LIMIT 1',
          []
        )
        if (!config) return { ok: false, erro: 'IA não configurada' }

        const factory = buildModelFactory(config)
        if (!factory) return { ok: false, erro: 'API key não configurada' }

        const { analisarBatch } = await import('./ia/batch-vision')
        const resultado = await analisarBatch({
          produto_ids: input.produto_ids,
          limite: input.limite,
          createModel: factory.createModel,
          modelo: factory.modelo
        })
        return { ok: true, resultado }
      } catch (err: any) {
        return { ok: false, erro: err.message }
      }
    }),

  'vision.listar_com_imagem': t.procedure
    .input<void>()
    .action(async () => {
      const { queryAll } = await import('./db/query')
      return queryAll<{
        produto_id: number
        codigo: string
        nome: string
        nome_card: string | null
        categoria: string | null
        imagem_id: number
        arquivo_path: string
      }>(
        `SELECT p.produto_id, p.codigo, p.nome, p.nome_card, p.categoria,
                pi.imagem_id, pi.arquivo_path
         FROM produtos p
         INNER JOIN produto_imagens pi ON pi.produto_id = p.produto_id AND pi.is_default = true
         ORDER BY p.nome`,
        []
      )
    })
}

export type Router = typeof router
