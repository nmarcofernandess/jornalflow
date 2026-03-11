import { tipc } from '@egoist/tipc/main'
import {
  listarProdutos,
  buscarProdutos,
  criarProduto,
  atualizarProduto,
  porCodigo,
  deletarProduto
} from './servicos/produtos'

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
    })
}

export type Router = typeof router
