import { useState, useRef, useEffect, useCallback } from 'react'
import { useIaStore } from '@renderer/store/iaStore'
import {
  enviarMensagemStream,
  listarMensagens,
  salvarMensagem,
  criarConversa,
  listarConversas
} from '@renderer/servicos/ia'
import { X, Send, Bot, User, Loader2, Wrench } from 'lucide-react'
import { Badge } from '@renderer/components/ui/badge'
import type { IaMensagem, ToolCall, IaStreamEvent } from '@shared/types'

// ── Tool progress pill (compact) ──────────────────────────────
function ToolPill({
  info
}: {
  info: { tool_name: string; started_at: number }
}) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const interval = setInterval(
      () => setElapsed(Math.floor((Date.now() - info.started_at) / 1000)),
      1000
    )
    return () => clearInterval(interval)
  }, [info.started_at])

  const label = info.tool_name.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

  return (
    <Badge variant="secondary" className="gap-1 text-[10px] animate-pulse py-0.5 px-1.5">
      <Loader2 className="size-2.5 animate-spin" />
      <span>{label}</span>
      {elapsed > 0 && <span className="text-muted-foreground">({elapsed}s)</span>}
    </Badge>
  )
}

export function IaChatPanel() {
  const {
    messages,
    open,
    isStreaming,
    streamingText,
    toolsEmAndamento,
    streamingToolCalls,
    currentConversaId: _currentConversaId,
    toggleOpen,
    addMessage,
    setMessages,
    setConversations,
    setCurrentConversa,
    iniciarStream,
    processarStreamEvent,
    finalizarStream,
    cancelarStream
  } = useIaStore()

  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inicializadoRef = useRef(false)

  // ── Garantir conversa ativa quando painel abre ──
  useEffect(() => {
    if (!open || inicializadoRef.current) return
    inicializadoRef.current = true
    ;(async () => {
      try {
        const state = useIaStore.getState()
        if (!state.currentConversaId) {
          const lista = await listarConversas()
          setConversations(lista)
          if (lista.length > 0) {
            setCurrentConversa(lista[0].id)
            const msgs = await listarMensagens(lista[0].id)
            setMessages(msgs)
          } else {
            const { id } = await criarConversa()
            const novasConversas = await listarConversas()
            setConversations(novasConversas)
            setCurrentConversa(id)
          }
        }
      } catch (err) {
        console.error('[IaChatPanel] Erro ao inicializar:', err)
      }
    })()
  }, [open, setConversations, setCurrentConversa, setMessages])

  // ── Stream event listener ──
  const processarStreamEventStable = useCallback(
    (event: IaStreamEvent) => processarStreamEvent(event),
    [processarStreamEvent]
  )

  useEffect(() => {
    const handler = (...args: unknown[]) => {
      const event = args[0] as IaStreamEvent
      if (event) processarStreamEventStable(event)
    }
    const dispose = window.electron.ipcRenderer.on(
      'ia:stream',
      handler as Parameters<typeof window.electron.ipcRenderer.on>[1]
    )
    return () => {
      dispose?.()
    }
  }, [processarStreamEventStable])

  // ── Auto-scroll ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText, toolsEmAndamento])

  if (!open) return null

  async function handleSend() {
    if (!input.trim() || isStreaming) return
    const text = input.trim()
    setInput('')

    // Adicionar mensagem do usuario
    const userMsg: IaMensagem = {
      id: crypto.randomUUID(),
      papel: 'usuario',
      conteudo: text,
      criada_em: new Date().toISOString()
    }
    addMessage(userMsg)

    // Persistir
    const conversaId = useIaStore.getState().currentConversaId
    if (conversaId) {
      try {
        await salvarMensagem(conversaId, 'usuario', text)
      } catch (err) {
        console.error('[IaChatPanel] Erro ao salvar msg usuario:', err)
      }
    }

    // Iniciar stream
    const streamId = crypto.randomUUID()
    iniciarStream(streamId)

    try {
      const historico = useIaStore.getState().messages.map((m) => ({
        id: m.id,
        papel: m.papel,
        conteudo: m.conteudo,
        criada_em: m.criada_em,
        tool_calls: m.tool_calls,
        anexos: m.anexos
      }))

      const result = await enviarMensagemStream(
        text,
        historico,
        streamId,
        undefined,
        conversaId ?? undefined
      )

      const toolCalls: ToolCall[] = Array.isArray(result?.acoes) ? result.acoes : []
      const assistantMsg: IaMensagem = {
        id: crypto.randomUUID(),
        papel: 'assistente',
        conteudo: result.resposta,
        criada_em: new Date().toISOString(),
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined
      }
      addMessage(assistantMsg)

      // Persistir resposta
      if (conversaId) {
        try {
          await salvarMensagem(
            conversaId,
            'assistente',
            result.resposta,
            toolCalls.length > 0 ? JSON.stringify(toolCalls) : undefined
          )
        } catch (err) {
          console.error('[IaChatPanel] Erro ao salvar msg assistente:', err)
        }
      }

      finalizarStream()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      addMessage({
        id: crypto.randomUUID(),
        papel: 'assistente',
        conteudo: `Erro: ${message}`,
        criada_em: new Date().toISOString()
      })
      cancelarStream()
    }
  }

  const toolsEmAndamentoEntries = Object.entries(toolsEmAndamento)
  const hasStreamingContent =
    streamingText.length > 0 ||
    toolsEmAndamentoEntries.length > 0 ||
    streamingToolCalls.length > 0

  return (
    <div className="w-96 border-l bg-background flex flex-col h-full flex-shrink-0">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4" />
          <span className="font-medium text-sm">Assistente IA</span>
        </div>
        <button onClick={toggleOpen} className="p-1 hover:bg-muted rounded">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {messages.length === 0 && !isStreaming && (
          <div className="text-center text-muted-foreground text-sm mt-8">
            <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Pergunte sobre produtos, jornal ou catalogo</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2 ${msg.papel === 'usuario' ? 'justify-end' : ''}`}
          >
            {msg.papel !== 'usuario' && (
              <Bot className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
            )}
            <div
              className={`rounded-lg px-3 py-2 text-sm max-w-[85%] ${
                msg.papel === 'usuario'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.conteudo}</p>
              {msg.tool_calls && msg.tool_calls.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {msg.tool_calls.map((tc) => (
                    <Badge key={tc.id} variant="outline" className="text-[10px] gap-0.5 py-0">
                      <Wrench className="size-2" />
                      {tc.name.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            {msg.papel === 'usuario' && (
              <User className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
            )}
          </div>
        ))}

        {/* ── Streaming indicators ── */}
        {isStreaming && (
          <div className="space-y-2">
            {/* Tools em andamento */}
            {toolsEmAndamentoEntries.length > 0 && (
              <div className="flex flex-wrap gap-1 ml-7">
                {toolsEmAndamentoEntries.map(([id, info]) => (
                  <ToolPill key={id} info={info} />
                ))}
              </div>
            )}

            {/* Tool calls concluidas neste stream */}
            {streamingToolCalls.length > 0 && (
              <div className="flex flex-wrap gap-1 ml-7">
                {streamingToolCalls.map((tc) => (
                  <Badge
                    key={tc.id}
                    variant="outline"
                    className="text-[10px] gap-0.5 py-0 opacity-60"
                  >
                    <Wrench className="size-2" />
                    {tc.name.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            )}

            {/* Texto parcial */}
            {streamingText.length > 0 ? (
              <div className="flex gap-2">
                <Bot className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
                <div className="bg-muted rounded-lg px-3 py-2 text-sm max-w-[85%]">
                  <p className="whitespace-pre-wrap">{streamingText}</p>
                  <span className="inline-block w-1 h-3.5 ml-0.5 bg-foreground/60 animate-pulse rounded-sm align-text-bottom" />
                </div>
              </div>
            ) : !hasStreamingContent ? (
              <div className="flex gap-2">
                <Bot className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
                <div className="bg-muted rounded-lg px-3 py-2 flex items-center gap-1.5">
                  <div className="flex gap-0.5">
                    <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                    <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                    <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                  </div>
                  <span className="text-xs text-muted-foreground">Pensando...</span>
                </div>
              </div>
            ) : null}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Pergunte algo..."
            className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isStreaming}
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className="p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
