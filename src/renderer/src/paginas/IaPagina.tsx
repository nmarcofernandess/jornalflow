import { useState, useRef, useEffect, useCallback } from 'react'
import { useIaStore } from '@renderer/store/iaStore'
import {
  enviarMensagemStream,
  listarConversas,
  criarConversa,
  arquivarConversa,
  listarMensagens,
  salvarMensagem
} from '@renderer/servicos/ia'
import {
  Send,
  Bot,
  User,
  Loader2,
  Plus,
  MessageSquare,
  Archive,
  PanelLeft,
  PanelLeftClose,
  Wrench
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import type { IaMensagem, IaConversa, ToolCall, IaStreamEvent } from '@shared/types'

// ── Tool progress pill ────────────────────────────────────────
function ToolProgressPill({
  info
}: {
  info: { tool_name: string; estimated_seconds?: number; started_at: number }
}) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const interval = setInterval(
      () => setElapsed(Math.floor((Date.now() - info.started_at) / 1000)),
      1000
    )
    return () => clearInterval(interval)
  }, [info.started_at])

  // Humanizar nome da tool: buscar_produtos -> Buscar produtos
  const label = info.tool_name.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

  return (
    <Badge variant="secondary" className="gap-1.5 text-xs animate-pulse py-1">
      <Loader2 className="size-3 animate-spin" />
      <span>{label}</span>
      {elapsed > 0 && <span className="text-muted-foreground">({elapsed}s)</span>}
    </Badge>
  )
}

