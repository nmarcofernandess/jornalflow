import { client } from './client'
import type { AnaliseVisionProduto, VisionBatchSummary } from '@shared/types'

// === TYPES ===

export type ProdutoComImagem = {
  produto_id: number
  codigo: string
  nome: string
  nome_card: string | null
  categoria: string | null
  imagem_id: number
  arquivo_path: string
}

// === VISION AI ===

export async function analisarImagem(imagem_id: number): Promise<{ ok: boolean; resultado?: AnaliseVisionProduto; erro?: string }> {
  return client['vision.analisar']({ imagem_id })
}

export async function analisarBatch(options?: { produto_ids?: number[]; limite?: number }): Promise<{ ok: boolean; resultado?: VisionBatchSummary; erro?: string }> {
  return client['vision.batch'](options ?? {})
}

export async function listarProdutosComImagem(): Promise<ProdutoComImagem[]> {
  return client['vision.listar_com_imagem']()
}
