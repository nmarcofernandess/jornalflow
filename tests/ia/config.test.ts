import { describe, it, expect } from 'vitest'
import {
  PROVIDER_DEFAULTS,
  resolveModel,
  isValidModelForProvider,
  resolveProviderApiKey,
  buildModelFactory,
} from '../../src/main/ia/config'
import type { IaConfiguracao } from '../../src/shared/types'

// ---------------------------------------------------------------------------
// Helper — cria IaConfiguracao fake para testes puros (sem DB)
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<IaConfiguracao> = {}): IaConfiguracao {
  return {
    id: 1,
    provider: 'gemini',
    api_key: null,
    modelo: null,
    provider_configs_json: '{}',
    ativo: true,
    memoria_automatica: false,
    ...overrides,
  }
}

// ===========================================================================
// PROVIDER_DEFAULTS
// ===========================================================================

describe('PROVIDER_DEFAULTS', () => {
  it('deve ter entrada para gemini', () => {
    expect(PROVIDER_DEFAULTS.gemini).toBeDefined()
    expect(typeof PROVIDER_DEFAULTS.gemini).toBe('string')
  })

  it('deve ter entrada para openrouter', () => {
    expect(PROVIDER_DEFAULTS.openrouter).toBeDefined()
    expect(typeof PROVIDER_DEFAULTS.openrouter).toBe('string')
  })
})

// ===========================================================================
// resolveModel
// ===========================================================================

describe('resolveModel', () => {
  it('retorna modelo do provider_configs_json quando disponivel', () => {
    const config = makeConfig({
      provider: 'gemini',
      modelo: 'gemini-1.5-pro',
      provider_configs_json: JSON.stringify({
        gemini: { modelo: 'gemini-2.5-flash' },
      }),
    })
    expect(resolveModel(config, 'gemini')).toBe('gemini-2.5-flash')
  })

  it('retorna config.modelo quando provider_configs_json nao tem modelo', () => {
    const config = makeConfig({
      provider: 'gemini',
      modelo: 'gemini-1.5-pro',
      provider_configs_json: '{}',
    })
    expect(resolveModel(config, 'gemini')).toBe('gemini-1.5-pro')
  })

  it('retorna default quando nenhum modelo configurado', () => {
    const config = makeConfig({
      provider: 'gemini',
      modelo: null,
      provider_configs_json: '{}',
    })
    expect(resolveModel(config, 'gemini')).toBe(PROVIDER_DEFAULTS.gemini)
  })

  it('retorna default do openrouter quando modelo gemini esta no campo global', () => {
    // Modelo sem "/" nao e valido para openrouter, deve cair no default
    const config = makeConfig({
      provider: 'openrouter',
      modelo: 'gemini-2.0-flash',
      provider_configs_json: '{}',
    })
    expect(resolveModel(config, 'openrouter')).toBe(PROVIDER_DEFAULTS.openrouter)
  })

  it('retorna modelo do openrouter com namespace valido', () => {
    const config = makeConfig({
      provider: 'openrouter',
      modelo: 'anthropic/claude-sonnet-4',
      provider_configs_json: '{}',
    })
    expect(resolveModel(config, 'openrouter')).toBe('anthropic/claude-sonnet-4')
  })

  it('ignora provider_configs_json invalido (nao JSON) e usa fallback', () => {
    const config = makeConfig({
      provider: 'gemini',
      modelo: 'gemini-1.5-pro',
      provider_configs_json: 'not-json',
    })
    expect(resolveModel(config, 'gemini')).toBe('gemini-1.5-pro')
  })

  it('aceita provider_configs_json como objeto (nao string)', () => {
    const config = makeConfig({
      provider: 'gemini',
      // Simula cenario onde JSON ja foi parseado (ex: mock direto)
      provider_configs_json: { gemini: { modelo: 'gemini-2.5-pro' } } as any,
    })
    expect(resolveModel(config, 'gemini')).toBe('gemini-2.5-pro')
  })
})

// ===========================================================================
// isValidModelForProvider
// ===========================================================================

