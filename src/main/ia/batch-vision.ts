import path from 'node:path'
import type { LanguageModel } from 'ai'
import type { VisionBatchSummary } from '../../shared/types'
import { broadcastToRenderer } from './cliente'
import { getDataDir } from '../db/database'
import { queryAll } from '../db/query'
import { analisarProdutoImagem } from './vision'

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

interface ProdutoComImagemRow {
  produto_id: number
  nome: string
  imagem_id: number
  arquivo_path: string
}

// ---------------------------------------------------------------------------
// analisarBatch — processa produtos com imagens sequencialmente via Vision AI
// Emite eventos de progresso via broadcastToRenderer('vision:progress', ...)
// ---------------------------------------------------------------------------

/**
 * Processa um lote de produtos com imagem usando Vision AI.
 *
 * @param options.produto_ids  - IDs especificos de produtos a analisar (opcional)
 * @param options.limite       - Limite de produtos quando nao ha IDs especificos (default: 30)
 * @param options.createModel  - Factory de modelo (de buildModelFactory)
 * @param options.modelo       - Identificador do modelo a usar
 * @returns VisionBatchSummary com totais e resultados por produto
 */
export async function analisarBatch(options: {
  produto_ids?: number[]
  limite?: number
  createModel: (m: string) => LanguageModel
  modelo: string
}): Promise<VisionBatchSummary> {
  const { produto_ids, limite = 30, createModel, modelo } = options

  let itens: ProdutoComImagemRow[]

  if (produto_ids && produto_ids.length > 0) {
    const placeholders = produto_ids.map((_, i) => `$${i + 1}`).join(', ')
    itens = await queryAll<ProdutoComImagemRow>(
      `SELECT p.produto_id, p.nome, pi.imagem_id, pi.arquivo_path
       FROM produtos p
       INNER JOIN produto_imagens pi ON pi.produto_id = p.produto_id AND pi.is_default = true
       WHERE p.produto_id IN (${placeholders})`,
      produto_ids as unknown[]
    )
  } else {
    itens = await queryAll<ProdutoComImagemRow>(
      `SELECT p.produto_id, p.nome, pi.imagem_id, pi.arquivo_path
       FROM produtos p
       INNER JOIN produto_imagens pi ON pi.produto_id = p.produto_id AND pi.is_default = true
       ORDER BY p.nome
       LIMIT $1`,
      [limite]
    )
  }

  const total = itens.length
  const summary: VisionBatchSummary = {
    total,
    sucesso: 0,
    falhas: 0,
    resultados: []
  }

  for (let i = 0; i < itens.length; i++) {
    const item = itens[i]
    const current = i + 1

    // Resolver caminho absoluto da imagem
    const arquivoPath = path.isAbsolute(item.arquivo_path)
      ? item.arquivo_path
      : path.join(getDataDir(), item.arquivo_path)

    const filename = path.basename(arquivoPath)

    try {
      const resultado = await analisarProdutoImagem(arquivoPath, createModel, modelo)

      summary.sucesso++
      summary.resultados.push({
        produto_id: item.produto_id,
        imagem_id: item.imagem_id,
        filename,
        resultado
      })

      broadcastToRenderer('vision:progress', {
        current,
        total,
        filename,
        produto_id: item.produto_id,
        resultado
      })
    } catch (err) {
      const erro = err instanceof Error ? err.message : String(err)

      summary.falhas++
      summary.resultados.push({
        produto_id: item.produto_id,
        imagem_id: item.imagem_id,
        filename,
        erro
      })

      broadcastToRenderer('vision:progress', {
        current,
        total,
        filename,
        produto_id: item.produto_id,
        erro
      })
    }

    // Delay entre chamadas para evitar rate limit
    if (i < itens.length - 1) {
      await new Promise<void>((r) => setTimeout(r, 200))
    }
  }

  return summary
}
