import { client } from './client'

export async function carregarJornal(jornal_id: number) {
  return client['jornal.carregar']({ jornal_id })
}

export async function atualizarItem(item_id: number, changes: Record<string, unknown>) {
  return client['jornal.atualizar_item']({ item_id, changes })
}

export async function listarRascunhos() {
  return client['jornal.listar_rascunhos']()
}

export async function importarPlanilha(data: {
  text: string
  data_inicio: string
  data_fim: string
  arquivo_nome: string
}) {
  return client['import.planilha'](data)
}

export async function listarJornais() {
  return client['historico.listar']()
}

export async function historicoDetalhe(jornal_id: number) {
  return client['historico.detalhe']({ jornal_id })
}

export async function buscarProdutoNoHistorico(produto_id: number) {
  return client['historico.buscar_produto']({ produto_id })
}

export async function getDashboardStats() {
  return client['dashboard.stats']()
}
