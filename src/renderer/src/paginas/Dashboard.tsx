import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDashboardStats } from '@renderer/servicos/jornais'
import type { Jornal } from '@shared/types'

interface DashboardData {
  total_produtos: number
  produtos_com_imagem: number
  total_jornais: number
  ultimo_exportado: Jornal | null
  rascunho_atual: Jornal | null
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    getDashboardStats()
      .then((d) => setStats(d as DashboardData))
      .finally(() => setLoading(false))
  }, [])

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR')
  }

  const cobertura =
    stats && stats.total_produtos > 0
      ? Math.round((stats.produtos_com_imagem / stats.total_produtos) * 100)
      : 0

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-4">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Visao geral do JornalFlow</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-sm text-muted-foreground">Produtos Cadastrados</p>
          <p className="text-3xl font-bold">{stats?.total_produtos ?? 0}</p>
        </div>
        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-sm text-muted-foreground">Com Imagem</p>
          <p className="text-3xl font-bold">{stats?.produtos_com_imagem ?? 0}</p>
          <p className="text-xs text-muted-foreground">{cobertura}% de cobertura</p>
        </div>
        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-sm text-muted-foreground">Jornais Criados</p>
          <p className="text-3xl font-bold">{stats?.total_jornais ?? 0}</p>
        </div>
      </div>

      {/* Current Draft */}
      {stats?.rascunho_atual && (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                {stats.rascunho_atual.titulo || `Jornal ${stats.rascunho_atual.tipo}`}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDate(stats.rascunho_atual.data_inicio)} →{' '}
                {formatDate(stats.rascunho_atual.data_fim)}
              </p>
            </div>
            <span className="rounded-full bg-yellow-100 text-yellow-800 px-2.5 py-0.5 text-xs font-medium">
              Rascunho
            </span>
          </div>
          <button
            onClick={() => navigate(`/editor/${stats.rascunho_atual!.jornal_id}`)}
            className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
          >
            Continuar Editando
          </button>
        </div>
      )}

      {/* Last Exported */}
      {stats?.ultimo_exportado && (
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Ultimo Exportado</p>
          <p className="font-medium mt-1">
            {stats.ultimo_exportado.titulo || `Jornal ${stats.ultimo_exportado.tipo}`}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatDate(stats.ultimo_exportado.data_inicio)} →{' '}
            {formatDate(stats.ultimo_exportado.data_fim)}
          </p>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Acoes Rapidas</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate('/editor')}
            className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
          >
            Novo Jornal Semanal
          </button>
          <button
            onClick={() => navigate('/produtos')}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Ver Produtos
          </button>
          <button
            onClick={() => navigate('/historico')}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Ver Historico
          </button>
        </div>
      </div>
    </div>
  )
}
