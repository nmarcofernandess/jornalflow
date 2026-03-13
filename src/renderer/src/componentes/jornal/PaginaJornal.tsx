import { cn } from '@renderer/lib/utils'
import type { JornalPagina } from '@shared/types'
import { SecaoJornal, type SecaoJornalProps } from './SecaoJornal'
import { useDataDir, imageUrl } from '@renderer/lib/image-url'

interface PaginaJornalProps {
  pagina: JornalPagina
  secoes: SecaoJornalProps[]
  selected_item_id?: number | null
  onSelectItem?: (item_id: number) => void
}

export function PaginaJornal({ pagina, secoes, selected_item_id, onSelectItem }: PaginaJornalProps) {
  const dataDir = useDataDir()
  const sorted_secoes = [...secoes].sort((a, b) => a.secao.posicao - b.secao.posicao)
  const is_dupla = pagina.layout === 'dupla'

  return (
    <div data-export={`pagina-${pagina.numero}`} className="w-full">
      {/* Page banner if present */}
      {pagina.banner_path && (
        <img
          src={imageUrl(dataDir, pagina.banner_path)}
          alt={`Banner página ${pagina.numero}`}
          className="w-full h-auto object-cover"
        />
      )}

      <div
        className={cn(
          'w-full gap-3',
          is_dupla ? 'flex' : 'flex flex-col'
        )}
      >
        {sorted_secoes.map((secao_props) => (
          <div
            key={secao_props.secao.jornal_secao_id}
            className={cn(is_dupla && 'flex-1 min-w-0')}
          >
            <SecaoJornal
              {...secao_props}
              selected_item_id={selected_item_id}
              onSelectItem={onSelectItem}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
