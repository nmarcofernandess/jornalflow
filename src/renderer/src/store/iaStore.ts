import { create } from 'zustand'
import type { IaMensagem, IaConversa, ToolCall, IaStreamEvent } from '@shared/types'

// ── Backward compat ────────────────────────────────────────────
// Os consumers antigos (IaPagina, IaChatPanel) acessam msg.role e
// msg.content. IaMensagem usa msg.papel e msg.conteudo. Durante a
// transicao, mensagens no store carregam ambas as propriedades.
// Subtask-1-10 migrara os consumers e removera os campos legado.

export interface IaStoreMessage extends IaMensagem {
  /** @deprecated Use papel. Sera removido em subtask-1-10 */
  role: 'user' | 'assistant'
  /** @deprecated Use conteudo. Sera removido em subtask-1-10 */
  content: string
}

/** Cria IaStoreMessage com propriedades legado a partir de IaMensagem */
function withLegacyProps(msg: IaMensagem): IaStoreMessage {
  return {
    ...msg,
    role: msg.papel === 'usuario' ? 'user' : 'assistant',
    content: msg.conteudo
  }
}

// ── State ──────────────────────────────────────────────────────

interface IaState {
  // Painel (backward compat)
  open: boolean
  loading: boolean

  // Mensagens da conversa ativa
  messages: IaStoreMessage[]

  // Conversas
  conversations: IaConversa[]
  currentConversaId: string | null

  // Streaming (transient — nunca persistido)
  isStreaming: boolean
  streamingText: string
  streamingToolCalls: ToolCall[]
  streamIdAtivo: string | null
  toolsEmAndamento: Record<
    string,
    {
      tool_name: string
      args?: Record<string, unknown>
      estimated_seconds?: number
      started_at: number
    }
  >

  // ── Actions: painel (backward compat) ──
  toggleOpen: () => void
  setOpen: (open: boolean) => void
  setLoading: (loading: boolean) => void

  // ── Actions: mensagens (backward compat addMessage + novos) ──
  addMessage: (
    papelOuMsg: 'user' | 'assistant' | IaMensagem,
    content?: string
  ) => void
  setMessages: (messages: IaMensagem[] | IaStoreMessage[]) => void
  clearMessages: () => void

  // ── Actions: conversas ──
  setConversations: (conversations: IaConversa[]) => void
  setCurrentConversa: (conversaId: string | null) => void

  // ── Actions: streaming ──
  iniciarStream: (streamId: string) => void
  processarStreamEvent: (event: IaStreamEvent) => void
  finalizarStream: () => void
  cancelarStream: () => void
  appendStreamingText: (delta: string) => void
  setStreamingToolCalls: (toolCalls: ToolCall[]) => void
  clearStreaming: () => void
}

// ── Store ───────────────────────────────────────────────────────

export const useIaStore = create<IaState>((set, get) => ({
  // Defaults
  open: false,
  loading: false,
  messages: [],
  conversations: [],
  currentConversaId: null,
  isStreaming: false,
  streamingText: '',
  streamingToolCalls: [],
  streamIdAtivo: null,
  toolsEmAndamento: {},

  // ── Painel ──
  toggleOpen: () => set((s) => ({ open: !s.open })),
  setOpen: (open) => set({ open }),
  setLoading: (loading) => set({ loading }),

  // ── Mensagens ──

  /**
   * Backward-compatible addMessage.
   * Aceita tanto o pattern antigo addMessage('user', 'texto')
   * quanto o novo addMessage(iaMensagem).
   */
  addMessage: (papelOuMsg, content?) => {
    if (typeof papelOuMsg === 'object') {
      // Novo pattern: recebe IaMensagem completa
      const storeMsg = withLegacyProps(papelOuMsg)
      set((s) => ({ messages: [...s.messages, storeMsg] }))
    } else {
      // Pattern antigo: addMessage('user', 'texto')
      const papel = papelOuMsg === 'user' ? 'usuario' : 'assistente'
      const msg: IaMensagem = {
        id: crypto.randomUUID(),
        papel,
        conteudo: content ?? '',
        criada_em: new Date().toISOString()
      }
      set((s) => ({ messages: [...s.messages, withLegacyProps(msg)] }))
    }
  },

  setMessages: (messages) =>
    set({ messages: messages.map((m) => ('role' in m ? m as IaStoreMessage : withLegacyProps(m))) }),
  clearMessages: () => set({ messages: [] }),

  // ── Conversas ──
  setConversations: (conversations) => set({ conversations }),
  setCurrentConversa: (conversaId) => set({ currentConversaId: conversaId }),

  // ── Streaming ──

  iniciarStream: (streamId) =>
    set({
      streamIdAtivo: streamId,
      streamingText: '',
      streamingToolCalls: [],
      toolsEmAndamento: {},
      isStreaming: true,
      loading: true
    }),

  processarStreamEvent: (event) => {
    const { streamIdAtivo } = get()
    if (event.stream_id !== streamIdAtivo) return

    switch (event.type) {
      case 'text-delta':
        set((s) => ({ streamingText: s.streamingText + event.delta }))
        break

      case 'tool-call-start':
        set((s) => ({
          toolsEmAndamento: {
            ...s.toolsEmAndamento,
            [event.tool_call_id]: {
              tool_name: event.tool_name,
              args: event.args,
              estimated_seconds: event.estimated_seconds,
              started_at: Date.now()
            }
          }
        }))
        break

      case 'tool-result': {
        set((s) => {
          const { [event.tool_call_id]: _removed, ...rest } = s.toolsEmAndamento
          return {
            toolsEmAndamento: rest,
            streamingToolCalls: [
              ...s.streamingToolCalls,
              {
                id: event.tool_call_id,
                name: event.tool_name,
                result: event.result
              }
            ]
          }
        })
        break
      }

      case 'follow-up-start':
        // Reset text for follow-up — tools already captured
        set({ streamingText: '' })
        break

      case 'start-step':
        // New step starting — reset text so intermediate step text
        // doesn't bleed into the next step
        if (event.step_index > 0) {
          set({ streamingText: '' })
        }
        break

      case 'step-finish':
        break

      case 'finish':
      case 'error':
        // Handled by the caller via .then/.catch on the IPC invoke
        break
    }
  },

  finalizarStream: () =>
    set({
      streamIdAtivo: null,
      streamingText: '',
      streamingToolCalls: [],
      toolsEmAndamento: {},
      isStreaming: false,
      loading: false
    }),

  cancelarStream: () =>
    set({
      streamIdAtivo: null,
      streamingText: '',
      streamingToolCalls: [],
      toolsEmAndamento: {},
      isStreaming: false,
      loading: false
    }),

  appendStreamingText: (delta) =>
    set((s) => ({ streamingText: s.streamingText + delta })),

  setStreamingToolCalls: (toolCalls) => set({ streamingToolCalls: toolCalls }),

  clearStreaming: () =>
    set({
      streamIdAtivo: null,
      streamingText: '',
      streamingToolCalls: [],
      toolsEmAndamento: {},
      isStreaming: false
    })
}))
