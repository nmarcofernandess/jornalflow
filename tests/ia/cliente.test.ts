import { describe, it, expect, vi, beforeAll } from 'vitest'

// ---------------------------------------------------------------------------
// Mock electron — cliente.ts usa createRequire('electron') no top level
// para acessar BrowserWindow.getAllWindows() (broadcasting de stream events).
// Em ambiente de teste vitest nao temos Electron, entao mockamos o modulo.
// ---------------------------------------------------------------------------

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => [],
  },
}))

import { __iaClienteTestables } from '../../src/main/ia/cliente'
import type { IaMensagem, ToolCall } from '../../src/shared/types'

const { normalizeToolArgs, buildChatMessages, extractToolCallsFromSteps, buildFullSystemPrompt } =
  __iaClienteTestables

// ===========================================================================
// normalizeToolArgs
// ===========================================================================

describe('normalizeToolArgs', () => {
  it('retorna objeto quando input e objeto', () => {
    const input = { termo: 'chocolate', limite: 10 }
    const result = normalizeToolArgs(input)
    expect(result).toEqual({ termo: 'chocolate', limite: 10 })
  })

  it('retorna undefined quando input e undefined', () => {
    expect(normalizeToolArgs(undefined)).toBeUndefined()
  })

  it('wrapa primitivo string em {value}', () => {
    const result = normalizeToolArgs('hello')
    expect(result).toEqual({ value: 'hello' })
  })

  it('wrapa primitivo number em {value}', () => {
    const result = normalizeToolArgs(42)
    expect(result).toEqual({ value: 42 })
  })

  it('wrapa primitivo boolean em {value}', () => {
    const result = normalizeToolArgs(true)
    expect(result).toEqual({ value: true })
  })

  it('wrapa null em {value}', () => {
    const result = normalizeToolArgs(null)
    expect(result).toEqual({ value: null })
  })

  it('wrapa array em {value}', () => {
    const result = normalizeToolArgs([1, 2, 3])
    expect(result).toEqual({ value: [1, 2, 3] })
  })
})

// ===========================================================================
// buildChatMessages
// ===========================================================================

