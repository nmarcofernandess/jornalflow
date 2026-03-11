import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { historicoDetalhe } from '@renderer/servicos/jornais'
import { JornalPreview } from '@renderer/componentes/jornal/JornalPreview'
import type { Jornal, JornalPagina, JornalSecao, JornalItem, Produto, ProdutoImagem, TemplateSecao, Loja } from '@shared/types'

interface FullJournalData {
  jornal: Jornal
  paginas: JornalPagina[]
  secoes: JornalSecao[]
  itens: JornalItem[]
  produtos: Produto[]
  imagens: ProdutoImagem[]
  templates: TemplateSecao[]
  loja: Loja | null
}

const STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  revisao: 'Em Revisão',
  aprovado: 'Aprovado',
  exportado: 'Exportado'
}

export default function HistoricoDetalhe() {
  const { jornal_id } = useParams<{ jornal_id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<FullJournalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!jornal_id) return
    setLoading(true)
    historicoDetalhe(Number(jornal_id))
      .then((d) => setData(d as FullJournalData))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [jornal_id])

  // Build maps from arrays for JornalPreview
  const produtos_map = useMemo(() => {
    if (!data) return {}
    const map: Record<number, Produto> = {}
    for (const p of data.produtos) {
      map[p.produto_id] = p
    }
    return map
  }, [data])

  const imagens_map = useMemo(() => {
    if (!data) return {}
    const map: Record<number, ProdutoImagem> = {}
    for (const img of data.imagens) {
      map[img.imagem_id] = img
    }
    return map
  }, [data])

  const templates_map = useMemo(() => {
    if (!data) return {}
    const map: Record<number, TemplateSecao> = {}
    for (const t of data.templates) {
      map[t.secao_id] = t
    }
    return map
  }, [data])

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR')
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Carregando jornal...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <p className="text-red-500">{error || 'Jornal não encontrado'}</p>
        <button onClick={() => navigate('/historico')} className="mt-2 text-sm underline">
          Voltar ao histórico
        </button>
      </div>
    )
  }

  const { jornal, paginas, secoes, itens, loja } = data

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => navigate('/historico')} className="text-sm text-muted-foreground hover:underline mb-2 block">
            ← Voltar ao histórico
          </button>
          <h1 className="text-2xl font-bold">
            {jornal.titulo || `Jornal ${jornal.tipo}`}
          </h1>
          <p className="text-muted-foreground">
            {formatDate(jornal.data_inicio)} → {formatDate(jornal.data_fim)} · {STATUS_LABELS[jornal.status] || jornal.status}
          </p>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <p>{itens.length} itens · {paginas.length} páginas</p>
          <p>Criado em {formatDate(jornal.criado_em)}</p>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-gray-50 p-4">
        <JornalPreview
          jornal={jornal}
          paginas={paginas}
          secoes={secoes}
          items={itens}
          produtos_map={produtos_map}
          imagens_map={imagens_map}
          templates_map={templates_map}
          loja={loja}
        />
      </div>
    </div>
  )
}