describe('isValidModelForProvider', () => {
  it('retorna true para modelo gemini sem namespace', () => {
    expect(isValidModelForProvider('gemini', 'gemini-2.0-flash')).toBe(true)
  })

  it('retorna false para modelo gemini com namespace', () => {
    expect(isValidModelForProvider('gemini', 'google/gemini-2.0-flash')).toBe(false)
  })

  it('retorna true para modelo openrouter com namespace', () => {
    expect(isValidModelForProvider('openrouter', 'anthropic/claude-sonnet-4')).toBe(true)
  })

  it('retorna false para modelo openrouter sem namespace', () => {
    expect(isValidModelForProvider('openrouter', 'gemini-2.0-flash')).toBe(false)
  })

  it('retorna false para modelo vazio', () => {
    expect(isValidModelForProvider('gemini', '')).toBe(false)
    expect(isValidModelForProvider('openrouter', '')).toBe(false)
  })

  it('retorna true para provider desconhecido (sem validacao especifica)', () => {
    expect(isValidModelForProvider('outro', 'qualquer-modelo')).toBe(true)
  })
})

// ===========================================================================
// resolveProviderApiKey
// ===========================================================================

describe('resolveProviderApiKey', () => {
  it('retorna api_key do config quando nao tem provider_configs_json', () => {
    const config = makeConfig({
      provider: 'gemini',
      api_key: 'AIza-test-key-123',
      provider_configs_json: '{}',
    })
    expect(resolveProviderApiKey(config)).toBe('AIza-test-key-123')
  })

  it('retorna token do provider_configs_json com prioridade', () => {
    const config = makeConfig({
      provider: 'gemini',
      api_key: 'old-key',
      provider_configs_json: JSON.stringify({
        gemini: { token: 'new-key-from-configs' },
      }),
    })
    expect(resolveProviderApiKey(config)).toBe('new-key-from-configs')
  })

  it('faz fallback para api_key quando provider_configs_json nao tem token', () => {
    const config = makeConfig({
      provider: 'openrouter',
      api_key: 'or-key-fallback',
      provider_configs_json: JSON.stringify({
        openrouter: { modelo: 'some/model' }, // sem token
      }),
    })
    expect(resolveProviderApiKey(config)).toBe('or-key-fallback')
  })

  it('retorna undefined quando nenhuma key configurada', () => {
    const config = makeConfig({
      provider: 'gemini',
      api_key: null,
      provider_configs_json: '{}',
    })
    expect(resolveProviderApiKey(config)).toBeUndefined()
  })

  it('ignora token com apenas espacos', () => {
    const config = makeConfig({
      provider: 'gemini',
      api_key: 'fallback-key',
      provider_configs_json: JSON.stringify({
        gemini: { token: '   ' },
      }),
    })
    expect(resolveProviderApiKey(config)).toBe('fallback-key')
  })

  it('ignora provider_configs_json invalido (nao JSON)', () => {
    const config = makeConfig({
      provider: 'gemini',
      api_key: 'fallback-key',
      provider_configs_json: 'broken-json',
    })
    expect(resolveProviderApiKey(config)).toBe('fallback-key')
  })
})

// ===========================================================================
// buildModelFactory
// ===========================================================================

describe('buildModelFactory', () => {
  it('retorna funcao createModel para gemini com api_key', () => {
    const config = makeConfig({
      provider: 'gemini',
      api_key: 'AIza-test-key',
    })
    const factory = buildModelFactory(config)
    expect(factory).not.toBeNull()
    expect(typeof factory!.createModel).toBe('function')
    expect(factory!.modelo).toBe(PROVIDER_DEFAULTS.gemini)
  })

  it('retorna funcao createModel para openrouter com api_key', () => {
    const config = makeConfig({
      provider: 'openrouter',
      api_key: 'sk-or-test-key',
    })
    const factory = buildModelFactory(config)
    expect(factory).not.toBeNull()
    expect(typeof factory!.createModel).toBe('function')
    expect(factory!.modelo).toBe(PROVIDER_DEFAULTS.openrouter)
  })

  it('retorna null quando nao tem api_key', () => {
    const config = makeConfig({
      provider: 'gemini',
      api_key: null,
      provider_configs_json: '{}',
    })
    expect(buildModelFactory(config)).toBeNull()
  })

  it('retorna null para provider desconhecido', () => {
    const config = makeConfig({
      provider: 'outro-provider',
      api_key: 'some-key',
    })
    expect(buildModelFactory(config)).toBeNull()
  })

  it('usa modelo resolvido do provider_configs_json', () => {
    const config = makeConfig({
      provider: 'gemini',
      api_key: 'AIza-test-key',
      provider_configs_json: JSON.stringify({
        gemini: { modelo: 'gemini-2.5-pro' },
      }),
    })
    const factory = buildModelFactory(config)
    expect(factory).not.toBeNull()
    expect(factory!.modelo).toBe('gemini-2.5-pro')
  })
})
