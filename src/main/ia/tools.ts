import { tool } from 'ai'
import { z } from 'zod'
import { queryAll, queryOne, execute } from '../db/query'
import {
  buscarProdutos,
  criarProduto,
  atualizarProduto
} from '../servicos/produtos'
import { listarImagens, definirDefault } from '../servicos/imagens'
import { atualizarItem } from '../servicos/jornais'
import type { Produto, ProdutoImagem } from '../../shared/types'

export const iaTools = {
  buscar_produtos: tool({
    description:
      'Busca produtos no catálogo por nome, código ou categoria. Use para responder perguntas sobre o que tem no banco.',
    inputSchema: z.object({
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
    inputSchema: z.object({
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
    inputSchema: z.object({
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
    inputSchema: z.object({
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
    inputSchema: z.object({
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
    inputSchema: z.object({
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
    inputSchema: z.object({}),
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
    inputSchema: z.object({}),
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
  }),

  trocar_item: tool({
    description:
      'Troca o produto de um item do jornal. Recalcula a imagem padrão do novo produto.',
    inputSchema: z.object({
      item_id: z.number().describe('ID do item no jornal'),
      novo_produto_id: z.number().describe('ID do novo produto')
    }),
    execute: async ({ item_id, novo_produto_id }) => {
      const item = await queryOne<any>(
        'SELECT * FROM jornal_itens WHERE item_id = $1',
        [item_id]
      )
      if (!item) return { success: false as const, error: 'Item não encontrado' }

      const produto = await queryOne<Produto>(
        'SELECT * FROM produtos WHERE produto_id = $1',
        [novo_produto_id]
      )
      if (!produto) return { success: false as const, error: 'Produto não encontrado' }

      // Find default image for the new product
      const defaultImg = await queryOne<ProdutoImagem>(
        'SELECT * FROM produto_imagens WHERE produto_id = $1 AND is_default = true',
        [novo_produto_id]
      )

      await atualizarItem(item_id, {
        produto_id: novo_produto_id,
        imagem_id: defaultImg?.imagem_id ?? null
      })

      return {
        success: true as const,
        item_id,
        novo_produto: { produto_id: produto.produto_id, nome: produto.nome },
        imagem_id: defaultImg?.imagem_id ?? null
      }
    }
  }),

  atualizar_item: tool({
    description:
      'Atualiza preço, preço clube ou imagem de um item do jornal.',
    inputSchema: z.object({
      item_id: z.number().describe('ID do item no jornal'),
      preco_oferta: z.number().optional().describe('Novo preço de oferta'),
      preco_clube: z.number().optional().describe('Novo preço clube'),
      imagem_id: z.number().optional().describe('ID da nova imagem')
    }),
    execute: async ({ item_id, preco_oferta, preco_clube, imagem_id }) => {
      const item = await queryOne<any>(
        'SELECT * FROM jornal_itens WHERE item_id = $1',
        [item_id]
      )
      if (!item) return { success: false as const, error: 'Item não encontrado' }

      const changes: Record<string, unknown> = {}
      if (preco_oferta !== undefined) changes.preco_oferta = preco_oferta
      if (preco_clube !== undefined) changes.preco_clube = preco_clube
      if (imagem_id !== undefined) changes.imagem_id = imagem_id

      if (Object.keys(changes).length === 0) {
        return { success: false as const, error: 'Nenhum campo para atualizar' }
      }

      await atualizarItem(item_id, changes)
      return { success: true as const, item_id, atualizado: Object.keys(changes) }
    }
  }),

  buscar_historico: tool({
    description:
      'Lista jornais passados em ordem decrescente de data. Use para consultar edições anteriores.',
    inputSchema: z.object({
      limite: z.number().optional().describe('Quantidade máxima de resultados (padrão: 10)')
    }),
    execute: async ({ limite }) => {
      const limit = limite ?? 10
      const jornais = await queryAll<any>(
        'SELECT * FROM jornais ORDER BY data_inicio DESC LIMIT $1',
        [limit]
      )
      if (jornais.length === 0) return { found: false as const, message: 'Nenhum jornal encontrado' }
      return {
        found: true as const,
        total: jornais.length,
        jornais: jornais.map((j) => ({
          jornal_id: j.jornal_id,
          titulo: j.titulo,
          tipo: j.tipo,
          data_inicio: j.data_inicio,
          data_fim: j.data_fim,
          status: j.status
        }))
      }
    }
  }),

  comparar_precos: tool({
    description:
      'Compara o preço de um produto ao longo de diferentes edições do jornal.',
    inputSchema: z.object({
      produto_id: z.number().describe('ID do produto para comparar preços')
    }),
    execute: async ({ produto_id }) => {
      const produto = await queryOne<Produto>(
        'SELECT * FROM produtos WHERE produto_id = $1',
        [produto_id]
      )
      if (!produto) return { found: false as const, error: 'Produto não encontrado' }

      const historico = await queryAll<any>(
        `SELECT ji.preco_oferta, ji.preco_clube, j.data_inicio, j.titulo
         FROM jornal_itens ji
         JOIN jornais j ON j.jornal_id = ji.jornal_id
         WHERE ji.produto_id = $1
         ORDER BY j.data_inicio`,
        [produto_id]
      )

      if (historico.length === 0) {
        return { found: false as const, message: `Produto "${produto.nome}" nunca apareceu em nenhum jornal` }
      }

      return {
        found: true as const,
        produto: { produto_id: produto.produto_id, nome: produto.nome },
        total_edicoes: historico.length,
        historico: historico.map((h) => ({
          data_inicio: h.data_inicio,
          titulo: h.titulo,
          preco_oferta: h.preco_oferta,
          preco_clube: h.preco_clube
        }))
      }
    }
  }),

  listar_secoes: tool({
    description:
      'Lista as seções do jornal em rascunho atual, com contagem de itens em cada uma.',
    inputSchema: z.object({}),
    execute: async () => {
      const jornal = await queryOne<any>(
        "SELECT * FROM jornais WHERE status = 'rascunho' ORDER BY criado_em DESC LIMIT 1"
      )
      if (!jornal) return { found: false as const, message: 'Nenhum jornal em rascunho' }

      const secoes = await queryAll<any>(
        `SELECT js.jornal_secao_id, js.posicao, js.lado, js.grid_cols, js.grid_rows,
                js.nome_custom, ts.nome_display AS template_nome, ts.slug AS template_slug,
                COUNT(ji.item_id)::int AS total_itens
         FROM jornal_secoes js
         LEFT JOIN template_secoes ts ON ts.secao_id = js.template_secao_id
         LEFT JOIN jornal_itens ji ON ji.jornal_secao_id = js.jornal_secao_id
         WHERE js.jornal_id = $1
         GROUP BY js.jornal_secao_id, js.posicao, js.lado, js.grid_cols, js.grid_rows,
                  js.nome_custom, ts.nome_display, ts.slug
         ORDER BY js.posicao`,
        [jornal.jornal_id]
      )

      return {
        found: true as const,
        jornal_id: jornal.jornal_id,
        titulo: jornal.titulo,
        total_secoes: secoes.length,
        secoes: secoes.map((s) => ({
          jornal_secao_id: s.jornal_secao_id,
          nome: s.nome_custom ?? s.template_nome ?? 'Sem nome',
          template_slug: s.template_slug,
          posicao: s.posicao,
          lado: s.lado,
          grid: `${s.grid_cols}x${s.grid_rows}`,
          total_itens: s.total_itens
        }))
      }
    }
  }),

  adicionar_secao: tool({
    description:
      'Adiciona uma seção customizada a uma página do jornal.',
    inputSchema: z.object({
      jornal_id: z.number().describe('ID do jornal'),
      pagina_numero: z.number().describe('Número da página'),
      nome: z.string().describe('Nome da nova seção'),
      grid_cols: z.number().optional().describe('Colunas do grid (padrão: 3)'),
      grid_rows: z.number().optional().describe('Linhas do grid (padrão: 3)')
    }),
    execute: async ({ jornal_id, pagina_numero, nome, grid_cols, grid_rows }) => {
      const pagina = await queryOne<any>(
        'SELECT * FROM jornal_paginas WHERE jornal_id = $1 AND numero = $2',
        [jornal_id, pagina_numero]
      )
      if (!pagina) return { success: false as const, error: `Página ${pagina_numero} não encontrada no jornal ${jornal_id}` }

      // Get the next posicao value
      const maxPos = await queryOne<{ max_pos: number | null }>(
        'SELECT MAX(posicao) as max_pos FROM jornal_secoes WHERE jornal_id = $1',
        [jornal_id]
      )
      const posicao = (maxPos?.max_pos ?? 0) + 1

      await execute(
        `INSERT INTO jornal_secoes (jornal_id, pagina_id, posicao, grid_cols, grid_rows, nome_custom)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [jornal_id, pagina.pagina_id, posicao, grid_cols ?? 3, grid_rows ?? 3, nome]
      )

      const created = await queryOne<any>(
        'SELECT * FROM jornal_secoes WHERE jornal_id = $1 AND posicao = $2',
        [jornal_id, posicao]
      )

      return {
        success: true as const,
        secao: {
          jornal_secao_id: created!.jornal_secao_id,
          nome: nome,
          posicao,
          grid: `${grid_cols ?? 3}x${grid_rows ?? 3}`
        }
      }
    }
  }),

  stats_banco: tool({
    description:
      'Mostra estatísticas gerais do banco: total de produtos, imagens, jornais, etc.',
    inputSchema: z.object({}),
    execute: async () => {
      const [produtos, comImagens, totalImagens, totalJornais, rascunhos] = await Promise.all([
        queryOne<{ count: number }>('SELECT COUNT(*)::int as count FROM produtos WHERE ativo = true'),
        queryOne<{ count: number }>(
          `SELECT COUNT(DISTINCT p.produto_id)::int as count
           FROM produtos p
           JOIN produto_imagens pi ON pi.produto_id = p.produto_id
           WHERE p.ativo = true`
        ),
        queryOne<{ count: number }>('SELECT COUNT(*)::int as count FROM produto_imagens'),
        queryOne<{ count: number }>('SELECT COUNT(*)::int as count FROM jornais'),
        queryOne<{ count: number }>("SELECT COUNT(*)::int as count FROM jornais WHERE status = 'rascunho'")
      ])

      return {
        produtos_ativos: produtos?.count ?? 0,
        produtos_com_imagem: comImagens?.count ?? 0,
        total_imagens: totalImagens?.count ?? 0,
        total_jornais: totalJornais?.count ?? 0,
        jornais_rascunho: rascunhos?.count ?? 0
      }
    }
  })
}
