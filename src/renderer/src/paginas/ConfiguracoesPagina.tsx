import { useState, useEffect } from 'react'
import { client } from '@renderer/servicos/client'
import { getConfig, saveConfig, testConfig } from '@renderer/servicos/ia'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Save, Plug, Database, Eye, EyeOff, Bot, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import type { Loja, IaConfiguracao } from '@shared/types'

// ── Defaults por provider ────────────────────────────────────
const PROVIDER_DEFAULTS: Record<string, { modelo: string; placeholder: string; label: string }> = {
  gemini: {
    modelo: 'gemini-2.0-flash',
    placeholder: 'AIza...',
    label: 'Google Gemini'
  },
  openrouter: {
    modelo: 'google/gemini-2.0-flash-exp:free',
    placeholder: 'sk-or-...',
    label: 'OpenRouter'
  }
}

interface DbStats {
  produtos: number
  imagens: number
  jornais: number
}

export default function ConfiguracoesPagina() {
  const [_loja, setLoja] = useState<Loja | null>(null)
  const [dbStats, setDbStats] = useState<DbStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lojaMsg, setLojaMsg] = useState<string | null>(null)

  // Loja form state
  const [nome, setNome] = useState('')
  const [endereco, setEndereco] = useState('')
  const [telefone, setTelefone] = useState('')
  const [horario, setHorario] = useState('')

  // IA config state
  const [iaProvider, setIaProvider] = useState<string>('gemini')
  const [iaApiKey, setIaApiKey] = useState('')
  const [iaModelo, setIaModelo] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [iaSaving, setIaSaving] = useState(false)
  const [iaTesting, setIaTesting] = useState(false)
  const [iaMsg, setIaMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Per-provider config cache (para preservar key/modelo ao trocar de provider)
  const [providerConfigs, setProviderConfigs] = useState<
    Record<string, { api_key: string; modelo: string }>
  >({
    gemini: { api_key: '', modelo: PROVIDER_DEFAULTS.gemini.modelo },
    openrouter: { api_key: '', modelo: PROVIDER_DEFAULTS.openrouter.modelo }
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [lojaData, iaConfig, stats] = await Promise.all([
        client['config.get_loja'](),
        getConfig(),
        client['config.db_stats']()
      ])

      if (lojaData) {
        setLoja(lojaData as Loja)
        setNome((lojaData as Loja).nome || '')
        setEndereco((lojaData as Loja).endereco || '')
        setTelefone((lojaData as Loja).telefone || '')
        setHorario((lojaData as Loja).horario_func || '')
      }

      if (iaConfig) {
        const config = iaConfig as IaConfiguracao
        const provider = config.provider || 'gemini'
        setIaProvider(provider)

        // Parse provider_configs_json para popular cache por provider
        let perProvider: Record<string, { api_key?: string; modelo?: string }> = {}
        if (config.provider_configs_json) {
          try {
            perProvider =
              typeof config.provider_configs_json === 'string'
                ? JSON.parse(config.provider_configs_json)
                : config.provider_configs_json
          } catch {
            // ignore parse errors
          }
        }

        // Montar cache com dados do DB
        const newConfigs = { ...providerConfigs }
        for (const p of Object.keys(PROVIDER_DEFAULTS)) {
          const saved = perProvider[p]
          newConfigs[p] = {
            api_key:
              p === provider
                ? config.api_key || saved?.api_key || ''
                : saved?.api_key || '',
            modelo:
              p === provider
                ? config.modelo || saved?.modelo || PROVIDER_DEFAULTS[p].modelo
                : saved?.modelo || PROVIDER_DEFAULTS[p].modelo
          }
        }
        setProviderConfigs(newConfigs)

        // Setar campos visiveis para o provider ativo
        setIaApiKey(newConfigs[provider]?.api_key || '')
        setIaModelo(newConfigs[provider]?.modelo || PROVIDER_DEFAULTS[provider].modelo)
      }

      setDbStats(stats as DbStats)
    } catch (err) {
      console.error('Erro ao carregar configuracoes:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleProviderChange(newProvider: string) {
    // Salvar estado atual no cache antes de trocar
    setProviderConfigs((prev) => ({
      ...prev,
      [iaProvider]: { api_key: iaApiKey, modelo: iaModelo }
    }))

    // Carregar estado do novo provider do cache
    const cached = providerConfigs[newProvider]
    setIaProvider(newProvider)
    setIaApiKey(cached?.api_key || '')
    setIaModelo(cached?.modelo || PROVIDER_DEFAULTS[newProvider]?.modelo || '')
    setShowApiKey(false)
    setIaMsg(null)
  }

  async function salvarLoja() {
    setSaving(true)
    setLojaMsg(null)
    try {
      const updated = await client['config.atualizar_loja']({
        changes: { nome, endereco, telefone, horario_func: horario }
      })
      setLoja(updated as Loja)
      setLojaMsg('Salvo!')
      setTimeout(() => setLojaMsg(null), 2000)
    } catch (err) {
      console.error('Erro ao salvar loja:', err)
      setLojaMsg('Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function salvarIaConfig() {
    setIaSaving(true)
    setIaMsg(null)
    try {
      // Atualizar cache com estado atual
      const updatedConfigs = {
        ...providerConfigs,
        [iaProvider]: { api_key: iaApiKey, modelo: iaModelo }
      }
      setProviderConfigs(updatedConfigs)

      await saveConfig({
        provider: iaProvider,
        api_key: iaApiKey || undefined,
        modelo: iaModelo || undefined,
        provider_configs_json: JSON.stringify(updatedConfigs)
      })
      setIaMsg({ text: 'Configuracao salva!', type: 'success' })
      setTimeout(() => setIaMsg(null), 3000)
    } catch (err) {
      console.error('Erro ao salvar config IA:', err)
      setIaMsg({ text: 'Erro ao salvar configuracao', type: 'error' })
    } finally {
      setIaSaving(false)
    }
  }

  async function testarConexao() {
    if (!iaApiKey) return
    setIaTesting(true)
    setIaMsg(null)
    try {
      const result = await testConfig(iaProvider, iaApiKey, iaModelo)
      if (result.sucesso) {
        setIaMsg({ text: result.mensagem || 'Conexao OK!', type: 'success' })
      } else {
        setIaMsg({ text: result.mensagem || 'Falha na conexao', type: 'error' })
      }
    } catch (err) {
      setIaMsg({ text: `Erro: ${String(err)}`, type: 'error' })
    } finally {
      setIaTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Configuracoes</h1>
        <p className="text-muted-foreground mt-4">Carregando...</p>
      </div>
    )
  }

  const currentDefaults = PROVIDER_DEFAULTS[iaProvider] || PROVIDER_DEFAULTS.gemini

  return (
    <div className="p-6 space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Configuracoes</h1>
        <p className="text-muted-foreground mt-1">Configuracoes do sistema</p>
      </div>

      {/* Loja Section */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Loja</h2>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="cfg-nome">Nome</Label>
            <Input id="cfg-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cfg-endereco">Endereco</Label>
            <Input
              id="cfg-endereco"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cfg-telefone">Telefone</Label>
              <Input
                id="cfg-telefone"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cfg-horario">Horario de Funcionamento</Label>
              <Input
                id="cfg-horario"
                value={horario}
                onChange={(e) => setHorario(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={salvarLoja} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar Loja'}
            </Button>
            {lojaMsg && <span className="text-sm text-muted-foreground">{lojaMsg}</span>}
          </div>
        </div>
      </section>

      {/* IA Section — Multi-provider */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Inteligencia Artificial</h2>
        </div>

        <div className="space-y-4">
          {/* Provider selector */}
          <div className="space-y-2">
            <Label>Provider</Label>
            <div className="flex gap-3">
              {Object.entries(PROVIDER_DEFAULTS).map(([key, val]) => (
                <label
                  key={key}
                  className={`flex items-center gap-2 cursor-pointer rounded-lg border px-4 py-2 transition-colors ${
                    iaProvider === key
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="ia-provider"
                    value={key}
                    checked={iaProvider === key}
                    onChange={() => handleProviderChange(key)}
                    className="sr-only"
                  />
                  <div
                    className={`h-3 w-3 rounded-full border-2 ${
                      iaProvider === key ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                    }`}
                  />
                  <span className="text-sm font-medium">{val.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="cfg-ia-apikey">API Key</Label>
            <div className="relative">
              <Input
                id="cfg-ia-apikey"
                type={showApiKey ? 'text' : 'password'}
                value={iaApiKey}
                onChange={(e) => setIaApiKey(e.target.value)}
                placeholder={currentDefaults.placeholder}
                className="font-mono pr-10"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {iaProvider === 'gemini'
                ? 'Obtenha em ai.google.dev'
                : 'Obtenha em openrouter.ai/keys'}
            </p>
          </div>

          {/* Model */}
          <div className="space-y-2">
            <Label htmlFor="cfg-ia-modelo">Modelo</Label>
            <Input
              id="cfg-ia-modelo"
              value={iaModelo}
              onChange={(e) => setIaModelo(e.target.value)}
              placeholder={currentDefaults.modelo}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Padrao: <code className="text-xs">{currentDefaults.modelo}</code>
              {iaModelo && iaModelo !== currentDefaults.modelo && (
                <button
                  type="button"
                  onClick={() => setIaModelo(currentDefaults.modelo)}
                  className="ml-2 text-primary hover:underline"
                >
                  restaurar padrao
                </button>
              )}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button onClick={salvarIaConfig} disabled={iaSaving}>
              {iaSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {iaSaving ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button
              variant="outline"
              onClick={testarConexao}
              disabled={!iaApiKey || iaTesting}
            >
              {iaTesting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plug className="h-4 w-4 mr-2" />
              )}
              {iaTesting ? 'Testando...' : 'Testar Conexao'}
            </Button>
          </div>

          {/* Feedback message */}
          {iaMsg && (
            <div
              className={`flex items-center gap-2 text-sm ${
                iaMsg.type === 'success' ? 'text-green-600' : 'text-red-500'
              }`}
            >
              {iaMsg.type === 'success' ? (
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 flex-shrink-0" />
              )}
              <span>{iaMsg.text}</span>
            </div>
          )}
        </div>
      </section>

      {/* DB Stats Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Dados</h2>
        </div>
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
