import type { Produto } from '@shared/types'
import { Package } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@renderer/components/ui/badge'
import { useDataDir, imageUrl } from '@renderer/lib/image-url'

interface Props {
  produto: Produto
  imagem_path?: string | null
}

export function ProdutoCard({ produto, imagem_path }: Props) {
  const navigate = useNavigate()
  const dataDir = useDataDir()

  return (
    <div
      onClick={() => navigate(`/produtos/${produto.produto_id}`)}
      className="border rounded-lg p-3 cursor-pointer hover:border-primary transition-colors group"
    >
      <div className="aspect-square bg-muted rounded-md mb-2 flex items-center justify-center overflow-hidden">
        {imagem_path ? (
          <img
            src={imageUrl(dataDir, imagem_path)}
            alt={produto.nome}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <Package className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
      <p className="font-medium text-sm truncate" title={produto.nome}>
        {produto.nome}
      </p>
      <p className="text-xs text-muted-foreground">
        {produto.codigo} · {produto.unidade}
      </p>
      {produto.categoria && (
        <Badge variant="secondary" className="mt-1 text-xs">
          {produto.categoria}
        </Badge>
      )}
    </div>
  )
}
