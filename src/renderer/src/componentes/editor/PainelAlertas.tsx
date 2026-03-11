import { useEditorStore } from '@renderer/store/editorStore'
import { AlertTriangle, ImageOff, Info } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

const alertConfig = {
  fallback: {
    icon: AlertTriangle,
    bg: 'bg-yellow-50 hover:bg-yellow-100/80',
    border: 'border-l-yellow-500',
    text: 'text-yellow-800'
  },
  missing: {
    icon: ImageOff,
    bg: 'bg-red-50 hover:bg-red-100/80',
    border: 'border-l-red-500',
    text: 'text-red-800'
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50 hover:bg-blue-100/80',
    border: 'border-l-blue-500',
    text: 'text-blue-800'
  }
}

export function PainelAlertas() {
  const { alerts, produtos_map, itens, selectItem } = useEditorStore()

  if (alerts.length === 0) {
    return (
      <div className="p-4 flex flex-col items-center gap-3 text-center">
        <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center">
          <span className="text-green-600 text-lg">&#10003;</span>
        </div>
        <p className="text-xs text-muted-foreground">Nenhum alerta encontrado</p>
        <p className="text-[10px] text-muted-foreground">Todos os itens estao com imagem correta</p>
      </div>
    )
  }

  // Group alerts by type
  const fallbacks = alerts.filter((a) => a.type === 'fallback')
  const missing = alerts.filter((a) => a.type === 'missing')
  const infos = alerts.filter((a) => a.type === 'info')

  function getProductName(item_id: number): string {
    const item = itens.find((i) => i.item_id === item_id)
    if (!item) return `Item #${item_id}`
    const produto = produtos_map[item.produto_id]
    return produto?.nome_card || produto?.nome || `#${item.produto_id}`
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Summary */}
      <div className="flex items-center gap-2 px-1">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <span className="text-xs font-semibold">
          {alerts.length} alerta{alerts.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Stats bar */}
      <div className="flex gap-2 text-[10px]">
        {fallbacks.length > 0 && (
          <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-medium">
            {fallbacks.length} fallback
          </span>
        )}
        {missing.length > 0 && (
          <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-medium">
            {missing.length} sem imagem
          </span>
        )}
        {infos.length > 0 && (
          <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">
            {infos.length} info
          </span>
        )}
      </div>

      {/* Alert list */}
      <div className="flex flex-col gap-1.5">
        {alerts.map((alert, idx) => {
          const config = alertConfig[alert.type]
          const Icon = config.icon
          const productName = getProductName(alert.item_id)

          return (
            <button
              key={`${alert.item_id}-${alert.type}-${idx}`}
              onClick={() => selectItem(alert.item_id)}
              className={cn(
                'w-full text-left border-l-4 rounded-r-md px-3 py-2 transition-colors cursor-pointer',
                config.bg,
                config.border
              )}
            >
              <div className="flex items-start gap-2">
                <Icon className={cn('h-3.5 w-3.5 mt-0.5 flex-shrink-0', config.text)} />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[11px] font-medium truncate">{productName}</span>
                  <span className={cn('text-[10px]', config.text)}>{alert.message}</span>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
