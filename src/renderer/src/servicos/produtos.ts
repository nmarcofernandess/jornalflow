import { client } from './client'
import type { Produto, ProdutoImagem } from '@shared/types'

// === PRODUTOS ===

export async function listarProdutos(): Promise<Produto[]> {
  return client['produtos.listar']()
}

export async function buscarProdutos(termo: string): Promise<Produto[]> {
  return client['produtos.buscar']({ termo })
}

export async function criarProduto(data: {
  codigo: string
  nome: string
  unidade: string
  nome_card?: string
  categoria?: string
}): Promise<Produto> {
  return client['produtos.criar'](data)
}

export async function atualizarProduto(
  produto_id: number,
  changes: {
    nome?: string
    nome_card?: string
    unidade?: string
    categoria?: string
  }
): Promise<Produto> {
  return client['produtos.atualizar']({ produto_id, ...changes })
}

export async function porCodigo(codigo: string): Promise<Produto | null> {
  return client['produtos.por_codigo']({ codigo })
}

export async function deletarProduto(produto_id: number): Promise<{ ok: boolean }> {
  return client['produtos.deletar']({ produto_id })
}

// === IMAGENS ===

export async function listarImagens(produto_id: number): Promise<ProdutoImagem[]> {
  return client['imagens.listar']({ produto_id })
}

export async function adicionarImagem(
  produto_id: number,
  source_path: string,
  variacao?: string
): Promise<ProdutoImagem> {
  return client['imagens.adicionar']({ produto_id, source_path, variacao })
}

export async function definirDefault(imagem_id: number): Promise<{ ok: boolean }> {
  return client['imagens.definir_default']({ imagem_id })
}

export async function removerImagem(imagem_id: number): Promise<{ ok: boolean }> {
  return client['imagens.remover']({ imagem_id })
}
