import { client } from './client'

export async function enviarMensagem(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
) {
  return client['ia.chat']({ messages })
}

export async function setApiKey(key: string) {
  return client['ia.set_api_key']({ key })
}

export async function getApiKey() {
  return client['ia.get_api_key']()
}
