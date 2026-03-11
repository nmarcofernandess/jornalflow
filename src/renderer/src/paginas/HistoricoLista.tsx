import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listarJornais } from '@renderer/servicos/jornais'
import type { Jornal } from '@shared/types'

const STATUS_COLORS: Record<string, string> = {
  rascunho: 'bg-yellow-100 text-yellow-800',
  revisao: 'bg-blue-100 text-blue-800',
  aprovado: 'bg-green-100 text-green-800',
  exportado: 'bg-purple-100 text-purple-800'
}

const STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  revisao: 'Em Revisão',
  aprovado: 'Aprovado',
  exportado: 'Exportado'
}

export default function HistoricoLista() {
  const [jornais, setJornais] = useState<Jornal[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    listarJornais()
      .then(setJornais)
      .finally(() => setLoading(false))
  }, [])

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR')
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Histórico</h1>
        <p className="text-muted-foreground mt-4">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Histórico</h1>
        <p className="text-muted-foreground mt-1">Jornais anteriores</p>
      </div>

      {jornais.length === 0 ? (
        <p className="text-muted-foreground">Nenhum jornal encontrado.</p>
      ) : (
        <div className="grid gap-3">
          {jornais.map((j) => (
            <button
              key={j.jornal_id}
              onClick={() => navigate(`/historico/${j.jornal_id}`)}
              className="flex items-center justify-between rounded-lg border p-4 text-left hover:bg-accent transition-colors"
            >
              <div className="space-y-1">
                <p className="font-medium">
                  {j.titulo || `Jornal ${j.tipo} — ${formatDate(j.data_inicio)}`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(j.data_inicio)} → {formatDate(j.data_fim)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[j.status] || ''}`}>
                  {STATUS_LABELS[j.status] || j.status}
                </span>
                <span className="text-xs text-muted-foreground capitalize">{j.tipo}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
