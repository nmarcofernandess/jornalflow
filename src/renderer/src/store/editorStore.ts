import { create } from 'zustand'
import type {
  Jornal,
  JornalPagina,
  JornalSecao,
  JornalItem,
  Produto,
  ProdutoImagem,
  TemplateSecao,
  Loja
} from '@shared/types'

interface Alert {
  type: 'fallback' | 'missing' | 'info'
  item_id: number
  message: string
}

export interface FullJournalData {
  jornal: Jornal
  paginas: JornalPagina[]
  secoes: JornalSecao[]
  itens: JornalItem[]
  produtos: Produto[]
  imagens: ProdutoImagem[]
  templates: TemplateSecao[]
  loja: Loja | null
}

interface EditorState {
  // Data
  jornal: Jornal | null
  paginas: JornalPagina[]
  secoes: JornalSecao[]
  itens: JornalItem[]
  produtos_map: Record<number, Produto>
  imagens_map: Record<number, ProdutoImagem>
  templates_map: Record<number, TemplateSecao>
  loja: Loja | null

  // UI state
  selected_item_id: number | null
  alerts: Alert[]
  loading: boolean

  // Actions
  loadJornal: (data: FullJournalData) => void
  selectItem: (item_id: number | null) => void
  updateItem: (item_id: number, changes: Partial<JornalItem>) => void
  updateItemLocal: (item_id: number, changes: Partial<JornalItem>) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

function buildAlerts(
  itens: JornalItem[],
  _imagens_map: Record<number, ProdutoImagem>
): Alert[] {
  const alerts: Alert[] = []
  for (const item of itens) {
    if (item.is_fallback) {
      alerts.push({
        type: 'fallback',
        item_id: item.item_id,
        message: item.imagem_id ? 'Imagem generica usada' : 'Produto sem imagem'
      })
    }
    if (!item.imagem_id) {
      alerts.push({
        type: 'missing',
        item_id: item.item_id,
        message: 'Sem imagem definida'
      })
    }
  }
  return alerts
}

const initialState = {
  jornal: null as Jornal | null,
  paginas: [] as JornalPagina[],
  secoes: [] as JornalSecao[],
  itens: [] as JornalItem[],
  produtos_map: {} as Record<number, Produto>,
  imagens_map: {} as Record<number, ProdutoImagem>,
  templates_map: {} as Record<number, TemplateSecao>,
  loja: null as Loja | null,
  selected_item_id: null as number | null,
  alerts: [] as Alert[],
  loading: false
}

export const useEditorStore = create<EditorState>((set, get) => ({
  ...initialState,

  loadJornal: (data) => {
    const produtos_map: Record<number, Produto> = {}
    for (const p of data.produtos) produtos_map[p.produto_id] = p

    const imagens_map: Record<number, ProdutoImagem> = {}
    for (const img of data.imagens) imagens_map[img.imagem_id] = img

    const templates_map: Record<number, TemplateSecao> = {}
    for (const t of data.templates) templates_map[t.secao_id] = t

    const alerts = buildAlerts(data.itens, imagens_map)

    set({
      jornal: data.jornal,
      paginas: data.paginas,
      secoes: data.secoes,
      itens: data.itens,
      produtos_map,
      imagens_map,
      templates_map,
      loja: data.loja,
      alerts,
      selected_item_id: null,
      loading: false
    })
  },

  selectItem: (item_id) => set({ selected_item_id: item_id }),

  updateItem: (item_id, changes) => {
    // Optimistic local update — caller is responsible for persisting via IPC
    const itens = get().itens.map((item) =>
      item.item_id === item_id ? { ...item, ...changes } : item
    )
    const alerts = buildAlerts(itens, get().imagens_map)
    set({ itens, alerts })
  },

  updateItemLocal: (item_id, changes) => {
    // Local-only update (e.g. drag offsets) — no alert recalculation
    const itens = get().itens.map((item) =>
      item.item_id === item_id ? { ...item, ...changes } : item
    )
    set({ itens })
  },

  setLoading: (loading) => set({ loading }),

  reset: () => set(initialState)
}))