describe('buildChatMessages', () => {
  it('retorna apenas mensagem do usuario quando historico vazio', () => {
    const messages = buildChatMessages([], 'Ola')
    expect(messages).toHaveLength(1)
    expect(messages[0]).toEqual({ role: 'user', content: 'Ola' })
  })

  it('converte historico user+assistant corretamente', () => {
    const historico: IaMensagem[] = [
      { id: '1', papel: 'usuario', conteudo: 'Busca chocolate', criada_em: '2026-01-01T00:00:00Z' },
      { id: '2', papel: 'assistente', conteudo: 'Encontrei 3 produtos.', criada_em: '2026-01-01T00:00:01Z' },
    ]
    const messages = buildChatMessages(historico, 'Qual o preco?')

    expect(messages).toHaveLength(3)
    expect(messages[0]).toEqual({ role: 'user', content: 'Busca chocolate' })
    expect(messages[1]).toEqual({ role: 'assistant', content: 'Encontrei 3 produtos.' })
    expect(messages[2]).toEqual({ role: 'user', content: 'Qual o preco?' })
  })

  it('converte assistant com tool_calls em par tool-call + tool-result', () => {
    const toolCalls: ToolCall[] = [
      {
        id: 'tc-1',
        name: 'buscar_produtos',
        args: { termo: 'leite' },
        result: { found: true, total: 2, produtos: [] },
      },
    ]
    const historico: IaMensagem[] = [
      { id: '1', papel: 'usuario', conteudo: 'Busca leite', criada_em: '2026-01-01T00:00:00Z' },
      {
        id: '2',
        papel: 'assistente',
        conteudo: 'Encontrei produtos.',
        criada_em: '2026-01-01T00:00:01Z',
        tool_calls: toolCalls,
      },
    ]
    const messages = buildChatMessages(historico, 'Detalhes')

    // Deve ter: user msg, assistant com tool-call content, tool msg com result, user msg atual
    expect(messages).toHaveLength(4)
    expect(messages[0]).toEqual({ role: 'user', content: 'Busca leite' })

    // Assistant com tool-call content parts
    const assistantMsg = messages[1] as any
    expect(assistantMsg.role).toBe('assistant')
    expect(Array.isArray(assistantMsg.content)).toBe(true)
    expect(assistantMsg.content[0]).toEqual({ type: 'text', text: 'Encontrei produtos.' })
    expect(assistantMsg.content[1]).toEqual({
      type: 'tool-call',
      toolCallId: 'tc-1',
      toolName: 'buscar_produtos',
      input: { termo: 'leite' },
    })

    // Tool message com result parts
    const toolMsg = messages[2] as any
    expect(toolMsg.role).toBe('tool')
    expect(Array.isArray(toolMsg.content)).toBe(true)
    expect(toolMsg.content[0].type).toBe('tool-result')
    expect(toolMsg.content[0].toolCallId).toBe('tc-1')
    expect(toolMsg.content[0].toolName).toBe('buscar_produtos')

    // Mensagem atual
    expect(messages[3]).toEqual({ role: 'user', content: 'Detalhes' })
  })

  it('prepende contexto de resumo compactado quando historico > COMPACTION_KEEP_RECENT', () => {
    // Criar historico com > 10 mensagens para acionar compaction
    const historico: IaMensagem[] = []
    for (let i = 0; i < 15; i++) {
      historico.push({
        id: `msg-${i}`,
        papel: i % 2 === 0 ? 'usuario' : 'assistente',
        conteudo: `Mensagem ${i}`,
        criada_em: `2026-01-01T00:00:${String(i).padStart(2, '0')}Z`,
      })
    }

    const resumo = 'O usuario perguntou sobre produtos e jornais anteriores.'
    const messages = buildChatMessages(historico, 'Nova pergunta', resumo)

    // Deve ter: resumo user, resumo assistant ack, 10 msgs recentes, msg atual
    expect(messages[0]).toEqual({
      role: 'user',
      content: `[Resumo do contexto anterior]\n${resumo}`,
    })
    expect(messages[1]).toEqual({
      role: 'assistant',
      content: 'Entendido. Tenho o contexto anterior.',
    })

    // 10 mensagens recentes (indices 5-14 do historico)
    // + 2 do resumo + 1 mensagem atual = 13
    expect(messages).toHaveLength(13)
    expect(messages[messages.length - 1]).toEqual({ role: 'user', content: 'Nova pergunta' })
  })

  it('NAO prepende resumo quando historico <= COMPACTION_KEEP_RECENT', () => {
    const historico: IaMensagem[] = [
      { id: '1', papel: 'usuario', conteudo: 'Oi', criada_em: '2026-01-01T00:00:00Z' },
    ]

    const resumo = 'Resumo que nao deveria aparecer'
    const messages = buildChatMessages(historico, 'Pergunta', resumo)

    // Com historico de 1 msg (<=10), nao prepende resumo
    expect(messages).toHaveLength(2)
    expect(messages[0]).toEqual({ role: 'user', content: 'Oi' })
    expect(messages[1]).toEqual({ role: 'user', content: 'Pergunta' })
  })

  it('trata mensagem tool_result como assistant text legado', () => {
    const historico: IaMensagem[] = [
      { id: '1', papel: 'tool_result', conteudo: '{"found": true}', criada_em: '2026-01-01T00:00:00Z' },
    ]
    const messages = buildChatMessages(historico, 'Proximo')

    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('assistant')
    expect((messages[0] as any).content).toContain('[TOOL_RESULT_LEGADO]')
    expect((messages[0] as any).content).toContain('{"found": true}')
  })
})

// ===========================================================================
// extractToolCallsFromSteps
// ===========================================================================

