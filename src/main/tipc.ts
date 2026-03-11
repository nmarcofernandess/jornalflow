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
  listarRascunhos
} from './servicos/jornais'
import { importarPlanilha } from './import/flow'

const t = tipc.create()

export const router = {
  'app.health': t.procedure.action(async () => {
    return { status: 'ok' as const, timestamp: new Date().toISOString() }
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
    })
}

export type Router = typeof router
