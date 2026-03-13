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
  produto_id: number | null
  arquivo_path: string
  nome_original: string | null
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

// === IA v2 ===

export interface IaContexto {
  rota: string
  pagina:
    | 'dashboard'
    | 'produtos'
    | 'editor'
    | 'historico'
    | 'galeria'
    | 'configuracoes'
    | 'ia'
    | 'outro'
  jornal_id?: number
  produto_id?: number
}

export interface ToolCall {
  id: string
  name: string
  args?: Record<string, unknown>
  result?: unknown
}

export interface IaAnexo {
  tipo: 'image' | 'file'
  nome: string
  tamanho?: number
  mime_type?: string
  file_path?: string
  data_base64?: string
}

export interface IaMensagem {
  id: string
  papel: 'usuario' | 'assistente' | 'tool_result'
  conteudo: string
  criada_em: string
  tool_calls?: ToolCall[]
  anexos?: IaAnexo[]
}

export interface IaConfiguracao {
  id: number
  provider: string
  api_key: string | null
  modelo: string | null
  provider_configs_json: string
  ativo: boolean
  memoria_automatica: boolean
}

export interface IaConversa {
  id: string
  titulo: string | null
  status: string
  resumo_compactado: string | null
  criada_em: string
  atualizada_em: string
}

export interface IaMensagemDB extends IaMensagem {
  conversa_id: string
  tool_calls_json?: string
  anexos_meta_json?: string
}

export type IaStreamEvent =
  | { type: 'text-delta'; stream_id: string; delta: string }
  | {
      type: 'tool-call-start'
      stream_id: string
      tool_call_id: string
      tool_name: string
      args: Record<string, unknown>
      estimated_seconds?: number
    }
  | {
      type: 'tool-result'
      stream_id: string
      tool_call_id: string
      tool_name: string
      result: unknown
    }
  | { type: 'start-step'; stream_id: string; step_index: number }
  | { type: 'step-finish'; stream_id: string; step_index: number }
  | { type: 'follow-up-start'; stream_id: string }
  | {
      type: 'finish'
      stream_id: string
      resposta: string
      acoes: ToolCall[]
    }
  | { type: 'error'; stream_id: string; message: string }

// === MEMORIAS IA ===

export interface IaMemoria {
  id: number
  conteudo: string
  origem: 'manual' | 'auto'
  criada_em: string
  atualizada_em: string
}

// === KNOWLEDGE LAYER ===

export interface KnowledgeSource {
  id: number
  tipo: string
  titulo: string
  conteudo_original: string | null
  metadata: string
  importance: 'high' | 'low'
  ativo: boolean
  criada_em: string
}

export interface KnowledgeChunk {
  id: number
  source_id: number
  conteudo: string
  importance: string
  access_count: number
  last_accessed_at: string | null
  criada_em: string
}

export interface KnowledgeEntity {
  id: number
  nome: string
  tipo: string
  origem: string
  criada_em: string
}

export interface KnowledgeRelation {
  id: number
  entity_from_id: number
  entity_to_id: number
  tipo_relacao: string
  peso: number
  criada_em: string
}

// === VISION AI ===

export interface AnaliseVisionProduto {
  nome_sugerido: string // Nome completo padrao supermercado (ex: "CERVEJA CRYSTAL LATA 350ML")
  nome_card: string // Nome curto pro card do jornal (ex: "CRYSTAL 350ML")
  marca: string // Marca identificada na embalagem
  peso: string // Peso/volume (ex: "350ml", "5kg", "1L")
  categoria: string // Categoria sugerida (carnes, hortifruti, mercearia, etc)
  confianca: number // 0-100
}

export interface VisionProgressEvent {
  current: number
  total: number
  filename: string
  produto_id?: number
  resultado?: AnaliseVisionProduto
  erro?: string
}

export interface VisionBatchSummary {
  total: number
  sucesso: number
  falhas: number
  resultados: Array<{
    produto_id: number
    imagem_id: number
    filename: string
    resultado?: AnaliseVisionProduto
    erro?: string
  }>
}