describe('extractToolCallsFromSteps', () => {
  it('retorna array vazio quando steps e undefined', () => {
    expect(extractToolCallsFromSteps(undefined)).toEqual([])
  })

  it('retorna array vazio quando steps e array vazio', () => {
    expect(extractToolCallsFromSteps([])).toEqual([])
  })

  it('retorna array vazio quando step nao tem toolCalls', () => {
    const steps = [{ toolCalls: null, toolResults: [] }]
    expect(extractToolCallsFromSteps(steps)).toEqual([])
  })

  it('retorna array vazio quando step tem toolCalls vazio', () => {
    const steps = [{ toolCalls: [], toolResults: [] }]
    expect(extractToolCallsFromSteps(steps)).toEqual([])
  })

  it('extrai tool calls com results emparelhados por toolCallId', () => {
    const steps = [
      {
        toolCalls: [
          { toolCallId: 'tc-1', toolName: 'buscar_produtos', input: { termo: 'leite' } },
        ],
        toolResults: [
          { toolCallId: 'tc-1', output: { found: true, total: 3 } },
        ],
      },
    ]

    const result = extractToolCallsFromSteps(steps)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: 'tc-1',
      name: 'buscar_produtos',
      args: { termo: 'leite' },
      result: { found: true, total: 3 },
    })
  })

  it('extrai multiplos tool calls de multiplos steps', () => {
    const steps = [
      {
        toolCalls: [
          { toolCallId: 'tc-1', toolName: 'buscar_produtos', input: { termo: 'cafe' } },
        ],
        toolResults: [
          { toolCallId: 'tc-1', output: { found: true } },
        ],
      },
      {
        toolCalls: [
          { toolCallId: 'tc-2', toolName: 'ver_produto', input: { produto_id: 42 } },
        ],
        toolResults: [
          { toolCallId: 'tc-2', output: { nome: 'CAFE PILAO' } },
        ],
      },
    ]

    const result = extractToolCallsFromSteps(steps)
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('buscar_produtos')
    expect(result[1].name).toBe('ver_produto')
    expect(result[1].result).toEqual({ nome: 'CAFE PILAO' })
  })

  it('lida com tool call sem result (toolResults vazio)', () => {
    const steps = [
      {
        toolCalls: [
          { toolCallId: 'tc-1', toolName: 'buscar_produtos', input: { termo: 'test' } },
        ],
        toolResults: [],
      },
    ]

    const result = extractToolCallsFromSteps(steps)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: 'tc-1',
      name: 'buscar_produtos',
      args: { termo: 'test' },
    })
  })

  it('suporta campo args legado (AI SDK v5 compat)', () => {
    const steps = [
      {
        toolCalls: [
          { toolCallId: 'tc-1', toolName: 'buscar_produtos', args: { termo: 'legacy' } },
        ],
        toolResults: [
          { toolCallId: 'tc-1', result: { found: false } },
        ],
      },
    ]

    const result = extractToolCallsFromSteps(steps)
    expect(result).toHaveLength(1)
    expect(result[0].args).toEqual({ termo: 'legacy' })
    expect(result[0].result).toEqual({ found: false })
  })

  it('preserva result com valor false/null/0 (falsy mas definido)', () => {
    const steps = [
      {
        toolCalls: [
          { toolCallId: 'tc-1', toolName: 'check', input: {} },
        ],
        toolResults: [
          { toolCallId: 'tc-1', output: false },
        ],
      },
    ]

    const result = extractToolCallsFromSteps(steps)
    expect(result[0].result).toBe(false)
  })

  it('captura error do toolResult quando presente', () => {
    const steps = [
      {
        toolCalls: [
          { toolCallId: 'tc-1', toolName: 'falhar', input: {} },
        ],
        toolResults: [
          { toolCallId: 'tc-1', error: 'Algo deu errado' },
        ],
      },
    ]

    const result = extractToolCallsFromSteps(steps)
    expect(result).toHaveLength(1)
    expect(result[0].result).toBe('Algo deu errado')
  })

  it('normaliza input primitivo via normalizeToolArgs', () => {
    const steps = [
      {
        toolCalls: [
          { toolCallId: 'tc-1', toolName: 'simple', input: 'just a string' },
        ],
        toolResults: [
          { toolCallId: 'tc-1', output: 'ok' },
        ],
      },
    ]

    const result = extractToolCallsFromSteps(steps)
    expect(result[0].args).toEqual({ value: 'just a string' })
  })
})

// ===========================================================================
// buildFullSystemPrompt
// ===========================================================================

describe('buildFullSystemPrompt', () => {
  it('retorna SISTEMA_PROMPT (stub sem discovery)', async () => {
    const prompt = await buildFullSystemPrompt()
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(0)
    // Deve conter identificacao do JornalFlow
    expect(prompt).toContain('JornalFlow')
  })

  it('ignora contexto e mensagem (stub)', async () => {
    const contexto = { rota: '/editor/1', pagina: 'editor' as const, jornal_id: 1 }
    const prompt = await buildFullSystemPrompt(contexto, 'Como trocar produto?')
    // Stub retorna mesmo prompt independente do contexto
    expect(prompt).toContain('JornalFlow')
  })
})
