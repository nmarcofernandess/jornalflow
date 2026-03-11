import { client } from './client'

export async function gerarExportacao(jornal_id: number) {
  return client['export.gerar']({ jornal_id })
}

export async function abrirPasta(caminho: string) {
  return client['shell.abrir_pasta']({ caminho })
}
