// === LOJA ===

export interface Loja {
  loja_id: number
  nome: string
  endereco: string | null
  telefone: string | null
  horario_func: string | null
  logo_path: string | null
}

// === PRODUTOS ===

export interface Produto {
  produto_id: number
  codigo: string
  nome: string
  nome_card: string | null
  unidade: string
  categoria: string | null
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

export interface ProdutoImagem {
  imagem_id: number
  produto_id: number
  arquivo_path: string
  variacao: string | null
  is_default: boolean
  criado_em: string
}

// === TEMPLATE ===

export interface TemplateSecao {
  secao_id: number
  slug: string
  nome_display: string
  posicao: number
  pagina: number
  lado: 'full' | 'esquerda' | 'direita'
  grid_cols: number
  grid_rows: number
  bg_path: string | null
  header_path: string | null
  cor_tema: string | null
}

export interface SecaoAlias {
  alias_id: number
  secao_id: number
  alias: string
}

// === JORNAL ===

export type JornalTipo = 'semanal' | 'especial'
export type JornalStatus = 'rascunho' | 'revisao' | 'aprovado' | 'exportado'

export interface Jornal {
  jornal_id: number
  titulo: string | null
  tipo: JornalTipo
  data_inicio: string
  data_fim: string
  banner_path: string | null
  status: JornalStatus
  criado_em: string
  atualizado_em: string
}

export type PaginaLayout = 'full' | 'dupla'

export interface JornalPagina {
  pagina_id: number
  jornal_id: number
  numero: number
  layout: PaginaLayout
  banner_path: string | null
}

export interface JornalSecao {
  jornal_secao_id: number
  jornal_id: number
  pagina_id: number
  template_secao_id: number | null
  posicao: number
  lado: 'full' | 'esquerda' | 'direita'
  grid_cols: number
  grid_rows: number
  nome_custom: string | null
  bg_custom: string | null
  header_custom: string | null
}

export interface JornalItem {
  item_id: number
  jornal_id: number
  jornal_secao_id: number
  posicao: number
  produto_id: number
  preco_oferta: number
  preco_clube: number
  unidade_display: string | null
  imagem_id: number | null
  is_fallback: boolean
  img_scale: number
  img_offset_x: number
  img_offset_y: number
  imgs_compostas: string[] | null
  criado_em: string
}

// === IMPORTAÇÃO ===

export interface Importacao {
  importacao_id: number
  jornal_id: number
  arquivo_nome: string
  total_itens: number
  matched: number
  fallbacks: number
  nao_encontrados: number
  criado_em: string
}

// === PARSER ===

export interface PlanilhaRow {
  codigo: string
  descricao: string
  preco_oferta: number
  tipo_oferta: string | null
  preco_clube: number
  unidade_extraida: string | null
}

export interface MatchResult {
  row: PlanilhaRow
  produto: Produto | null
  imagem: ProdutoImagem | null
  status: 'match' | 'fallback' | 'nao_encontrado'
  motivo: string | null
}

export interface ImportResult {
  jornal_id: number
  rows: MatchResult[]
  total: number
  matched: number
  fallbacks: number
  nao_encontrados: number
}

// === EXPORT ===

export type ExportTipo = 'pdf_full' | 'png_full' | 'story' | 'carrossel'

export interface ExportConfig {
  tipo: ExportTipo
  formato: 'pdf' | 'png' | 'jpg'
  dimensoes: { width: number; height: number }
}

// === IA ===

export interface IaMensagem {
  role: 'user' | 'assistant' | 'system'
  content: string
  tool_calls?: unknown[]
  criado_em: string
}
