import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

/**
 * Embedding local via @huggingface/transformers (ONNX Runtime).
 * Modelo: multilingual-e5-base (768 dims, ~150-440MB quantizado).
 *
 * ZERO deps externas: funciona offline, sem API key, sem internet.
 * Graceful degradation: retorna null se modelo indisponivel.
 *
 * e5 requer prefixes: "query: " para busca, "passage: " para indexacao.
 */

let _extractor: any = null

function resolveModelPath(): string {
  try {
    const electron = require('electron') as { app?: { isPackaged?: boolean } }
    if (electron.app?.isPackaged) {
      return path.join(process.resourcesPath, 'models', 'embeddings')
    }
  } catch {
    // fallback para modo Node (test runner, scripts)
  }
  // JornalFlow uses getDataDir pattern — put models in data dir
  // But for dev, use relative path from project root
  return path.join(process.cwd(), 'models', 'embeddings')
}

async function getExtractor(): Promise<any> {
  if (_extractor) return _extractor

  const { pipeline, env } = await import('@huggingface/transformers')

  const modelPath = resolveModelPath()
  env.localModelPath = modelPath
  env.allowRemoteModels = false

  console.log('[embeddings] Loading model from:', modelPath)

  _extractor = await pipeline('feature-extraction', 'Xenova/multilingual-e5-base', {
    dtype: 'q8' as any, // quantized int8
  } as any)

  console.log('[embeddings] Model loaded successfully')
  return _extractor
}

/**
 * Gera embedding para uma query de busca (prefix "query: ").
 * Retorna null se modelo indisponivel.
 * Graceful degradation: NUNCA lanca erro — retorna null.
 */
export async function generateQueryEmbedding(text: string): Promise<number[] | null> {
  try {
    const ext = await getExtractor()
    const output = await ext(`query: ${text}`, { pooling: 'mean', normalize: true })
    return Array.from(output.data as Float32Array)
  } catch (err) {
    console.warn('[knowledge:embeddings] Modelo local indisponivel:', (err as Error).message)
    return null
  }
}

/**
 * Gera embedding para um passage/documento (prefix "passage: ").
 * Retorna null se modelo indisponivel.
 * Graceful degradation: NUNCA lanca erro — retorna null.
 */
export async function generatePassageEmbedding(text: string): Promise<number[] | null> {
  try {
    const ext = await getExtractor()
    const output = await ext(`passage: ${text}`, { pooling: 'mean', normalize: true })
    return Array.from(output.data as Float32Array)
  } catch (err) {
    console.warn('[knowledge:embeddings] Modelo local indisponivel:', (err as Error).message)
    return null
  }
}

/**
 * Gera embeddings em lote para passages (prefix "passage: ").
 * Retorna null se modelo indisponivel.
 * Processa sequencialmente para controle de memoria.
 * Graceful degradation: NUNCA lanca erro — retorna null.
 */
export async function generatePassageEmbeddings(texts: string[]): Promise<number[][] | null> {
  try {
    const ext = await getExtractor()
    const results: number[][] = []
    for (const text of texts) {
      const output = await ext(`passage: ${text}`, { pooling: 'mean', normalize: true })
      results.push(Array.from(output.data as Float32Array))
    }
    return results
  } catch (err) {
    console.warn('[knowledge:embeddings] Modelo local indisponivel:', (err as Error).message)
    return null
  }
}
