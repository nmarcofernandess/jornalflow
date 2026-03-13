import { tool } from 'ai'
import { z } from 'zod'
import path from 'node:path'
import { queryAll, queryOne, execute } from '../db/query'
import {
  buscarProdutos,
  criarProduto,
  atualizarProduto
} from '../servicos/produtos'
import { listarImagens, definirDefault } from '../servicos/imagens'
import { atualizarItem } from '../servicos/jornais'
import { buildModelFactory } from './config'
import { analisarProdutoImagem } from './vision'
import { getDataDir } from '../db/database'
import type { Produto, ProdutoImagem, IaConfiguracao } from '../../shared/types'

// ── 3-Status Tool Result Pattern ────────────────────────────────

type ToolStatus = 'ok' | 'vazio' | 'erro'

interface ToolMeta {
  tool_name: string
  elapsed_ms: number
  count?: number
}

function toolResult(
  status: ToolStatus,
  summary: string,
  data: any,
  meta?: ToolMeta
) {
  return { status, summary, data, _meta: meta }
}

// ── Tools ───────────────────────────────────────────────────────

export const iaTools = {
  buscar_produtos: tool({
    description:
      'Busca produtos no catálogo por nome, código ou categoria. Use para responder perguntas sobre o que tem no banco.',
    inputSchema: z.object({
      termo: z.string().describe('Termo de busca: nome do produto, código ou categoria')
    }),
    execute: async ({ termo }) => {
      const start = Date.now()
      try {
        const results = await buscarProdutos(termo)
        if (results.length === 0)
          return toolResult('vazio', `Nenhum produto encontrado para "${termo}"`, null, {
            tool_name: 'buscar_produtos', elapsed_ms: Date.now() - start
          })
        const produtos = results.slice(0, 20).map((p) => ({
          produto_id: p.produto_id,
          codigo: p.codigo,
          nome: p.nome,
          unidade: p.unidade,
          categoria: p.categoria
        }))
        return toolResult('ok', `${produtos.length} produtos encontrados para "${termo}"`, {
          total: results.length,
          produtos
        }, {
          tool_name: 'buscar_produtos', elapsed_ms: Date.now() - start, count: produtos.length
        })
      } catch (err) {
        return toolResult('erro', (err as Error).message, null, {
          tool_name: 'buscar_produtos', elapsed_ms: Date.now() - start
        })
      }
    }
  }),

  ver_produto: tool({
    description: 'Mostra detalhes de um produto específico, incluindo imagens cadastradas.',
    inputSchema: z.object({
      produto_id: z.number().describe('ID do produto')
    }),
    execute: async ({ produto_id }) => {
      const start = Date.now()
      try {
        const produto = await queryOne<Produto>(
          'SELECT * FROM produtos WHERE produto_id = $1',
          [produto_id]
        )
        if (!produto)
          return toolResult('erro', `Produto ID ${produto_id} não encontrado`, null, {
            tool_name: 'ver_produto', elapsed_ms: Date.now() - start
          })
        const imagens = await listarImagens(produto_id)
        return toolResult('ok', `Produto: ${produto.nome}`, {
          ...produto,
          imagens: imagens.map((i) => ({
            imagem_id: i.imagem_id,
            variacao: i.variacao,
            is_default: i.is_default
          })),
          total_imagens: imagens.length
        }, {
          tool_name: 'ver_produto', elapsed_ms: Date.now() - start
        })
      } catch (err) {
        return toolResult('erro', (err as Error).message, null, {
          tool_name: 'ver_produto', elapsed_ms: Date.now() - start
        })
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
      const start = Date.now()
      try {
        const produto = await criarProduto({ codigo, nome, unidade, nome_card, categoria })
        return toolResult('ok', `Produto "${produto.nome}" cadastrado (ID: ${produto.produto_id})`, {
          produto: {
            produto_id: produto.produto_id,
            codigo: produto.codigo,
            nome: produto.nome
          }
        }, {
          tool_name: 'cadastrar_produto', elapsed_ms: Date.now() - start
        })
      } catch (err) {
        return toolResult('erro', (err as Error).message, null, {
          tool_name: 'cadastrar_produto', elapsed_ms: Date.now() - start
        })
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
      const start = Date.now()
      try {
        const updated = await atualizarProduto(produto_id, changes)
        return toolResult('ok', `Produto "${updated.nome}" atualizado (ID: ${updated.produto_id})`, {
          produto: {
            produto_id: updated.produto_id,
            nome: updated.nome,
            unidade: updated.unidade
          }
        }, {
          tool_name: 'atualizar_produto', elapsed_ms: Date.now() - start
        })
      } catch (err) {
        return toolResult('erro', (err as Error).message, null, {
          tool_name: 'atualizar_produto', elapsed_ms: Date.now() - start
        })
      }
    }
  }),

  listar_imagens: tool({
    description: 'Lista todas as imagens cadastradas de um produto.',
    inputSchema: z.object({
      produto_id: z.number().describe('ID do produto')
    }),
    execute: async ({ produto_id }) => {
      const start = Date.now()
      try {
        const imagens = await listarImagens(produto_id)
        if (imagens.length === 0)
          return toolResult('vazio', `Nenhuma imagem para produto ID ${produto_id}`, null, {
            tool_name: 'listar_imagens', elapsed_ms: Date.now() - start
          })
        return toolResult('ok', `${imagens.length} imagens para produto ID ${produto_id}`, {
          total: imagens.length,
          imagens: imagens.map((i) => ({
            imagem_id: i.imagem_id,
            variacao: i.variacao,
            is_default: i.is_default,
            arquivo_path: i.arquivo_path
          }))
        }, {
          tool_name: 'listar_imagens', elapsed_ms: Date.now() - start, count: imagens.length
        })
      } catch (err) {
        return toolResult('erro', (err as Error).message, null, {
          tool_name: 'listar_imagens', elapsed_ms: Date.now() - start
        })
      }
    }
  }),

  definir_imagem_default: tool({
    description: 'Define qual imagem é a padrão de um produto.',
    inputSchema: z.object({
      imagem_id: z.number().describe('ID da imagem a definir como padrão')
    }),
    execute: async ({ imagem_id }) => {
      const start = Date.now()
      try {
        await definirDefault(imagem_id)
        return toolResult('ok', `Imagem ID ${imagem_id} definida como padrão`, { imagem_id }, {
          tool_name: 'definir_imagem_default', elapsed_ms: Date.now() - start
        })
      } catch (err) {
        return toolResult('erro', (err as Error).message, null, {
          tool_name: 'definir_imagem_default', elapsed_ms: Date.now() - start
        })
      }
    }
  }),

  buscar_jornal_atual: tool({
    description: 'Busca o jornal em rascunho atual (se existir).',
    inputSchema: z.object({}),
    execute: async () => {
      const start = Date.now()
      try {
        const jornal = await queryOne<any>(
          "SELECT * FROM jornais WHERE status = 'rascunho' ORDER BY criado_em DESC LIMIT 1"
        )
        if (!jornal)
          return toolResult('vazio', 'Nenhum jornal em rascunho', null, {
            tool_name: 'buscar_jornal_atual', elapsed_ms: Date.now() - start
          })

        const itensCount = await queryOne<{ count: number }>(
          'SELECT COUNT(*)::int as count FROM jornal_itens WHERE jornal_id = $1',
          [jornal.jornal_id]
        )

        return toolResult('ok', `Jornal em rascunho: "${jornal.titulo}" (${itensCount?.count || 0} itens)`, {
          jornal: {
            jornal_id: jornal.jornal_id,
            titulo: jornal.titulo,
            tipo: jornal.tipo,
            data_inicio: jornal.data_inicio,
            data_fim: jornal.data_fim,
            status: jornal.status,
            total_itens: itensCount?.count || 0
          }
        }, {
          tool_name: 'buscar_jornal_atual', elapsed_ms: Date.now() - start
        })
      } catch (err) {
        return toolResult('erro', (err as Error).message, null, {
          tool_name: 'buscar_jornal_atual', elapsed_ms: Date.now() - start
        })
      }
    }
  }),

  status_importacao: tool({
    description: 'Mostra resumo da última importação de planilha.',
    inputSchema: z.object({}),
    execute: async () => {
      const start = Date.now()
      try {
        const imp = await queryOne<any>(
          'SELECT * FROM importacoes ORDER BY importacao_id DESC LIMIT 1'
        )
        if (!imp)
          return toolResult('vazio', 'Nenhuma importação realizada', null, {
            tool_name: 'status_importacao', elapsed_ms: Date.now() - start
          })
        return toolResult('ok', `Última importação: "${imp.arquivo_nome}" (${imp.total_itens} itens)`, {
          arquivo: imp.arquivo_nome,
          total: imp.total_itens,
          matched: imp.matched,
          fallbacks: imp.fallbacks,
          nao_encontrados: imp.nao_encontrados,
          data: imp.criado_em
        }, {
          tool_name: 'status_importacao', elapsed_ms: Date.now() - start
        })
      } catch (err) {
        return toolResult('erro', (err as Error).message, null, {
          tool_name: 'status_importacao', elapsed_ms: Date.now() - start
        })
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
      const start = Date.now()
      try {
        const item = await queryOne<any>(
          'SELECT * FROM jornal_itens WHERE item_id = $1',
          [item_id]
        )
        if (!item)
          return toolResult('erro', `Item ID ${item_id} não encontrado`, null, {
            tool_name: 'trocar_item', elapsed_ms: Date.now() - start
          })

        const produto = await queryOne<Produto>(
          'SELECT * FROM produtos WHERE produto_id = $1',
          [novo_produto_id]
        )
        if (!produto)
          return toolResult('erro', `Produto ID ${novo_produto_id} não encontrado`, null, {
            tool_name: 'trocar_item', elapsed_ms: Date.now() - start
          })

        // Find default image for the new product
        const defaultImg = await queryOne<ProdutoImagem>(
          'SELECT * FROM produto_imagens WHERE produto_id = $1 AND is_default = true',
          [novo_produto_id]
        )

        await atualizarItem(item_id, {
          produto_id: novo_produto_id,
          imagem_id: defaultImg?.imagem_id ?? null
        })

        return toolResult('ok', `Item ${item_id} trocado para "${produto.nome}"`, {
          item_id,
          novo_produto: { produto_id: produto.produto_id, nome: produto.nome },
          imagem_id: defaultImg?.imagem_id ?? null
        }, {
          tool_name: 'trocar_item', elapsed_ms: Date.now() - start
        })
      } catch (err) {
        return toolResult('erro', (err as Error).message, null, {
          tool_name: 'trocar_item', elapsed_ms: Date.now() - start
        })
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
      const start = Date.now()
      try {
        const item = await queryOne<any>(
          'SELECT * FROM jornal_itens WHERE item_id = $1',
          [item_id]
        )
        if (!item)
          return toolResult('erro', `Item ID ${item_id} não encontrado`, null, {
            tool_name: 'atualizar_item', elapsed_ms: Date.now() - start
          })

        const changes: Record<string, unknown> = {}
        if (preco_oferta !== undefined) changes.preco_oferta = preco_oferta
        if (preco_clube !== undefined) changes.preco_clube = preco_clube
        if (imagem_id !== undefined) changes.imagem_id = imagem_id

        if (Object.keys(changes).length === 0)
          return toolResult('erro', 'Nenhum campo para atualizar', null, {
            tool_name: 'atualizar_item', elapsed_ms: Date.now() - start
          })

        await atualizarItem(item_id, changes)
        return toolResult('ok', `Item ${item_id} atualizado: ${Object.keys(changes).join(', ')}`, {
          item_id, atualizado: Object.keys(changes)
        }, {
          tool_name: 'atualizar_item', elapsed_ms: Date.now() - start
        })
      } catch (err) {
        return toolResult('erro', (err as Error).message, null, {
          tool_name: 'atualizar_item', elapsed_ms: Date.now() - start
        })
      }
    }
  }),

  buscar_historico: tool({
    description:
      'Lista jornais passados em ordem decrescente de data. Use para consultar edições anteriores.',
    inputSchema: z.object({
      limite: z.number().optional().describe('Quantidade máxima de resultados (padrão: 10)')
    }),
    execute: async ({ limite }) => {
      const start = Date.now()
      try {
        const limit = limite ?? 10
        const jornais = await queryAll<any>(
          'SELECT * FROM jornais ORDER BY data_inicio DESC LIMIT $1',
          [limit]
        )
        if (jornais.length === 0)
          return toolResult('vazio', 'Nenhum jornal encontrado', null, {
            tool_name: 'buscar_historico', elapsed_ms: Date.now() - start
          })
        const mapped = jornais.map((j) => ({
          jornal_id: j.jornal_id,
          titulo: j.titulo,
          tipo: j.tipo,
          data_inicio: j.data_inicio,
          data_fim: j.data_fim,
          status: j.status
        }))
        return toolResult('ok', `${mapped.length} jornais encontrados`, {
          total: mapped.length,
          jornais: mapped
        }, {
          tool_name: 'buscar_historico', elapsed_ms: Date.now() - start, count: mapped.length
        })
      } catch (err) {
        return toolResult('erro', (err as Error).message, null, {
          tool_name: 'buscar_historico', elapsed_ms: Date.now() - start
        })
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
      const start = Date.now()
      try {
        const produto = await queryOne<Produto>(
          'SELECT * FROM produtos WHERE produto_id = $1',
          [produto_id]
        )
        if (!produto)
          return toolResult('erro', `Produto ID ${produto_id} não encontrado`, null, {
            tool_name: 'comparar_precos', elapsed_ms: Date.now() - start
          })

        const historico = await queryAll<any>(
          `SELECT ji.preco_oferta, ji.preco_clube, j.data_inicio, j.titulo
           FROM jornal_itens ji
           JOIN jornais j ON j.jornal_id = ji.jornal_id
           WHERE ji.produto_id = $1
           ORDER BY j.data_inicio`,
          [produto_id]
        )

        if (historico.length === 0)
          return toolResult('vazio', `Produto "${produto.nome}" nunca apareceu em nenhum jornal`, null, {
            tool_name: 'comparar_precos', elapsed_ms: Date.now() - start
          })

        return toolResult('ok', `${historico.length} edições com "${produto.nome}"`, {
          produto: { produto_id: produto.produto_id, nome: produto.nome },
          total_edicoes: historico.length,
          historico: historico.map((h) => ({
            data_inicio: h.data_inicio,
            titulo: h.titulo,
            preco_oferta: h.preco_oferta,
            preco_clube: h.preco_clube
          }))
        }, {
          tool_name: 'comparar_precos', elapsed_ms: Date.now() - start, count: historico.length
        })
      } catch (err) {
        return toolResult('erro', (err as Error).message, null, {
          tool_name: 'comparar_precos', elapsed_ms: Date.now() - start
        })
      }
    }
  }),

  listar_secoes: tool({
    description:
      'Lista as seções do jornal em rascunho atual, com contagem de itens em cada uma.',
    inputSchema: z.object({}),
    execute: async () => {
      const start = Date.now()
      try {
        const jornal = await queryOne<any>(
          "SELECT * FROM jornais WHERE status = 'rascunho' ORDER BY criado_em DESC LIMIT 1"
        )
        if (!jornal)
          return toolResult('vazio', 'Nenhum jornal em rascunho', null, {
            tool_name: 'listar_secoes', elapsed_ms: Date.now() - start
          })

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

        const mapped = secoes.map((s) => ({
          jornal_secao_id: s.jornal_secao_id,
          nome: s.nome_custom ?? s.template_nome ?? 'Sem nome',
          template_slug: s.template_slug,
          posicao: s.posicao,
          lado: s.lado,
          grid: `${s.grid_cols}x${s.grid_rows}`,
          total_itens: s.total_itens
        }))

        return toolResult('ok', `${mapped.length} seções no jornal "${jornal.titulo}"`, {
          jornal_id: jornal.jornal_id,
          titulo: jornal.titulo,
          total_secoes: mapped.length,
          secoes: mapped
        }, {
          tool_name: 'listar_secoes', elapsed_ms: Date.now() - start, count: mapped.length
        })
      } catch (err) {
        return toolResult('erro', (err as Error).message, null, {
          tool_name: 'listar_secoes', elapsed_ms: Date.now() - start
        })
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
      const start = Date.now()
      try {
        const pagina = await queryOne<any>(
          'SELECT * FROM jornal_paginas WHERE jornal_id = $1 AND numero = $2',
          [jornal_id, pagina_numero]
        )
        if (!pagina)
          return toolResult('erro', `Página ${pagina_numero} não encontrada no jornal ${jornal_id}`, null, {
            tool_name: 'adicionar_secao', elapsed_ms: Date.now() - start
          })

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

        return toolResult('ok', `Seção "${nome}" adicionada na página ${pagina_numero}`, {
          secao: {
            jornal_secao_id: created!.jornal_secao_id,
            nome,
            posicao,
            grid: `${grid_cols ?? 3}x${grid_rows ?? 3}`
          }
        }, {
          tool_name: 'adicionar_secao', elapsed_ms: Date.now() - start
        })
      } catch (err) {
        return toolResult('erro', (err as Error).message, null, {
          tool_name: 'adicionar_secao', elapsed_ms: Date.now() - start
        })
      }
    }
  }),

  revisar_planilha: tool({
    description:
      'Revisa dados de uma planilha importada usando IA. Normaliza nomes, verifica preços e sugere correções. Use quando a usuária importar uma planilha e quiser que a IA revise os dados antes de gerar o jornal.',
    inputSchema: z.object({
      arquivo_path: z.string().describe('Caminho do arquivo (XLS, XLSX, CSV ou TSV)')
    }),
    execute: async ({ arquivo_path }) => {
      const start = Date.now()
      try {
        const { parseUploadedFile } = await import('../import/upload-handler')
        const { revisarImportacaoComIA } = await import('../import/ia-revisor')

        const parsed = parseUploadedFile(arquivo_path)
        if (parsed.rows.length === 0) {
          const reason = parsed.errors.length > 0
            ? `Erro ao parsear: ${parsed.errors[0].reason}`
            : 'Planilha vazia'
          return toolResult('erro', reason, null, {
            tool_name: 'revisar_planilha', elapsed_ms: Date.now() - start
          })
        }

        const revisao = await revisarImportacaoComIA(parsed.rows)

        return toolResult('ok', `Planilha revisada: ${parsed.rows.length} linhas, ${revisao.sugestoes.length} sugestões`, {
          formato: parsed.formato,
          total_linhas: parsed.rows.length,
          erros_parse: parsed.errors.length,
          sugestoes: revisao.sugestoes.length,
          resumo: revisao.resumo,
          detalhes_sugestoes: revisao.sugestoes.slice(0, 10)
        }, {
          tool_name: 'revisar_planilha', elapsed_ms: Date.now() - start
        })
      } catch (err) {
        return toolResult('erro', (err as Error).message, null, {
          tool_name: 'revisar_planilha', elapsed_ms: Date.now() - start
        })
      }
    }
  }),

  stats_banco: tool({
    description:
      'Mostra estatísticas gerais do banco: total de produtos, imagens, jornais, etc.',
    inputSchema: z.object({}),
    execute: async () => {
      const start = Date.now()
      try {
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

        const stats = {
          produtos_ativos: produtos?.count ?? 0,
          produtos_com_imagem: comImagens?.count ?? 0,
          total_imagens: totalImagens?.count ?? 0,
          total_jornais: totalJornais?.count ?? 0,
          jornais_rascunho: rascunhos?.count ?? 0
        }

        return toolResult('ok', `Stats: ${stats.produtos_ativos} produtos, ${stats.total_jornais} jornais`, stats, {
          tool_name: 'stats_banco', elapsed_ms: Date.now() - start
        })
      } catch (err) {
        return toolResult('erro', (err as Error).message, null, {
          tool_name: 'stats_banco', elapsed_ms: Date.now() - start
        })
      }
    }
  }),

  buscar_conhecimento: tool({
    description:
      'Busca na base de conhecimento do sistema (documentos, regras, padrões). Use quando o usuário perguntar sobre regras de layout, padrões de naming, fluxo de importação, ou qualquer conhecimento documental.',
    inputSchema: z.object({
      query: z.string().describe('Texto de busca (em português)'),
      limite: z.number().optional().describe('Número máximo de resultados (default: 5)')
    }),
    execute: async ({ query, limite }) => {
      const start = Date.now()
      try {
        const { searchKnowledge } = await import('../knowledge/search')
        const result = await searchKnowledge(query, { limite: limite ?? 5 })
        if (result.chunks.length === 0)
          return toolResult('vazio', `Nenhum conhecimento encontrado para "${query}"`, null, {
            tool_name: 'buscar_conhecimento', elapsed_ms: Date.now() - start
          })
        return toolResult('ok', `${result.chunks.length} resultados para "${query}"`, {
          total: result.chunks.length,
          context: result.context_for_llm,
          relacoes: result.relations.length > 0
            ? result.relations.map(r => `${r.from_nome} → ${r.to_nome} (${r.tipo_relacao})`)
            : undefined
        }, {
          tool_name: 'buscar_conhecimento', elapsed_ms: Date.now() - start, count: result.chunks.length
        })
      } catch (err) {
        return toolResult('erro', (err as Error).message, null, {
          tool_name: 'buscar_conhecimento', elapsed_ms: Date.now() - start
        })
      }
    }
  }),

  salvar_memoria: tool({
    description:
      'Salva uma memoria/nota importante para referencia futura. Use quando o usuario disser algo que vale lembrar para proximas conversas (preferencias, decisoes, regras especificas).',
    inputSchema: z.object({
      conteudo: z.string().describe('Texto da memoria a salvar')
    }),
    execute: async ({ conteudo }) => {
      const start = Date.now()
      try {
        const { insertReturningId } = await import('../db/query')
        const id = await insertReturningId(
          "INSERT INTO ia_memorias (conteudo, origem) VALUES ($1, 'manual')",
          [conteudo]
        )
        return toolResult('ok', `Memoria salva (ID: ${id})`, { id }, {
          tool_name: 'salvar_memoria', elapsed_ms: Date.now() - start
        })
      } catch (err) {
        return toolResult('erro', (err as Error).message, null, {
          tool_name: 'salvar_memoria', elapsed_ms: Date.now() - start
        })
      }
    }
  }),

  listar_memorias: tool({
    description:
      'Lista todas as memorias salvas (manuais e automaticas). Use quando o usuario perguntar o que voce lembra ou quiser revisar memorias.',
    inputSchema: z.object({}),
    execute: async () => {
      const start = Date.now()
      try {
        const { queryAll } = await import('../db/query')
        const memorias = await queryAll<{ id: number; conteudo: string; origem: string; atualizada_em: string }>(
          'SELECT id, conteudo, origem, atualizada_em FROM ia_memorias ORDER BY atualizada_em DESC',
          []
        )
        if (memorias.length === 0)
          return toolResult('vazio', 'Nenhuma memoria salva ainda', null, {
            tool_name: 'listar_memorias', elapsed_ms: Date.now() - start
          })
        return toolResult('ok', `${memorias.length} memorias encontradas`, {
          total: memorias.length,
          memorias: memorias.map(m => ({
            id: m.id,
            conteudo: m.conteudo,
            origem: m.origem,
            atualizada_em: m.atualizada_em
          }))
        }, {
          tool_name: 'listar_memorias', elapsed_ms: Date.now() - start, count: memorias.length
        })
      } catch (err) {
        return toolResult('erro', (err as Error).message, null, {
          tool_name: 'listar_memorias', elapsed_ms: Date.now() - start
        })
      }
    }
  }),

  remover_memoria: tool({
    description:
      'Remove uma memoria pelo ID. Use quando o usuario pedir para esquecer algo ou quando uma memoria estiver desatualizada.',
    inputSchema: z.object({
      id: z.number().describe('ID da memoria a remover')
    }),
    execute: async ({ id }) => {
      const start = Date.now()
      try {
        const { execute } = await import('../db/query')
        await execute('DELETE FROM ia_memorias WHERE id = $1', [id])
        return toolResult('ok', `Memoria ID ${id} removida`, { id }, {
          tool_name: 'remover_memoria', elapsed_ms: Date.now() - start
        })
      } catch (err) {
        return toolResult('erro', (err as Error).message, null, {
          tool_name: 'remover_memoria', elapsed_ms: Date.now() - start
        })
      }
    }
  }),

  explorar_relacoes: tool({
    description:
      'Explora relações entre entidades no grafo de conhecimento. Use quando quiser entender como conceitos se conectam (ex: quais produtos pertencem a uma seção, quais marcas competem).',
    inputSchema: z.object({
      entidade: z.string().describe('Nome da entidade para explorar (ex: "Açougue", "Arroz")'),
      profundidade: z.number().optional().describe('Profundidade de exploração (default: 2, max: 3)')
    }),
    execute: async ({ entidade, profundidade }) => {
      const start = Date.now()
      try {
        const { exploreRelations } = await import('../knowledge/search')
        const result = await exploreRelations(entidade, Math.min(profundidade ?? 2, 3))
        if (result.entidades.length === 0)
          return toolResult('vazio', `Nenhuma entidade encontrada para "${entidade}"`, null, {
            tool_name: 'explorar_relacoes', elapsed_ms: Date.now() - start
          })
        return toolResult('ok', `${result.entidades.length} entidades, ${result.relacoes.length} relações para "${entidade}"`, {
          entidade_raiz: entidade,
          total_entidades: result.entidades.length,
          total_relacoes: result.relacoes.length,
          entidades: result.entidades,
          relacoes: result.relacoes
        }, {
          tool_name: 'explorar_relacoes', elapsed_ms: Date.now() - start, count: result.entidades.length
        })
      } catch (err) {
        return toolResult('erro', (err as Error).message, null, {
          tool_name: 'explorar_relacoes', elapsed_ms: Date.now() - start
        })
      }
    }
  }),

  sugerir_produtos: tool({
    description:
      'Sugere produtos para preencher uma seção do jornal. Mostra produtos com imagem que NÃO estão no jornal atual, ordenados por frequência de uso em edições anteriores.',
    inputSchema: z.object({
      secao_slug: z.string().optional().describe('Slug da seção template para filtrar por aliases (ex: "acougue", "hortifruti")'),
      categoria: z.string().optional().describe('Categoria do produto para filtrar (ex: "carnes", "bebidas")'),
      limite: z.number().optional().describe('Número máximo de sugestões (padrão: 10)')
    }),
    execute: async ({ secao_slug, categoria, limite }) => {
      const start = Date.now()
      try {
        // Find current draft journal
        const jornal = await queryOne<{ jornal_id: number }>(
          "SELECT jornal_id FROM jornais WHERE status = 'rascunho' ORDER BY criado_em DESC LIMIT 1"
        )
        if (!jornal)
          return toolResult('vazio', 'Nenhum jornal em rascunho para sugerir produtos', null, {
            tool_name: 'sugerir_produtos', elapsed_ms: Date.now() - start
          })

        // Build dynamic query
        const params: unknown[] = [jornal.jornal_id]
        let paramIndex = 2
        const conditions: string[] = []

        if (categoria) {
          conditions.push(`AND LOWER(p.categoria) = LOWER($${paramIndex})`)
          params.push(categoria)
          paramIndex++
        }

        if (secao_slug) {
          conditions.push(
            `AND EXISTS (SELECT 1 FROM secao_aliases sa JOIN template_secoes ts ON ts.secao_id = sa.secao_id WHERE ts.slug = $${paramIndex} AND LOWER(sa.alias) = LOWER(p.categoria))`
          )
          params.push(secao_slug)
          paramIndex++
        }

        const lim = limite ?? 10
        params.push(lim)

        const sql = `
          SELECT p.produto_id, p.codigo, p.nome, p.nome_card, p.unidade, p.categoria,
                 COUNT(DISTINCT ji2.jornal_id)::int AS vezes_usado
          FROM produtos p
          JOIN produto_imagens pi ON pi.produto_id = p.produto_id AND pi.is_default = true
          LEFT JOIN jornal_itens ji2 ON ji2.produto_id = p.produto_id
          WHERE p.ativo = true
            AND p.produto_id NOT IN (
              SELECT produto_id FROM jornal_itens WHERE jornal_id = $1
            )
            ${conditions.join(' ')}
          GROUP BY p.produto_id, p.codigo, p.nome, p.nome_card, p.unidade, p.categoria
          ORDER BY vezes_usado DESC
          LIMIT $${paramIndex}
        `

        const sugestoes = await queryAll<{
          produto_id: number
          codigo: string
          nome: string
          nome_card: string | null
          unidade: string
          categoria: string | null
          vezes_usado: number
        }>(sql, params)

        if (sugestoes.length === 0) {
          const context = secao_slug ? `seção "${secao_slug}"` : categoria ? `categoria "${categoria}"` : 'geral'
          return toolResult('vazio', `Nenhuma sugestão encontrada para ${context}`, null, {
            tool_name: 'sugerir_produtos', elapsed_ms: Date.now() - start
          })
        }

        const context = secao_slug ? `seção "${secao_slug}"` : categoria ? `categoria "${categoria}"` : 'geral'
        return toolResult('ok', `${sugestoes.length} sugestões para ${context}`, {
          jornal_id: jornal.jornal_id,
          sugestoes: sugestoes.map((s) => ({
            produto_id: s.produto_id,
            codigo: s.codigo,
            nome: s.nome,
            nome_card: s.nome_card,
            unidade: s.unidade,
            categoria: s.categoria,
            vezes_usado: s.vezes_usado
          }))
        }, {
          tool_name: 'sugerir_produtos', elapsed_ms: Date.now() - start, count: sugestoes.length
        })
      } catch (err) {
        return toolResult('erro', (err as Error).message, null, {
          tool_name: 'sugerir_produtos', elapsed_ms: Date.now() - start
        })
      }
    }
  }),

  analisar_mix: tool({
    description:
      'Analisa o mix de produtos de um jornal: distribuição por categoria, seções vazias, produtos repetidos, produtos sem imagem.',
    inputSchema: z.object({
      jornal_id: z.number().describe('ID do jornal para analisar')
    }),
    execute: async ({ jornal_id }) => {
      const start = Date.now()
      try {
        // Distribution by category
        const distribuicao = await queryAll<{ categoria: string | null; total: number }>(
          `SELECT p.categoria, COUNT(*)::int as total
           FROM jornal_itens ji
           JOIN produtos p ON p.produto_id = ji.produto_id
           WHERE ji.jornal_id = $1
           GROUP BY p.categoria
           ORDER BY total DESC`,
          [jornal_id]
        )

        // Sections with item count vs grid capacity
        const secoes = await queryAll<{
          jornal_secao_id: number
          nome: string
          capacidade: number
          ocupados: number
        }>(
          `SELECT js.jornal_secao_id,
                  COALESCE(js.nome_custom, ts.nome_display, 'Sem nome') as nome,
                  (js.grid_cols * js.grid_rows)::int as capacidade,
                  COUNT(ji.item_id)::int as ocupados
           FROM jornal_secoes js
           LEFT JOIN template_secoes ts ON ts.secao_id = js.template_secao_id
           LEFT JOIN jornal_itens ji ON ji.jornal_secao_id = js.jornal_secao_id
           WHERE js.jornal_id = $1
           GROUP BY js.jornal_secao_id, nome, capacidade`,
          [jornal_id]
        )

        // Products without default image
        const sem_imagem = await queryAll<{ item_id: number; nome: string }>(
          `SELECT ji.item_id, p.nome
           FROM jornal_itens ji
           JOIN produtos p ON p.produto_id = ji.produto_id
           LEFT JOIN produto_imagens pi ON pi.produto_id = p.produto_id AND pi.is_default = true
           WHERE ji.jornal_id = $1 AND pi.imagem_id IS NULL`,
          [jornal_id]
        )

        // Duplicate products (same product in multiple sections)
        const duplicados = await queryAll<{ produto_id: number; nome: string; vezes: number }>(
          `SELECT p.produto_id, p.nome, COUNT(*)::int as vezes
           FROM jornal_itens ji
           JOIN produtos p ON p.produto_id = ji.produto_id
           WHERE ji.jornal_id = $1
           GROUP BY p.produto_id, p.nome
           HAVING COUNT(*) > 1`,
          [jornal_id]
        )

        const totalItens = distribuicao.reduce((sum, d) => sum + d.total, 0)
        const totalSecoes = secoes.length
        const alertas = sem_imagem.length + duplicados.length + secoes.filter((s) => s.ocupados === 0).length

        return toolResult(
          'ok',
          `Mix: ${totalItens} itens em ${totalSecoes} seções, ${alertas} alertas`,
          {
            jornal_id,
            distribuicao,
            secoes: secoes.map((s) => ({
              jornal_secao_id: s.jornal_secao_id,
              nome: s.nome,
              capacidade: s.capacidade,
              ocupados: s.ocupados,
              ocupacao_pct: s.capacidade > 0 ? Math.round((s.ocupados / s.capacidade) * 100) : 0
            })),
            sem_imagem,
            duplicados
          },
          {
            tool_name: 'analisar_mix', elapsed_ms: Date.now() - start, count: totalItens
          }
        )
      } catch (err) {
        return toolResult('erro', (err as Error).message, null, {
          tool_name: 'analisar_mix', elapsed_ms: Date.now() - start
        })
      }
    }
  }),

  comparar_jornais: tool({
    description:
      'Compara dois jornais: produtos em comum, novos, removidos e mudanças de preço.',
    inputSchema: z.object({
      jornal_id_a: z.number().describe('ID do primeiro jornal (referência/anterior)'),
      jornal_id_b: z.number().describe('ID do segundo jornal (novo/atual)')
    }),
    execute: async ({ jornal_id_a, jornal_id_b }) => {
      const start = Date.now()
      try {
        // Get both journals info
        const jornais = await queryAll<{ jornal_id: number; titulo: string; data_inicio: string }>(
          'SELECT jornal_id, titulo, data_inicio FROM jornais WHERE jornal_id IN ($1, $2)',
          [jornal_id_a, jornal_id_b]
        )
        const jornalA = jornais.find((j) => j.jornal_id === jornal_id_a)
        const jornalB = jornais.find((j) => j.jornal_id === jornal_id_b)

        if (!jornalA || !jornalB)
          return toolResult('erro', `Jornal(is) não encontrado(s): ${!jornalA ? jornal_id_a : ''} ${!jornalB ? jornal_id_b : ''}`.trim(), null, {
            tool_name: 'comparar_jornais', elapsed_ms: Date.now() - start
          })

        // Items from journal A
        const itensA = await queryAll<{ produto_id: number; nome: string; preco_oferta: number | null; preco_clube: number | null }>(
          `SELECT ji.produto_id, p.nome, ji.preco_oferta, ji.preco_clube
           FROM jornal_itens ji JOIN produtos p ON p.produto_id = ji.produto_id
           WHERE ji.jornal_id = $1`,
          [jornal_id_a]
        )

        // Items from journal B
        const itensB = await queryAll<{ produto_id: number; nome: string; preco_oferta: number | null; preco_clube: number | null }>(
          `SELECT ji.produto_id, p.nome, ji.preco_oferta, ji.preco_clube
           FROM jornal_itens ji JOIN produtos p ON p.produto_id = ji.produto_id
           WHERE ji.jornal_id = $1`,
          [jornal_id_b]
        )

        // Build sets for comparison
        const idsA = new Set(itensA.map((i) => i.produto_id))
        const idsB = new Set(itensB.map((i) => i.produto_id))
        const mapA = new Map(itensA.map((i) => [i.produto_id, i]))

        const em_comum = itensB.filter((i) => idsA.has(i.produto_id)).map((i) => ({
          produto_id: i.produto_id,
          nome: i.nome
        }))

        const novos = itensB.filter((i) => !idsA.has(i.produto_id)).map((i) => ({
          produto_id: i.produto_id,
          nome: i.nome
        }))

        const removidos = itensA.filter((i) => !idsB.has(i.produto_id)).map((i) => ({
          produto_id: i.produto_id,
          nome: i.nome
        }))

        const mudancas_preco = itensB
          .filter((b) => {
            const a = mapA.get(b.produto_id)
            return a && a.preco_oferta !== b.preco_oferta
          })
          .map((b) => {
            const a = mapA.get(b.produto_id)!
            return {
              produto_id: b.produto_id,
              nome: b.nome,
              preco_antes: a.preco_oferta,
              preco_depois: b.preco_oferta
            }
          })

        return toolResult(
          'ok',
          `${em_comum.length} em comum, ${novos.length} novos, ${removidos.length} removidos`,
          {
            jornal_a: { jornal_id: jornalA.jornal_id, titulo: jornalA.titulo, data_inicio: jornalA.data_inicio },
            jornal_b: { jornal_id: jornalB.jornal_id, titulo: jornalB.titulo, data_inicio: jornalB.data_inicio },
            em_comum,
            novos,
            removidos,
            mudancas_preco
          },
          {
            tool_name: 'comparar_jornais', elapsed_ms: Date.now() - start
          }
        )
      } catch (err) {
        return toolResult('erro', (err as Error).message, null, {
          tool_name: 'comparar_jornais', elapsed_ms: Date.now() - start
        })
      }
    }
  }),

  diagnosticar_jornal: tool({
    description:
      'Diagnóstico completo de um jornal com alertas categorizados (critical/warning/info): seções vazias, itens fallback, preços zerados, capacidade das seções, produtos sem imagem.',
    inputSchema: z.object({
      jornal_id: z.number().describe('ID do jornal para diagnosticar')
    }),
    execute: async ({ jornal_id }) => {
      const start = Date.now()
      try {
        const alertas: { nivel: 'critical' | 'warning' | 'info'; mensagem: string }[] = []

        // Items with zero/null price
        const precosZerados = await queryAll<{ item_id: number; nome: string }>(
          `SELECT ji.item_id, p.nome FROM jornal_itens ji
           JOIN produtos p ON p.produto_id = ji.produto_id
           WHERE ji.jornal_id = $1 AND (ji.preco_oferta IS NULL OR ji.preco_oferta = 0)`,
          [jornal_id]
        )
        for (const item of precosZerados) {
          alertas.push({ nivel: 'critical', mensagem: `Preço zerado/nulo: "${item.nome}" (item ${item.item_id})` })
        }

        // Fallback items
        const fallbacks = await queryAll<{ item_id: number; nome: string }>(
          `SELECT ji.item_id, p.nome FROM jornal_itens ji
           JOIN produtos p ON p.produto_id = ji.produto_id
           WHERE ji.jornal_id = $1 AND ji.is_fallback = true`,
          [jornal_id]
        )
        for (const item of fallbacks) {
          alertas.push({ nivel: 'critical', mensagem: `Item fallback (sem match na importação): "${item.nome}" (item ${item.item_id})` })
        }

        // Section capacity
        const secoes = await queryAll<{
          jornal_secao_id: number
          nome: string
          capacidade: number
          ocupados: number
        }>(
          `SELECT js.jornal_secao_id,
                  COALESCE(js.nome_custom, ts.nome_display, 'Sem nome') as nome,
                  (js.grid_cols * js.grid_rows)::int as capacidade,
                  COUNT(ji.item_id)::int as ocupados
           FROM jornal_secoes js
           LEFT JOIN template_secoes ts ON ts.secao_id = js.template_secao_id
           LEFT JOIN jornal_itens ji ON ji.jornal_secao_id = js.jornal_secao_id
           WHERE js.jornal_id = $1
           GROUP BY js.jornal_secao_id, nome, capacidade`,
          [jornal_id]
        )
        for (const secao of secoes) {
          if (secao.ocupados === 0) {
            alertas.push({ nivel: 'warning', mensagem: `Seção vazia: "${secao.nome}" (capacidade: ${secao.capacidade})` })
          } else if (secao.capacidade > 0 && secao.ocupados / secao.capacidade < 0.5) {
            const pct = Math.round((secao.ocupados / secao.capacidade) * 100)
            alertas.push({ nivel: 'warning', mensagem: `Seção "${secao.nome}" com baixa ocupação: ${secao.ocupados}/${secao.capacidade} (${pct}%)` })
          }
        }

        // Products without default image
        const semImagem = await queryAll<{ item_id: number; nome: string }>(
          `SELECT ji.item_id, p.nome
           FROM jornal_itens ji
           JOIN produtos p ON p.produto_id = ji.produto_id
           LEFT JOIN produto_imagens pi ON pi.produto_id = p.produto_id AND pi.is_default = true
           WHERE ji.jornal_id = $1 AND pi.imagem_id IS NULL`,
          [jornal_id]
        )
        for (const item of semImagem) {
          alertas.push({ nivel: 'warning', mensagem: `Produto sem imagem: "${item.nome}" (item ${item.item_id})` })
        }

        // General stats
        const totalItens = await queryOne<{ count: number }>(
          'SELECT COUNT(*)::int as count FROM jornal_itens WHERE jornal_id = $1',
          [jornal_id]
        )
        alertas.push({ nivel: 'info', mensagem: `Total: ${totalItens?.count ?? 0} itens em ${secoes.length} seções` })

        // Import stats (if available)
        const importacao = await queryOne<{
          arquivo_nome: string
          total_itens: number
          matched: number
          fallbacks: number
        }>(
          'SELECT arquivo_nome, total_itens, matched, fallbacks FROM importacoes WHERE jornal_id = $1 ORDER BY importacao_id DESC LIMIT 1',
          [jornal_id]
        )
        if (importacao) {
          alertas.push({
            nivel: 'info',
            mensagem: `Importação: "${importacao.arquivo_nome}" — ${importacao.matched}/${importacao.total_itens} matched, ${importacao.fallbacks} fallbacks`
          })
        }

        const criticals = alertas.filter((a) => a.nivel === 'critical').length
        const warnings = alertas.filter((a) => a.nivel === 'warning').length
        const infos = alertas.filter((a) => a.nivel === 'info').length

        return toolResult(
          'ok',
          `${alertas.length} alertas (${criticals} critical, ${warnings} warning, ${infos} info)`,
          {
            jornal_id,
            alertas,
            resumo: {
              total_itens: totalItens?.count ?? 0,
              total_secoes: secoes.length,
              criticals,
              warnings,
              infos
            }
          },
          {
            tool_name: 'diagnosticar_jornal', elapsed_ms: Date.now() - start, count: alertas.length
          }
        )
      } catch (err) {
        return toolResult('erro', (err as Error).message, null, {
          tool_name: 'diagnosticar_jornal', elapsed_ms: Date.now() - start
        })
      }
    }
  }),

  exportar_relatorio: tool({
    description:
      'Gera relatório consolidado de um jornal: produtos por seção, preços, status de imagens, e comparativo com jornal anterior (opcional).',
    inputSchema: z.object({
      jornal_id: z.number().describe('ID do jornal para gerar relatório'),
      incluir_comparativo: z.boolean().optional().describe('Se true, compara com o jornal anterior (padrão: false)')
    }),
    execute: async ({ jornal_id, incluir_comparativo }) => {
      const start = Date.now()
      try {
        // Journal info
        const jornal = await queryOne<{
          jornal_id: number
          titulo: string
          tipo: string
          data_inicio: string
          data_fim: string
          status: string
        }>(
          'SELECT jornal_id, titulo, tipo, data_inicio, data_fim, status FROM jornais WHERE jornal_id = $1',
          [jornal_id]
        )
        if (!jornal)
          return toolResult('erro', `Jornal ID ${jornal_id} não encontrado`, null, {
            tool_name: 'exportar_relatorio', elapsed_ms: Date.now() - start
          })

        // Sections with items
        const rows = await queryAll<{
          jornal_secao_id: number
          secao_nome: string | null
          item_id: number | null
          produto_nome: string | null
          codigo: string | null
          preco_oferta: number | null
          preco_clube: number | null
          is_fallback: boolean | null
          tem_imagem: boolean
        }>(
          `SELECT js.jornal_secao_id, COALESCE(js.nome_custom, ts.nome_display) as secao_nome,
                  ji.item_id, p.nome as produto_nome, p.codigo, ji.preco_oferta, ji.preco_clube,
                  ji.is_fallback,
                  CASE WHEN pi.imagem_id IS NOT NULL THEN true ELSE false END as tem_imagem
           FROM jornal_secoes js
           LEFT JOIN template_secoes ts ON ts.secao_id = js.template_secao_id
           LEFT JOIN jornal_itens ji ON ji.jornal_secao_id = js.jornal_secao_id
           LEFT JOIN produtos p ON p.produto_id = ji.produto_id
           LEFT JOIN produto_imagens pi ON pi.produto_id = p.produto_id AND pi.is_default = true
           WHERE js.jornal_id = $1
           ORDER BY js.posicao, ji.posicao`,
          [jornal_id]
        )

        // Group items by section
        const secoesMap = new Map<number, {
          jornal_secao_id: number
          nome: string
          itens: {
            item_id: number
            produto_nome: string
            codigo: string | null
            preco_oferta: number | null
            preco_clube: number | null
            is_fallback: boolean
            tem_imagem: boolean
          }[]
        }>()

        for (const row of rows) {
          if (!secoesMap.has(row.jornal_secao_id)) {
            secoesMap.set(row.jornal_secao_id, {
              jornal_secao_id: row.jornal_secao_id,
              nome: row.secao_nome ?? 'Sem nome',
              itens: []
            })
          }
          if (row.item_id !== null) {
            secoesMap.get(row.jornal_secao_id)!.itens.push({
              item_id: row.item_id,
              produto_nome: row.produto_nome ?? '',
              codigo: row.codigo,
              preco_oferta: row.preco_oferta,
              preco_clube: row.preco_clube,
              is_fallback: row.is_fallback ?? false,
              tem_imagem: row.tem_imagem
            })
          }
        }

        const secoes = Array.from(secoesMap.values())
        const totalItens = secoes.reduce((sum, s) => sum + s.itens.length, 0)
        const totalSecoes = secoes.length

        // Totals
        const totais = {
          total_itens: totalItens,
          total_secoes: totalSecoes,
          com_imagem: secoes.reduce((sum, s) => sum + s.itens.filter((i) => i.tem_imagem).length, 0),
          sem_imagem: secoes.reduce((sum, s) => sum + s.itens.filter((i) => !i.tem_imagem).length, 0),
          fallbacks: secoes.reduce((sum, s) => sum + s.itens.filter((i) => i.is_fallback).length, 0)
        }

        // Optional: comparison with previous journal
        let comparativo: {
          jornal_anterior: { jornal_id: number; titulo: string }
          em_comum: number
          novos: number
          removidos: number
        } | undefined

        if (incluir_comparativo) {
          const anterior = await queryOne<{ jornal_id: number; titulo: string }>(
            `SELECT jornal_id, titulo FROM jornais
             WHERE data_inicio < (SELECT data_inicio FROM jornais WHERE jornal_id = $1)
             ORDER BY data_inicio DESC LIMIT 1`,
            [jornal_id]
          )

          if (anterior) {
            const itensAnteriores = await queryAll<{ produto_id: number }>(
              'SELECT produto_id FROM jornal_itens WHERE jornal_id = $1',
              [anterior.jornal_id]
            )
            const itensAtuais = await queryAll<{ produto_id: number }>(
              'SELECT produto_id FROM jornal_itens WHERE jornal_id = $1',
              [jornal_id]
            )

            const idsAnt = new Set(itensAnteriores.map((i) => i.produto_id))
            const idsAtual = new Set(itensAtuais.map((i) => i.produto_id))

            comparativo = {
              jornal_anterior: { jornal_id: anterior.jornal_id, titulo: anterior.titulo },
              em_comum: itensAtuais.filter((i) => idsAnt.has(i.produto_id)).length,
              novos: itensAtuais.filter((i) => !idsAnt.has(i.produto_id)).length,
              removidos: itensAnteriores.filter((i) => !idsAtual.has(i.produto_id)).length
            }
          }
        }

        return toolResult(
          'ok',
          `Relatório do jornal "${jornal.titulo}": ${totalItens} itens em ${totalSecoes} seções`,
          {
            jornal,
            secoes,
            totais,
            comparativo
          },
          {
            tool_name: 'exportar_relatorio', elapsed_ms: Date.now() - start, count: totalItens
          }
        )
      } catch (err) {
        return toolResult('erro', (err as Error).message, null, {
          tool_name: 'exportar_relatorio', elapsed_ms: Date.now() - start
        })
      }
    }
  }),

  analisar_imagem_produto: tool({
    description:
      'Analisa uma imagem de produto usando Vision AI para sugerir nome, marca, peso e categoria. Use quando o usuario pedir para analisar/identificar um produto pela foto.',
    inputSchema: z.object({
      imagem_id: z.number().describe('ID da imagem do produto para analisar via Vision AI')
    }),
    execute: async ({ imagem_id }) => {
      const startMs = Date.now()
      try {
        // 1. Buscar ProdutoImagem no DB
        const imagem = await queryOne<ProdutoImagem>(
          'SELECT * FROM produto_imagens WHERE imagem_id = $1',
          [imagem_id]
        )
        if (!imagem) {
          return toolResult('vazio', 'Imagem não encontrada', null, {
            tool_name: 'analisar_imagem_produto', elapsed_ms: Date.now() - startMs
          })
        }

        // 2. Resolver path absoluto
        const filePath = path.isAbsolute(imagem.arquivo_path)
          ? imagem.arquivo_path
          : path.join(getDataDir(), imagem.arquivo_path)

        // 3. Carregar config IA
        const config = await queryOne<IaConfiguracao>(
          'SELECT * FROM configuracao_ia LIMIT 1'
        )
        if (!config) {
          return toolResult('erro', 'Configuração de IA não encontrada', null, {
            tool_name: 'analisar_imagem_produto', elapsed_ms: Date.now() - startMs
          })
        }

        // 4. Build model factory
        const factory = buildModelFactory(config)
        if (!factory) {
          return toolResult('erro', 'API key não configurada', null, {
            tool_name: 'analisar_imagem_produto', elapsed_ms: Date.now() - startMs
          })
        }

        // 5. Chamar analisarProdutoImagem
        const resultado = await analisarProdutoImagem(filePath, factory.createModel, factory.modelo)

        return toolResult(
          'ok',
          `Análise concluída com confiança ${resultado.confianca}%`,
          resultado,
          { tool_name: 'analisar_imagem_produto', elapsed_ms: Date.now() - startMs, count: 1 }
        )
      } catch (err: any) {
        return toolResult('erro', `Falha na análise: ${err.message}`, null, {
          tool_name: 'analisar_imagem_produto', elapsed_ms: Date.now() - startMs
        })
      }
    }
  })
}
