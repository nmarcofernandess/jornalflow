import { createGoogleGenerativeAI } from '@ai-sdk/google'

let apiKey: string | null = null

export function setApiKey(key: string) {
  apiKey = key
}

export function getApiKey(): string | null {
  return apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || null
}

export function getProvider() {
  const key = getApiKey()
  if (!key) throw new Error('API key do Gemini não configurada')
  return createGoogleGenerativeAI({ apiKey: key })
}

export function getModel() {
  const provider = getProvider()
  return provider('gemini-2.5-flash')
}
