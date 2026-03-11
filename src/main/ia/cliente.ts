import { generateText, stepCountIs } from 'ai'
import { getModel } from './config'
import { SISTEMA_PROMPT } from './sistema-prompt'
import { iaTools } from './tools'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function chat(messages: ChatMessage[]): Promise<string> {
  const model = getModel()

  const result = await generateText({
    model,
    system: SISTEMA_PROMPT,
    messages,
    tools: iaTools,
    stopWhen: stepCountIs(10)
  })

  return result.text
}