// ── Conversation item ─────────────────────────────────────────
function ConversaItem({
  conversa,
  isActive,
  onSelect,
  onArchive
}: {
  conversa: IaConversa
  isActive: boolean
  onSelect: () => void
  onArchive: () => void
}) {
  const data = new Date(conversa.atualizada_em).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })

  return (
    <div
      onClick={onSelect}
      className={`group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-sm transition-colors ${
        isActive
          ? 'bg-primary/10 text-primary font-medium'
          : 'hover:bg-muted text-foreground'
      }`}
    >
      <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="truncate">{conversa.titulo || 'Nova conversa'}</p>
        <p className="text-xs text-muted-foreground">{data}</p>
      </div>
      {conversa.status !== 'arquivada' && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onArchive()
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-opacity"
          title="Arquivar conversa"
        >
          <Archive className="size-3 text-muted-foreground" />
        </button>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function IaPagina() {
  const {
    messages,
    isStreaming,
    streamingText,
    toolsEmAndamento,
    streamingToolCalls,
    conversations,
    currentConversaId,
    addMessage,
    setMessages,
    setConversations,
    setCurrentConversa,
    iniciarStream,
    processarStreamEvent,
    finalizarStream,
    cancelarStream,
    clearMessages
  } = useIaStore()

  const [input, setInput] = useState('')
  const [sidebarAberta, setSidebarAberta] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inicializadoRef = useRef(false)

  // ── Inicializar: carregar conversas ──
  useEffect(() => {
    if (inicializadoRef.current) return
    inicializadoRef.current = true
    ;(async () => {
      try {
        const lista = await listarConversas()
        setConversations(lista)
        // Se nao tem conversa ativa, criar uma
        if (lista.length === 0) {
          const { id } = await criarConversa()
          const novasConversas = await listarConversas()
          setConversations(novasConversas)
          setCurrentConversa(id)
        } else if (!useIaStore.getState().currentConversaId) {
          // Carregar a mais recente
          const maisRecente = lista[0]
          setCurrentConversa(maisRecente.id)
          const msgs = await listarMensagens(maisRecente.id)
          setMessages(msgs)
        }
      } catch (err) {
        console.error('[IaPagina] Erro ao inicializar conversas:', err)
      }
    })()
  }, [setConversations, setCurrentConversa, setMessages])

  // ── Stream event listener (global — escuta todos os eventos) ──
  const processarStreamEventStable = useCallback(
    (event: IaStreamEvent) => processarStreamEvent(event),
    [processarStreamEvent]
  )

  useEffect(() => {
    // Escutar diretamente no ipcRenderer — processarStreamEvent no store
    // ja filtra por streamIdAtivo, entao recebemos todos os eventos e
    // delegamos a filtragem pro store.
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

  // ── Carregar conversa ──
  async function carregarConversa(conversaId: string) {
    if (conversaId === currentConversaId) return
    // Cleanup do stream ativo, se houver
    if (isStreaming) {
      cancelarStream()
    }
    setCurrentConversa(conversaId)
    try {
      const msgs = await listarMensagens(conversaId)
      setMessages(msgs)
    } catch (err) {
      console.error('[IaPagina] Erro ao carregar mensagens:', err)
      clearMessages()
    }
  }

  // ── Nova conversa ──
  async function novaConversa() {
    try {
      const { id } = await criarConversa()
      const lista = await listarConversas()
      setConversations(lista)
      setCurrentConversa(id)
      clearMessages()
    } catch (err) {
      console.error('[IaPagina] Erro ao criar conversa:', err)
    }
  }

  // ── Arquivar conversa ──
  async function handleArquivar(conversaId: string) {
    try {
      await arquivarConversa(conversaId)
      const lista = await listarConversas()
      setConversations(lista)
      // Se arquivou a conversa ativa, criar nova
      if (conversaId === currentConversaId) {
        if (lista.length > 0) {
          await carregarConversa(lista[0].id)
        } else {
          await novaConversa()
        }
      }
    } catch (err) {
      console.error('[IaPagina] Erro ao arquivar:', err)
    }
  }

  // ── Enviar mensagem via streaming ──
  async function handleSend() {
    if (!input.trim() || isStreaming) return
    const text = input.trim()
    setInput('')

    // Adicionar mensagem do usuario ao store
    const userMsg: IaMensagem = {
      id: crypto.randomUUID(),
      papel: 'usuario',
      conteudo: text,
      criada_em: new Date().toISOString()
    }
    addMessage(userMsg)

    // Persistir mensagem do usuario
    if (currentConversaId) {
      try {
        await salvarMensagem(currentConversaId, 'usuario', text)
      } catch (err) {
        console.error('[IaPagina] Erro ao salvar mensagem usuario:', err)
      }
    }

    // Iniciar stream
    const streamId = crypto.randomUUID()
    iniciarStream(streamId)

    try {
      // Historico para o backend — todas as mensagens atuais
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
        undefined, // contexto — sera adicionado em Phase 2
        currentConversaId ?? undefined
      )

      // Adicionar resposta do assistente ao store
      const toolCalls: ToolCall[] = Array.isArray(result?.acoes) ? result.acoes : []
      const assistantMsg: IaMensagem = {
        id: crypto.randomUUID(),
        papel: 'assistente',
        conteudo: result.resposta,
        criada_em: new Date().toISOString(),
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined
      }
      addMessage(assistantMsg)

      // Persistir resposta do assistente
      if (currentConversaId) {
        try {
          await salvarMensagem(
            currentConversaId,
            'assistente',
            result.resposta,
            toolCalls.length > 0 ? JSON.stringify(toolCalls) : undefined
          )
        } catch (err) {
          console.error('[IaPagina] Erro ao salvar mensagem assistente:', err)
        }
      }

      finalizarStream()

      // Atualizar lista de conversas (titulo pode ter mudado)
      try {
        const lista = await listarConversas()
        setConversations(lista)
      } catch {
        // silencioso
      }
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

  // Separar conversas ativas e arquivadas
  const conversasAtivas = conversations.filter((c) => c.status !== 'arquivada')

  return (
    <div className="flex h-full">
      {/* ── Sidebar: conversas ── */}
      {sidebarAberta && (
        <div className="w-64 border-r flex flex-col h-full bg-muted/30 shrink-0">
          <div className="p-3 border-b flex items-center justify-between">
            <span className="text-sm font-medium">Conversas</span>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={novaConversa}>
              <Plus className="size-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-auto p-2 space-y-0.5">
            {conversasAtivas.length === 0 && (
              <div className="text-center text-muted-foreground text-xs mt-8">
                <MessageSquare className="size-6 mx-auto mb-2 opacity-30" />
                <p>Nenhuma conversa</p>
              </div>
            )}
            {conversasAtivas.map((c) => (
              <ConversaItem
                key={c.id}
                conversa={c}
                isActive={c.id === currentConversaId}
                onSelect={() => carregarConversa(c.id)}
                onArchive={() => handleArquivar(c.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Main chat area ── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="p-3 border-b flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => setSidebarAberta((v) => !v)}
          >
            {sidebarAberta ? (
              <PanelLeftClose className="size-4" />
            ) : (
              <PanelLeft className="size-4" />
            )}
          </Button>
          <Bot className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-sm font-medium">Assistente IA</h1>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {messages.length === 0 && !isStreaming && (
            <div className="text-center text-muted-foreground mt-16">
              <Bot className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Pergunte sobre produtos, jornal ou catalogo</p>
              <p className="text-xs mt-1 text-muted-foreground/60">
                A IA tem acesso ao banco de dados e pode consultar, cadastrar e atualizar
                informacoes
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.papel === 'usuario' ? 'justify-end' : ''}`}
            >
              {msg.papel !== 'usuario' && (
                <Bot className="h-6 w-6 mt-0.5 text-muted-foreground shrink-0" />
              )}
              <div
                className={`rounded-lg px-4 py-3 text-sm max-w-[70%] ${
                  msg.papel === 'usuario'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.conteudo}</p>
                {/* Tool calls finalizadas nessa mensagem */}
                {msg.tool_calls && msg.tool_calls.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {msg.tool_calls.map((tc) => (
                      <Badge key={tc.id} variant="outline" className="text-xs gap-1">
                        <Wrench className="size-2.5" />
                        {tc.name.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              {msg.papel === 'usuario' && (
                <User className="h-6 w-6 mt-0.5 text-muted-foreground shrink-0" />
              )}
            </div>
          ))}

          {/* ── Streaming indicators ── */}
          {isStreaming && (
            <div className="space-y-2">
              {/* Tools em andamento — pills com countdown */}
              {toolsEmAndamentoEntries.length > 0 && (
                <div className="flex flex-wrap gap-1.5 ml-9">
                  {toolsEmAndamentoEntries.map(([id, info]) => (
                    <ToolProgressPill key={id} info={info} />
                  ))}
                </div>
              )}

              {/* Tool calls ja concluidas nesse stream */}
              {streamingToolCalls.length > 0 && (
                <div className="flex flex-wrap gap-1 ml-9">
                  {streamingToolCalls.map((tc) => (
                    <Badge key={tc.id} variant="outline" className="text-xs gap-1 opacity-60">
                      <Wrench className="size-2.5" />
                      {tc.name.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Texto parcial — streaming progressivo */}
              {streamingText.length > 0 ? (
                <div className="flex gap-3">
                  <Bot className="h-6 w-6 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="bg-muted rounded-lg px-4 py-3 text-sm max-w-[70%]">
                    <p className="whitespace-pre-wrap">{streamingText}</p>
                    <span className="inline-block w-1.5 h-4 ml-0.5 bg-foreground/60 animate-pulse rounded-sm align-text-bottom" />
                  </div>
                </div>
              ) : !hasStreamingContent ? (
                /* Fallback: bouncing dots quando nada esta visivel ainda */
                <div className="flex gap-3">
                  <Bot className="h-6 w-6 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="bg-muted rounded-lg px-4 py-3 flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                      <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                      <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                    </div>
                    <span className="text-sm text-muted-foreground">Pensando...</span>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t">
          <div className="flex gap-2 max-w-3xl mx-auto">
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
    </div>
  )
}
