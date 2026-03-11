import { useState, useRef, useEffect } from 'react'
import { useIaStore } from '@renderer/store/iaStore'
import { enviarMensagem } from '@renderer/servicos/ia'
import { X, Send, Bot, User, Loader2 } from 'lucide-react'

export function IaChatPanel() {
  const { messages, open, loading, toggleOpen, addMessage, setLoading } = useIaStore()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!open) return null

  async function handleSend() {
    if (!input.trim() || loading) return
    const text = input.trim()
    setInput('')

    addMessage('user', text)
    setLoading(true)

    try {
      const allMessages = useIaStore
        .getState()
        .messages.map((m) => ({ role: m.role, content: m.content }))
      const result = await enviarMensagem(allMessages)
      addMessage('assistant', result.response)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      addMessage('assistant', `Erro: ${message}`)
    } finally {
      setLoading(false)
    }
  }

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
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm mt-8">
            <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Pergunte sobre produtos, jornal ou catalogo</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && (
              <Bot className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
            )}
            <div
              className={`rounded-lg px-3 py-2 text-sm max-w-[85%] ${
                msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
            {msg.role === 'user' && (
              <User className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <Bot className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
            <div className="bg-muted rounded-lg px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
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
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
