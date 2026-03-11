import { useState, useEffect } from 'react'
import { client } from '@renderer/servicos/client'
import type { Loja } from '@shared/types'

interface DbStats {
  produtos: number
  imagens: number
  jornais: number
}

export default function ConfiguracoesPagina() {
  const [_loja, setLoja] = useState<Loja | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [dbStats, setDbStats] = useState<DbStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  // Form state
  const [nome, setNome] = useState('')
  const [endereco, setEndereco] = useState('')
  const [telefone, setTelefone] = useState('')
  const [horario, setHorario] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [lojaData, keyData, stats] = await Promise.all([
        client['config.get_loja'](),
        client['ia.get_api_key'](),
        client['config.db_stats']()
      ])

      if (lojaData) {
        setLoja(lojaData as Loja)
        setNome((lojaData as Loja).nome || '')
        setEndereco((lojaData as Loja).endereco || '')
        setTelefone((lojaData as Loja).telefone || '')
        setHorario((lojaData as Loja).horario_func || '')
      }
      setApiKey((keyData as { key: string }).key || '')
      setDbStats(stats as DbStats)
    } catch (err) {
      console.error('Erro ao carregar configurações:', err)
    } finally {
      setLoading(false)
    }
  }

  async function salvarLoja() {
    setSaving(true)
    try {
      const updated = await client['config.atualizar_loja']({
        changes: { nome, endereco, telefone, horario_func: horario }
      })
      setLoja(updated as Loja)
    } catch (err) {
      console.error('Erro ao salvar loja:', err)
    } finally {
      setSaving(false)
    }
  }

  async function salvarApiKey() {
    setSaving(true)
    try {
      await client['ia.set_api_key']({ key: apiKey })
      setTestResult(null)
    } catch (err) {
      console.error('Erro ao salvar API key:', err)
    } finally {
      setSaving(false)
    }
  }

  async function testarConexao() {
    setTestResult(null)
    try {
      await client['ia.chat']({
        messages: [{ role: 'user', content: 'Diga apenas "OK" para confirmar conexão.' }]
      })
      setTestResult('Conexão OK!')
    } catch (err) {
      setTestResult(`Erro: ${String(err)}`)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground mt-4">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground mt-1">Configurações do sistema</p>
      </div>

      {/* Loja Section */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Loja</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Nome</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Endereço</label>
            <input
              type="text"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Telefone</label>
              <input
                type="text"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Horário de Funcionamento</label>
              <input
                type="text"
                value={horario}
                onChange={(e) => setHorario(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            onClick={salvarLoja}
            disabled={saving}
            className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar Loja'}
          </button>
        </div>
      </section>

      {/* IA Section */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">IA (Gemini)</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIza..."
              className="w-full rounded-md border px-3 py-2 text-sm font-mono"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={salvarApiKey}
              disabled={saving}
              className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              Salvar Key
            </button>
            <button
              onClick={testarConexao}
              disabled={!apiKey}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              Testar Conexão
            </button>
          </div>
          {testResult && (
            <p
              className={`text-sm ${testResult.startsWith('Erro') ? 'text-red-500' : 'text-green-600'}`}
            >
              {testResult}
            </p>
          )}
        </div>
      </section>

      {/* DB Stats Section */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Dados</h2>
        {dbStats && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold">{dbStats.produtos}</p>
              <p className="text-xs text-muted-foreground">Produtos</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold">{dbStats.imagens}</p>
              <p className="text-xs text-muted-foreground">Imagens</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold">{dbStats.jornais}</p>
              <p className="text-xs text-muted-foreground">Jornais</p>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
