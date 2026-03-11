import { cn } from '@renderer/lib/utils'
import type { JornalItem, JornalSecao, Produto, TemplateSecao } from '@shared/types'
import { CardProduto } from './CardProduto'

export interface SecaoJornalProps {
  secao: JornalSecao
  template: TemplateSecao | null
  items: Array<{
    item: JornalItem
    produto: Produto
    imagem_path: string | null
    status: 'match' | 'fallback' | 'nao_encontrado'
  }>
  selected_item_id?: number | null
  onSelectItem?: (item_id: number) => void
}

export function SecaoJornal({ secao, template, items, selected_item_id, onSelectItem }: SecaoJornalProps) {
  const nome = secao.nome_custom || template?.nome_display || 'Seção'
  const cor_tema = template?.cor_tema || null
  const cols = Math.min(secao.grid_cols, 3)

  const sorted_items = [...items].sort((a, b) => a.item.posicao - b.item.posicao)

  return (
    <div
      className="flex flex-col rounded-lg overflow-hidden border"
      style={cor_tema ? { borderColor: cor_tema } : undefined}
      data-export={`secao-${template?.slug || secao.jornal_secao_id}`}
    >
      {/* Header */}
      <div
        className={cn(
          'px-3 py-1.5 font-bold text-sm uppercase tracking-wide text-white',
          !cor_tema && 'bg-gray-700'
        )}
        style={cor_tema ? { backgroundColor: cor_tema } : undefined}
      >
        {nome}
      </div>

      {/* Grid of products */}
      <div
        className={cn(
          'grid gap-2 p-2 bg-gray-50/50',
          cols === 1 && 'grid-cols-1',
          cols === 2 && 'grid-cols-2',
          cols === 3 && 'grid-cols-3'
        )}
      >
        {sorted_items.map(({ item, produto, imagem_path, status }) => (
          <CardProduto
            key={item.item_id}
            item={item}
            produto={produto}
            imagem_path={imagem_path}
            status={status}
            selected={selected_item_id === item.item_id}
            onClick={onSelectItem ? () => onSelectItem(item.item_id) : undefined}
          />
        ))}
      </div>
    </div>
  )
}
