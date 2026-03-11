import { tool } from 'ai'
import { z } from 'zod'
import { queryAll, queryOne } from '../db/query'
import {
  buscarProdutos,
  criarProduto,
  atualizarProduto
} from '../servicos/produtos'
import { listarImagens, definirDefault } from '../servicos/imagens'
import type { Produto, ProdutoImagem } from '../../shared/types'

export const iaTools = {
  buscar_produtos: tool({
    description:
      'Busca produtos no catálogo por nome, código ou categoria. Use para responder perguntas sobre o que tem no banco.',
    parameters: z.object({
      termo: z.string().describe('Termo de busca: nome do produto, código ou categoria')
    }),
    execute: async ({ termo }) => {
      const results = await buscarProdutos(termo)
      if (results.length === 0)
        return { found: false as const, message: `Nenhum produto encontrado para "${termo}"` }
      return {
        found: true as const,
        total: results.length,
        produtos: results.slice(0, 20).map((p) => ({
          produto_id: p.produto_id,
          codigo: p.codigo,
          nome: p.nome,
          unidade: p.unidade,
          categoria: p.categoria
        }))
      }
    }
  }),

  ver_produto: tool({
    description: 'Mostra detalhes de um produto específico, incluindo imagens cadastradas.',
    parameters: z.object({
      produto_id: z.number().describe('ID do produto')
    }),
    execute: async ({ produto_id }) => {
      const produto = await queryOne<Produto>(
        'SELECT * FROM produtos WHERE produto_id = $1',
        [produto_id]
      )
      if (!produto) return { error: 'Produto não encontrado' }
      const imagens = await listarImagens(produto_id)
      return {
        ...produto,
        imagens: imagens.map((i) => ({
          imagem_id: i.imagem_id,
          variacao: i.variacao,
          is_default: i.is_default
        })),
        total_imagens: imagens.length
      }
    }
  }),

  cadastrar_produto: tool({
    description:
      'Cadastra um novo produto no banco. Use quando a usuária pedir para adicionar um produto.',
    parameters: z.object({
      codigo: z.string().describe('Código do produto (ex: "515", "6002")'),
      nome: z.string().describe('Nome completo do produto (ex: "CERVEJA CRYSTAL 350ML")'),
      unidade: z.string().describe('Unidade: KG, UN, PCT, LT, etc.'),
      nome_card: z.string().optional().describe('Nome curto para o card do jornal'),
      categoria: z.string().optional().describe('Categoria: carnes, hortifruti, mercearia, etc.')
    }),
    execute: async ({ codigo, nome, unidade, nome_card, categoria }) => {
      try {
        const produto = await criarProduto({ codigo, nome, unidade, nome_card, categoria })
        return {
          success: true as const,
          produto: {
            produto_id: produto.produto_id,
            codigo: produto.codigo,
            nome: produto.nome
          }
        }
      } catch (err: any) {
        return { success: false as const, error: err.message }
      }
    }
  }),

  atualizar_produto: tool({
    description:
      'Atualiza dados de um produto existente (nome, unidade, categoria, nome do card).',
    parameters: z.object({
      produto_id: z.number().describe('ID do produto a atualizar'),
      nome: z.string().optional().describe('Novo nome'),
      nome_card: z.string().optional().describe('Novo nome para o card'),
      unidade: z.string().optional().describe('Nova unidade'),
      categoria: z.string().optional().describe('Nova categoria')
    }),
    execute: async ({ produto_id, ...changes }) => {
      try {
        const updated = await atualizarProduto(produto_id, changes)
        return {
          success: true as const,
          produto: {
            produto_id: updated.produto_id,
            nome: updated.nome,
            unidade: updated.unidade
          }
        }
      } catch (err: any) {
        return { success: false as const, error: err.message }
      }
    }
  }),

  listar_imagens: tool({
    description: 'Lista todas as imagens cadastradas de um produto.',
    parameters: z.object({
      produto_id: z.number().describe('ID do produto')
    }),
    execute: async ({ produto_id }) => {
      const imagens = await listarImagens(produto_id)
      return {
        total: imagens.length,
        imagens: imagens.map((i) => ({
          imagem_id: i.imagem_id,
          variacao: i.variacao,
          is_default: i.is_default,
          arquivo_path: i.arquivo_path
        }))
      }
    }
  }),

  definir_imagem_default: tool({
    description: 'Define qual imagem é a padrão de um produto.',
    parameters: z.object({
      imagem_id: z.number().describe('ID da imagem a definir como padrão')
    }),
    execute: async ({ imagem_id }) => {
      try {
        await definirDefault(imagem_id)
        return { success: true as const }
      } catch (err: any) {
        return { success: false as const, error: err.message }
      }
    }
  }),

  buscar_jornal_atual: tool({
    description: 'Busca o jornal em rascunho atual (se existir).',
    parameters: z.object({}),
    execute: async () => {
      const jornal = await queryOne<any>(
        "SELECT * FROM jornais WHERE status = 'rascunho' ORDER BY criado_em DESC LIMIT 1"
      )
      if (!jornal) return { found: false as const, message: 'Nenhum jornal em rascunho' }

      const itensCount = await queryOne<{ count: number }>(
        'SELECT COUNT(*)::int as count FROM jornal_itens WHERE jornal_id = $1',
        [jornal.jornal_id]
      )

      return {
        found: true as const,
        jornal: {
          jornal_id: jornal.jornal_id,
          titulo: jornal.titulo,
          tipo: jornal.tipo,
          data_inicio: jornal.data_inicio,
          data_fim: jornal.data_fim,
          status: jornal.status,
          total_itens: itensCount?.count || 0
        }
      }
    }
  }),

  status_importacao: tool({
    description: 'Mostra resumo da última importação de planilha.',
    parameters: z.object({}),
    execute: async () => {
      const imp = await queryOne<any>(
        'SELECT * FROM importacoes ORDER BY importacao_id DESC LIMIT 1'
      )
      if (!imp) return { found: false as const, message: 'Nenhuma importação realizada' }
      return {
        found: true as const,
        arquivo: imp.arquivo_nome,
        total: imp.total_itens,
        matched: imp.matched,
        fallbacks: imp.fallbacks,
        nao_encontrados: imp.nao_encontrados,
        data: imp.criado_em
      }
    }
  })
}
