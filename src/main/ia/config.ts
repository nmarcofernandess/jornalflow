import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import type { LanguageModel } from 'ai'
import type { IaConfiguracao } from '../../shared/types'

// ---------------------------------------------------------------------------
// Provider defaults — modelos padrao por provider
// ---------------------------------------------------------------------------

export const PROVIDER_DEFAULTS: Record<'gemini' | 'openrouter', string> = {
  gemini: 'gemini-2.0-flash',
  openrouter: 'openrouter/free'
}

// ---------------------------------------------------------------------------
// resolveModel — resolve o model ID para o provider ativo
// ---------------------------------------------------------------------------

/**
 * Resolve o model ID correto para o provider ativo.
 *
 * Ordem de prioridade:
 * 1. provider_configs_json[provider].modelo  -- modelo salvo por provider (fonte canonica)
 * 2. config.modelo                            -- modelo do provider ativo
 * 3. PROVIDER_DEFAULTS[provider]             -- fallback hard-coded
 *
 * Validacao extra para OpenRouter: exige formato 'namespace/model'.
 * Se o modelo nao tiver '/', veio de outro provider e e descartado.
 */
export function resolveModel(
  config: IaConfiguracao,
  providerLabel: 'gemini' | 'openrouter'
): string {
  // 1. Tenta ler do provider_configs_json[provider].modelo
  if (config.provider_configs_json) {
    try {
      const configs =
        typeof config.provider_configs_json === 'string'
          ? JSON.parse(config.provider_configs_json)
          : config.provider_configs_json
      const perProviderModelo = configs?.[providerLabel]?.modelo?.trim()
      if (perProviderModelo && isValidModelForProvider(providerLabel, perProviderModelo)) {
        return perProviderModelo
      }
    } catch {
      /* fallback */
    }
  }

  // 2. Tenta config.modelo (campo global do provider ativo)
  const globalModelo = config.modelo?.trim()
  if (globalModelo && isValidModelForProvider(providerLabel, globalModelo)) {
    return globalModelo
  }

  // 3. Default por provider
  return PROVIDER_DEFAULTS[providerLabel]
}

// ---------------------------------------------------------------------------
// isValidModelForProvider — valida se o modelo e compativel com o provider
// ---------------------------------------------------------------------------

export function isValidModelForProvider(provider: string, modelo: string): boolean {
  if (!modelo) return false
  if (provider === 'openrouter') {
    // OpenRouter exige 'namespace/model' (ex: 'anthropic/claude-sonnet-4', 'google/gemini-2.5-flash')
    return modelo.includes('/')
  }
  // Gemini: nao deve ter namespace (nao pode ser 'google/algo')
  if (provider === 'gemini') {
    return !modelo.includes('/')
  }
  return true
}

// ---------------------------------------------------------------------------
// resolveProviderApiKey — resolve a API key para o provider ativo
// ---------------------------------------------------------------------------

export function resolveProviderApiKey(config: IaConfiguracao): string | undefined {
  // provider_configs_json tem prioridade — e onde a UI multi-provider salva tokens
  if (config.provider_configs_json) {
    try {
      const configs =
        typeof config.provider_configs_json === 'string'
          ? JSON.parse(config.provider_configs_json)
          : config.provider_configs_json
      const providerCfg = configs?.[config.provider]
      if (providerCfg?.token?.trim()) return providerCfg.token.trim()
    } catch {
      /* fallback to api_key */
    }
  }
  return config.api_key || undefined
}

// ---------------------------------------------------------------------------
// buildModelFactory — cria factory de LanguageModel a partir da config do DB
// ---------------------------------------------------------------------------

/**
 * Cria uma model factory + modelo resolvido a partir da config do DB.
 * Usado por cliente.ts, session-processor.ts e tipc.ts.
 * Retorna null se API key nao configurada.
 */
export function buildModelFactory(config: IaConfiguracao): {
  createModel: (modelo: string) => LanguageModel
  modelo: string
} | null {
  const key = resolveProviderApiKey(config)
  if (!key) return null

  const provider = config.provider as 'gemini' | 'openrouter'
  const modelo = resolveModel(config, provider)

  if (provider === 'gemini') {
    const google = createGoogleGenerativeAI({ apiKey: key })
    return { createModel: (m) => google(m) as LanguageModel, modelo }
  }

  if (provider === 'openrouter') {
    const openrouter = createOpenRouter({ apiKey: key })
    return { createModel: (m) => openrouter(m) as LanguageModel, modelo }
  }

  return null
}

// ---------------------------------------------------------------------------
// DEPRECATED — funcoes legadas mantidas para backward compat
// Serao removidas quando cliente.ts, index.ts, tipc.ts e ia-revisor.ts
// forem atualizados nos subtasks 1-6a, 1-7a, 1-8
// ---------------------------------------------------------------------------

/** @deprecated Use buildModelFactory(config) com config do DB */
let _legacyApiKey: string | null = null

/** @deprecated Use DB-backed config */
export function setApiKey(key: string): void {
  _legacyApiKey = key
}

/** @deprecated Use resolveProviderApiKey(config) */
export function getApiKey(): string | null {
  return _legacyApiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || null
}

/** @deprecated Use buildModelFactory(config) */
export function getProvider() {
  const key = getApiKey()
  if (!key) throw new Error('API key do Gemini nao configurada')
  return createGoogleGenerativeAI({ apiKey: key })
}

/** @deprecated Use buildModelFactory(config).createModel(modelo) */
export function getModel() {
  const provider = getProvider()
  return provider(PROVIDER_DEFAULTS.gemini)
}
