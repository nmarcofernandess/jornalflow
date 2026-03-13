import { client } from './client'
import type {
  IaConfiguracao,
  IaConversa,
  IaMensagem,
  IaMensagemDB,
  IaStreamEvent,
  IaContexto,
  ToolCall
} from '@shared/types'

// ── Legacy (backward compat) ───────────────────────────────────

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

// ── Streaming ──────────────────────────────────────────────────

/**
 * Envia mensagem via streaming. O backend faz broadcast dos eventos
 * via BrowserWindow.webContents.send('ia:stream', event).
 * Use setupStreamListener() para receber os eventos no renderer.
 */
export async function enviarMensagemStream(
  mensagem: string,
  historico: IaMensagem[],
  streamId: string,
  contexto?: IaContexto,
  conversaId?: string
): Promise<{ resposta: string; acoes: ToolCall[] }> {
  return client['ia.stream']({
    mensagem,
    historico: historico.map((m) => ({
      id: m.id,
      papel: m.papel,
      conteudo: m.conteudo,
      criada_em: m.criada_em,
      tool_calls: m.tool_calls,
      anexos: m.anexos
    })),
    stream_id: streamId,
    contexto: contexto
      ? {
          rota: contexto.rota,
          pagina: contexto.pagina,
          jornal_id: contexto.jornal_id,
          produto_id: contexto.produto_id
        }
      : undefined,
    conversa_id: conversaId
  })
}

/**
 * Escuta eventos de streaming do main process.
 *
 * CRITICO: Retorna funcao de cleanup (unsubscribe).
 * SEMPRE chamar o cleanup no useEffect return ou antes de iniciar novo stream.
 * Sem cleanup = MEMORY LEAK garantido.
 *
 * Pattern de uso no React:
 * ```ts
 * useEffect(() => {
 *   const unsub = setupStreamListener(streamId, {
 *     onTextDelta: (delta) => store.appendStreamingText(delta),
 *     onFinish: (resposta, acoes) => { ... },
 *   })
 *   return unsub
 * }, [streamId])
 * ```
 */
export function setupStreamListener(
  streamId: string,
  callbacks: {
    onTextDelta?: (delta: string) => void
    onToolCallStart?: (
      toolCallId: string,
      toolName: string,
      args: Record<string, unknown>,
      estimatedSeconds?: number
    ) => void
    onToolResult?: (
      toolCallId: string,
      toolName: string,
      result: unknown
    ) => void
    onStepFinish?: (stepIndex: number) => void
    onStartStep?: (stepIndex: number) => void
    onFollowUpStart?: () => void
    onFinish?: (resposta: string, acoes: ToolCall[]) => void
    onError?: (message: string) => void
    /** Raw event handler — receives every event unfiltered */
    onEvent?: (event: IaStreamEvent) => void
  }
): () => void {
  const handler = (_event: unknown, data: IaStreamEvent) => {
    // Filtrar por stream_id para ignorar eventos de outros streams
    if (data.stream_id !== streamId) return

    // Raw handler
    callbacks.onEvent?.(data)

    switch (data.type) {
      case 'text-delta':
        callbacks.onTextDelta?.(data.delta)
        break
      case 'tool-call-start':
        callbacks.onToolCallStart?.(
          data.tool_call_id,
          data.tool_name,
          data.args,
          data.estimated_seconds
        )
        break
      case 'tool-result':
        callbacks.onToolResult?.(
          data.tool_call_id,
          data.tool_name,
          data.result
        )
        break
      case 'start-step':
        callbacks.onStartStep?.(data.step_index)
        break
      case 'step-finish':
        callbacks.onStepFinish?.(data.step_index)
        break
      case 'follow-up-start':
        callbacks.onFollowUpStart?.()
        break
      case 'finish':
        callbacks.onFinish?.(data.resposta, data.acoes)
        break
      case 'error':
        callbacks.onError?.(data.message)
        break
    }
  }

  // window.electron.ipcRenderer.on() retorna uma funcao de unsubscribe
  const unsubscribe = window.electron.ipcRenderer.on(
    'ia:stream',
    handler as Parameters<typeof window.electron.ipcRenderer.on>[1]
  )

  return unsubscribe
}

// ── Config ─────────────────────────────────────────────────────

export async function getConfig(): Promise<IaConfiguracao | null> {
  return client['ia.config.get']()
}

export async function saveConfig(data: {
  provider: string
  api_key?: string
  modelo?: string
  provider_configs_json?: string
}): Promise<{ ok: boolean }> {
  return client['ia.config.save'](data)
}

export async function testConfig(
  provider: string,
  apiKey: string,
  modelo: string
): Promise<{ sucesso: boolean; mensagem: string }> {
  return client['ia.config.test']({ provider, api_key: apiKey, modelo })
}

// ── Conversas ──────────────────────────────────────────────────

export async function listarConversas(
  status?: string
): Promise<IaConversa[]> {
  return client['ia_conversas.listar']({ status })
}

export async function criarConversa(
  titulo?: string
): Promise<{ id: string }> {
  return client['ia_conversas.criar']({ titulo })
}

export async function arquivarConversa(
  conversaId: string
): Promise<{ ok: boolean }> {
  return client['ia_conversas.arquivar']({ conversa_id: conversaId })
}

// ── Mensagens ──────────────────────────────────────────────────

export async function listarMensagens(
  conversaId: string
): Promise<IaMensagemDB[]> {
  return client['ia_mensagens.listar']({ conversa_id: conversaId })
}

export async function salvarMensagem(
  conversaId: string,
  papel: string,
  conteudo: string,
  toolCallsJson?: string,
  anexosMetaJson?: string
): Promise<{ id: string }> {
  return client['ia_mensagens.salvar']({
    conversa_id: conversaId,
    papel,
    conteudo,
    tool_calls_json: toolCallsJson,
    anexos_meta_json: anexosMetaJson
  })
}
