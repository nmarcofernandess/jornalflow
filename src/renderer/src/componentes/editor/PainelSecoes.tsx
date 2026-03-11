import { useState } from 'react'
import { useEditorStore } from '@renderer/store/editorStore'
import { ChevronDown, ChevronRight, Package } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

export function PainelSecoes() {
  const { jornal, paginas, secoes, itens, templates_map, produtos_map, selected_item_id, selectItem } =
    useEditorStore()

  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({})

  if (!jornal) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        Nenhum jornal carregado
      </div>
    )
  }

  const sorted_paginas = [...paginas].sort((a, b) => a.numero - b.numero)

  // Group sections by pagina_id
  const secoes_by_pagina: Record<number, typeof secoes> = {}
  for (const secao of secoes) {
    if (!secoes_by_pagina[secao.pagina_id]) {
      secoes_by_pagina[secao.pagina_id] = []
    }
    secoes_by_pagina[secao.pagina_id].push(secao)
  }

  // Group items by jornal_secao_id
  const itens_by_secao: Record<number, typeof itens> = {}
  for (const item of itens) {
    if (!itens_by_secao[item.jornal_secao_id]) {
      itens_by_secao[item.jornal_secao_id] = []
    }
    itens_by_secao[item.jornal_secao_id].push(item)
  }

  function toggleCollapse(secao_id: number) {
    setCollapsed((prev) => ({ ...prev, [secao_id]: !prev[secao_id] }))
  }

  return (
    <div className="flex flex-col">
      {sorted_paginas.map((pagina) => {
        const page_secoes = (secoes_by_pagina[pagina.pagina_id] || []).sort(
          (a, b) => a.posicao - b.posicao
        )

        return (
          <div key={pagina.pagina_id}>
            {/* Page header */}
            <div className="px-3 py-2 bg-muted/50 border-b text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Pagina {pagina.numero}
            </div>

            {/* Sections */}
            {page_secoes.map((secao) => {
              const template = secao.template_secao_id
                ? templates_map[secao.template_secao_id] || null
                : null
              const nome = secao.nome_custom || template?.nome_display || 'Secao'
              const secao_itens = (itens_by_secao[secao.jornal_secao_id] || []).sort(
                (a, b) => a.posicao - b.posicao
              )
              const isCollapsed = collapsed[secao.jornal_secao_id] ?? false

              return (
                <div key={secao.jornal_secao_id}>
                  {/* Section header */}
                  <button
                    onClick={() => toggleCollapse(secao.jornal_secao_id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted/30 transition-colors border-b text-left"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="text-xs font-medium flex-1 truncate">{nome}</span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {secao_itens.length}
                    </span>
                  </button>

                  {/* Items */}
                  {!isCollapsed && secao_itens.length > 0 && (
                    <div className="flex flex-col">
                      {secao_itens.map((item) => {
                        const produto = produtos_map[item.produto_id]
                        const nome_produto = produto?.nome_card || produto?.nome || `#${item.produto_id}`

                        return (
                          <button
                            key={item.item_id}
                            onClick={() => selectItem(item.item_id)}
                            className={cn(
                              'w-full flex items-center gap-2 px-4 py-1.5 text-left transition-colors border-b border-transparent',
                              selected_item_id === item.item_id
                                ? 'bg-primary/10 text-primary border-b-primary/20'
                                : 'hover:bg-muted/20'
                            )}
                          >
                            <Package className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className="text-[11px] truncate flex-1">{nome_produto}</span>
                            {item.is_fallback && (
                              <span className="h-2 w-2 rounded-full bg-yellow-500 flex-shrink-0" />
                            )}
                            {!item.imagem_id && (
                              <span className="h-2 w-2 rounded-full bg-red-500 flex-shrink-0" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
