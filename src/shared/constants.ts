// Unidades aceitas
export const UNIDADES = ['KG', 'UN', '100G', 'PCT', 'LT', 'ML', 'GR', 'PCT/KG'] as const

// Categorias de produto
export const CATEGORIAS = [
  'carnes',
  'hortifruti',
  'mercearia',
  'padaria',
  'bebidas',
  'laticinios',
  'higiene',
  'limpeza',
  'congelados',
  'outros'
] as const

// Seções default do jornal semanal
export const SECOES_DEFAULT = [
  {
    slug: 'acougue',
    nome_display: 'Açougue do Fernandes',
    posicao: 1,
    pagina: 1,
    lado: 'full' as const,
    grid_cols: 3,
    grid_rows: 3,
    cor_tema: '#8B0000',
    aliases: ['ACOUGUE']
  },
  {
    slug: 'hortifruti',
    nome_display: 'Horti Fruti',
    posicao: 1,
    pagina: 2,
    lado: 'esquerda' as const,
    grid_cols: 3,
    grid_rows: 3,
    cor_tema: '#2d5a27',
    aliases: ['HORTIFRUTI']
  },
  {
    slug: 'mercearia',
    nome_display: 'Mercearia Fernandes',
    posicao: 2,
    pagina: 2,
    lado: 'direita' as const,
    grid_cols: 3,
    grid_rows: 3,
    cor_tema: '#8B4513',
    aliases: ['MERCEARIA']
  },
  {
    slug: 'padaria',
    nome_display: 'Padaria - Perecíveis e Matinais',
    posicao: 1,
    pagina: 3,
    lado: 'esquerda' as const,
    grid_cols: 3,
    grid_rows: 3,
    cor_tema: '#654321',
    aliases: ['PEREC-MAT']
  },
  {
    slug: 'casa-higiene',
    nome_display: 'Casa & Higiene',
    posicao: 2,
    pagina: 3,
    lado: 'direita' as const,
    grid_cols: 3,
    grid_rows: 3,
    cor_tema: '#1a4a7a',
    aliases: ['CASA-HIGIENE']
  }
] as const

// Regex patterns pra extrair unidade da descrição
export const UNIDADE_PATTERNS = [
  { regex: /\bKG\b/i, unidade: 'KG' },
  { regex: /\bUN\.?\b/i, unidade: 'UN' },
  { regex: /\b100\s*G\b/i, unidade: '100G' },
  { regex: /\bPCT\b/i, unidade: 'PCT' },
  { regex: /\b\d+\s*ML\b/i, unidade: 'UN' },
  { regex: /\b\d+\s*LTS?\b/i, unidade: 'UN' },
  { regex: /\b\d+\s*GR?\b/i, unidade: 'UN' },
  { regex: /\b\d+\s*G\b/i, unidade: 'UN' }
] as const

// Export dimensions
export const EXPORT_DIMENSIONS = {
  story: { width: 1080, height: 1920 },
  carrossel: { width: 1080, height: 1080 },
  pagina_full: { width: 1080, height: 1920 },
  pagina_dupla: { width: 1080, height: 1350 }
} as const

// Status labels
export const STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  revisao: 'Em Revisão',
  aprovado: 'Aprovado',
  exportado: 'Exportado'
}
