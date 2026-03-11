import { cn } from '@renderer/lib/utils'
import { Package } from 'lucide-react'
import type { JornalItem, Produto } from '@shared/types'

interface CardProdutoProps {
  item: JornalItem
  produto: Produto
  imagem_path: string | null
  status: 'match' | 'fallback' | 'nao_encontrado'
  selected?: boolean
  onClick?: () => void
}

const statusBorder = {
  match: 'border-l-green-500',
  fallback: 'border-l-yellow-500',
  nao_encontrado: 'border-l-red-500'
}

function formatPrice(value: number): string {
  return value.toFixed(2).replace('.', ',')
}

export function CardProduto({ item, produto, imagem_path, status, selected, onClick }: CardProdutoProps) {
  const displayName = produto.nome_card || produto.nome
  const unidade = item.unidade_display || produto.unidade
  const hasCompostas = item.imgs_compostas && item.imgs_compostas.length > 0

  return (
    <div
      onClick={onClick}
      className={cn(
        'border-l-4 rounded-lg bg-white overflow-hidden cursor-pointer transition-all flex flex-col',
        statusBorder[status],
        selected && 'ring-2 ring-primary ring-offset-1',
        onClick && 'hover:shadow-md'
      )}
    >
      {/* Image area */}
      <div className="relative bg-gray-50 aspect-[4/3] flex items-center justify-center overflow-hidden">
        {hasCompostas ? (
          <div className="flex w-full h-full">
            {item.imgs_compostas!.map((path, i) => (
              <img
                key={i}
                src={`file://${path}`}
                alt=""
                className="flex-1 object-cover"
                style={{ maxWidth: `${100 / item.imgs_compostas!.length}%` }}
              />
            ))}
          </div>
        ) : imagem_path ? (
          <img
            src={`file://${imagem_path}`}
            alt={displayName}
            className="w-full h-full object-cover"
            style={{
              transform: `scale(${item.img_scale})`,
              objectPosition: `${50 + item.img_offset_x}% ${50 + item.img_offset_y}%`
            }}
          />
        ) : (
          <Package className="h-10 w-10 text-gray-300" />
        )}
      </div>

      {/* Name */}
      <div className="px-2 pt-1.5 pb-1 text-center">
        <p className="text-[11px] font-semibold uppercase leading-tight line-clamp-2">{displayName}</p>
      </div>

      {/* Price */}
      <div className="px-2 pb-2 text-center mt-auto">
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-lg font-extrabold text-red-600">
            R$ {formatPrice(item.preco_oferta)}
          </span>
          <span className="text-[10px] text-gray-500">{unidade}</span>
        </div>
        {item.preco_clube !== item.preco_oferta && (
          <div className="mt-0.5 inline-flex items-center gap-1 bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
            CLUBE R$ {formatPrice(item.preco_clube)}
          </div>
        )}
      </div>
    </div>
  )
}
