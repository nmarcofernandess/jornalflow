import type {
  Jornal,
  JornalItem,
  JornalPagina,
  JornalSecao,
  Loja,
  Produto,
  ProdutoImagem,
  TemplateSecao
} from '@shared/types'
import { useMemo } from 'react'
import { BannerTopo } from './BannerTopo'
import { BarraDatas } from './BarraDatas'
import { PaginaJornal } from './PaginaJornal'
import { RodapeLoja } from './RodapeLoja'
import type { SecaoJornalProps } from './SecaoJornal'

interface JornalPreviewProps {
  jornal: Jornal
  paginas: JornalPagina[]
  secoes: JornalSecao[]
  items: JornalItem[]
  produtos_map: Record<number, Produto>
  imagens_map: Record<number, ProdutoImagem>
  templates_map: Record<number, TemplateSecao>
  loja: Loja | null
  selected_item_id?: number | null
  onSelectItem?: (item_id: number) => void
}

export function JornalPreview({
  jornal,
  paginas,
  secoes,
  items,
  produtos_map,
  imagens_map,
  templates_map,
  loja,
  selected_item_id,
  onSelectItem
}: JornalPreviewProps) {
  const organized = useMemo(() => {
    // Group items by jornal_secao_id
    const items_by_secao: Record<number, JornalItem[]> = {}
    for (const item of items) {
      if (!items_by_secao[item.jornal_secao_id]) {
        items_by_secao[item.jornal_secao_id] = []
      }
      items_by_secao[item.jornal_secao_id].push(item)
    }

    // Group sections by pagina_id
    const secoes_by_pagina: Record<number, JornalSecao[]> = {}
    for (const secao of secoes) {
      if (!secoes_by_pagina[secao.pagina_id]) {
        secoes_by_pagina[secao.pagina_id] = []
      }
      secoes_by_pagina[secao.pagina_id].push(secao)
    }

    // Build page data sorted by numero
    const sorted_paginas = [...paginas].sort((a, b) => a.numero - b.numero)

    return sorted_paginas.map((pagina) => {
      const page_secoes = secoes_by_pagina[pagina.pagina_id] || []

      const secao_props_list: SecaoJornalProps[] = page_secoes.map((secao) => {
        const template = secao.template_secao_id
          ? templates_map[secao.template_secao_id] || null
          : null

        const secao_items = (items_by_secao[secao.jornal_secao_id] || []).map((item) => {
          const produto = produtos_map[item.produto_id]
          const imagem = item.imagem_id ? imagens_map[item.imagem_id] || null : null
          const imagem_path = imagem?.arquivo_path || null

          let status: 'match' | 'fallback' | 'nao_encontrado'
          if (!item.imagem_id) {
            status = 'nao_encontrado'
          } else if (item.is_fallback) {
            status = 'fallback'
          } else {
            status = 'match'
          }

          return { item, produto, imagem_path, status }
        })

        return { secao, template, items: secao_items }
      })

      return { pagina, secoes: secao_props_list }
    })
  }, [jornal, paginas, secoes, items, produtos_map, imagens_map, templates_map])

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto bg-white shadow-lg" data-export="jornal-preview">
      <BannerTopo banner_path={jornal.banner_path} />

      <BarraDatas data_inicio={jornal.data_inicio} data_fim={jornal.data_fim} />

      <div className="flex flex-col gap-4 p-4">
        {organized.map(({ pagina, secoes: page_secoes }) => (
          <PaginaJornal
            key={pagina.pagina_id}
            pagina={pagina}
            secoes={page_secoes}
            selected_item_id={selected_item_id}
            onSelectItem={onSelectItem}
          />
        ))}
      </div>

      {loja && <RodapeLoja loja={loja} />}
    </div>
  )
}
