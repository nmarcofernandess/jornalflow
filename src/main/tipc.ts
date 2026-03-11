import { tipc } from '@egoist/tipc/main'
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
  removerImagem
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
      const { shell } = await import('electron')
      await shell.openPath(input.caminho)
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
  })
}

export type Router = typeof router
