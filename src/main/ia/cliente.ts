import { generateText, streamText, stepCountIs } from 'ai'
import type { ModelMessage, UserContent } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { SISTEMA_PROMPT } from './sistema-prompt'
import { buildContextBriefing } from './discovery'
import { iaTools } from './tools'
import { queryOne } from '../db/query'
import { resolveModel, buildModelFactory } from './config'
import type { IaMensagem, IaAnexo, ToolCall, IaConfiguracao, IaContexto, IaStreamEvent } from '../../shared/types'

import { createRequire } from 'node:module'
const _require = createRequire(import.meta.url)
const { BrowserWindow: _BW } = _require('electron') as typeof import('electron')

// ---------------------------------------------------------------------------
// broadcastToRenderer — envia eventos a todas as BrowserWindows
// Usado por iaEnviarMensagemStream (subtask-1-6b)
// ---------------------------------------------------------------------------

export function broadcastToRenderer(channel: string, data: unknown): void {
  for (const win of _BW.getAllWindows()) {
    win.webContents.send(channel, data)
  }
}

// ---------------------------------------------------------------------------
// emitStream — envia IaStreamEvent tipado ao renderer via broadcast
// ---------------------------------------------------------------------------

function emitStream(event: IaStreamEvent): void {
  broadcastToRenderer('ia:stream', event)
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const TOOL_RESULT_MAX_CHARS = 1500

// ---------------------------------------------------------------------------
// Helpers de truncation — preserva summary/_meta em resultados de tools
// ---------------------------------------------------------------------------

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return `${text.slice(0, Math.max(0, maxChars - 1))}\u2026`
}

function safeCompactJson(value: unknown, maxChars: number): string {
  try {
    const raw = typeof value === 'string' ? value : JSON.stringify(value)
    return truncateText(raw, maxChars)
  } catch {
    return truncateText(String(value), maxChars)
  }
}

function toolResultToText(result: unknown): string {
  if (result === undefined) return 'resultado_nao_persistido'
  if (result === null) return 'null'

  // Preserva summary e _meta mesmo quando trunca o resto
  if (typeof result === 'object' && result !== null && !Array.isArray(result)) {
    const r = result as Record<string, any>
    if (r.summary || r._meta) {
      const full = safeCompactJson(result, TOOL_RESULT_MAX_CHARS)
      if (full.length <= TOOL_RESULT_MAX_CHARS) return full
      // Monta versao compacta com essentials + dados truncados
      const essentials: Record<string, any> = { status: r.status }
      if (r.summary) essentials.summary = r.summary
      if (r._meta) essentials._meta = r._meta
      const essentialsJson = JSON.stringify(essentials)
      const remaining = TOOL_RESULT_MAX_CHARS - essentialsJson.length - 20
      if (remaining > 100) {
        const dataStr = safeCompactJson(result, remaining)
        return `${essentialsJson}\n[DATA_TRUNCADA]: ${dataStr}`
      }
      return essentialsJson
    }
  }

  return safeCompactJson(result, TOOL_RESULT_MAX_CHARS)
}

// ---------------------------------------------------------------------------
// normalizeToolArgs — normaliza input de tool call para Record<string,unknown>
// ---------------------------------------------------------------------------

function normalizeToolArgs(rawArgs: unknown): Record<string, unknown> | undefined {
  if (rawArgs === undefined) return undefined
  if (typeof rawArgs === 'object' && rawArgs !== null && !Array.isArray(rawArgs)) {
    return rawArgs as Record<string, unknown>
  }
  return { value: rawArgs }
}

// ---------------------------------------------------------------------------
// hasOwn — check property existence preservando falsy values
// ---------------------------------------------------------------------------

function hasOwn(value: unknown, key: string): boolean {
  return typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, key)
}

// ---------------------------------------------------------------------------
// buildUserContent — constroi conteudo do usuario com suporte a anexos
// ---------------------------------------------------------------------------

function buildUserContent(text: string, anexos?: IaAnexo[]): UserContent {
  if (!anexos || anexos.length === 0) return text

  const { readFileSync: _readFileSync } = _require('node:fs') as typeof import('node:fs')

  const parts: Exclude<UserContent, string> = []
  if (text) parts.push({ type: 'text', text })

  for (const a of anexos) {
    let buf: Buffer
    if (a.file_path) {
      try { buf = _readFileSync(a.file_path) } catch { continue }
    } else if (a.data_base64) {
      buf = Buffer.from(a.data_base64, 'base64')
    } else {
      continue
    }

    if (a.tipo === 'image') {
      parts.push({ type: 'image', image: new Uint8Array(buf), mediaType: a.mime_type })
    } else {
      parts.push({ type: 'file', data: new Uint8Array(buf), mediaType: a.mime_type ?? 'application/octet-stream' })
    }
  }
  return parts
}

// ---------------------------------------------------------------------------
// buildChatMessages — converte IaMensagem[] do historico para ModelMessage[]
// ---------------------------------------------------------------------------

function buildChatMessages(
  historico: IaMensagem[],
  currentMsg: string,
  resumoCompactado?: string | null,
  currentAnexos?: IaAnexo[]
): ModelMessage[] {
  const messages: ModelMessage[] = []

  // Se temos resumo compactado, prepend contexto e so usa msgs recentes
  const COMPACTION_KEEP_RECENT = 10
  let msgsToConvert = historico
  if (resumoCompactado && historico.length > COMPACTION_KEEP_RECENT) {
    messages.push({ role: 'user', content: `[Resumo do contexto anterior]\n${resumoCompactado}` })
    messages.push({ role: 'assistant', content: 'Entendido. Tenho o contexto anterior.' })
    msgsToConvert = historico.slice(-COMPACTION_KEEP_RECENT)
  }

  for (const h of msgsToConvert) {
    if (h.papel === 'usuario') {
      if (h.anexos && h.anexos.length > 0) {
        messages.push({ role: 'user', content: buildUserContent(h.conteudo, h.anexos) })
      } else {
        messages.push({ role: 'user', content: h.conteudo })
      }
      continue
    }

    if (h.papel === 'assistente') {
      const toolCalls = h.tool_calls
      if (toolCalls && toolCalls.length > 0) {
        // Structured assistant message with tool-call parts
        const contentParts: Array<
          | { type: 'text'; text: string }
          | { type: 'tool-call'; toolCallId: string; toolName: string; input: unknown }
        > = []
        if (h.conteudo?.trim()) {
          contentParts.push({ type: 'text', text: h.conteudo })
        }
        for (const tc of toolCalls) {
          contentParts.push({
            type: 'tool-call',
            toolCallId: tc.id,
            toolName: tc.name,
            input: tc.args ?? {},
          })
        }
        messages.push({ role: 'assistant', content: contentParts })

        // Paired tool message with tool-result parts
        const resultParts: Array<{
          type: 'tool-result'
          toolCallId: string
          toolName: string
          output: { type: 'text'; value: string }
        }> = []
        for (const tc of toolCalls) {
          resultParts.push({
            type: 'tool-result',
            toolCallId: tc.id,
            toolName: tc.name,
            output: { type: 'text', value: toolResultToText(tc.result) },
          })
        }
        messages.push({ role: 'tool', content: resultParts })
      } else {
        // Plain text assistant message
        messages.push({ role: 'assistant', content: h.conteudo ?? '' })
      }
      continue
    }

    if (h.papel === 'tool_result') {
      // Legacy tool_result rows — keep as assistant text
      const compact = truncateText(h.conteudo ?? '', TOOL_RESULT_MAX_CHARS)
      messages.push({
        role: 'assistant',
        content: `[TOOL_RESULT_LEGADO]\n${compact}`,
      })
    }
  }

  messages.push({ role: 'user', content: buildUserContent(currentMsg, currentAnexos) })
  return messages
}

// ---------------------------------------------------------------------------
// buildFullSystemPrompt — SISTEMA_PROMPT + discovery context injection
// ---------------------------------------------------------------------------

async function buildFullSystemPrompt(
  contexto?: IaContexto,
  mensagemUsuario?: string
): Promise<string> {
  try {
    const briefing = await buildContextBriefing(contexto, mensagemUsuario)
    return briefing
      ? `${SISTEMA_PROMPT}\n\n---\n${briefing}`
      : SISTEMA_PROMPT
  } catch (err) {
    console.warn('[AI] buildContextBriefing falhou (continuando sem):', (err as Error).message)
    return SISTEMA_PROMPT
  }
}

// ---------------------------------------------------------------------------
// extractToolCallsFromSteps — extrai ToolCall[] dos steps do AI SDK
// ---------------------------------------------------------------------------

function extractToolCallsFromSteps(steps: any[] | undefined): ToolCall[] {
  const acoes: ToolCall[] = []
  if (!steps) return acoes

  for (const step of steps) {
    if (!step.toolCalls || step.toolCalls.length === 0) continue

    const stepToolResults = (step.toolResults ?? []) as any[]
    const toolResultsById = new Map<string, any>()

    for (const tr of stepToolResults) {
      if (tr?.toolCallId) {
        toolResultsById.set(tr.toolCallId, tr)
      }
    }

    for (let i = 0; i < step.toolCalls.length; i++) {
      const tc = step.toolCalls[i] as any
      // Pair by toolCallId first. Array index is only a compatibility fallback.
      const tr = toolResultsById.get(tc.toolCallId) ?? stepToolResults[i]
      // AI SDK v6 uses input/output. Keep args/result fallbacks for compatibility.
      const args = normalizeToolArgs(tc?.input ?? tc?.args)

      const hasResultProp =
        hasOwn(tr, 'output') ||
        hasOwn(tr, 'result') ||
        hasOwn(tr, 'error')

      const resultValue = hasOwn(tr, 'output')
        ? tr.output
        : hasOwn(tr, 'result')
          ? tr.result
          : hasOwn(tr, 'error')
            ? tr.error
            : undefined

      acoes.push({
        id: tc.toolCallId,
        name: tc.toolName,
        ...(args !== undefined ? { args } : {}),
        ...(hasResultProp ? { result: resultValue } : {}),
      })
    }
  }

  return acoes
}

// ---------------------------------------------------------------------------
// Test hooks — expoe helpers internos para testes unitarios
// ---------------------------------------------------------------------------

export const __iaClienteTestables = {
  normalizeToolArgs,
  buildChatMessages,
  extractToolCallsFromSteps,
  buildFullSystemPrompt,
}

// ---------------------------------------------------------------------------
// maybeCompact — delega para session-processor com graceful degradation
// ---------------------------------------------------------------------------

async function _maybeCompact(
  conversa_id: string,
  historico: IaMensagem[],
  createModel: (modelo: string) => any,
  modelo: string
): Promise<string | null> {
  try {
    const { maybeCompact } = await import('./session-processor')
    return await maybeCompact(conversa_id, historico, createModel, modelo)
  } catch (err) {
    console.warn('[AI] maybeCompact falhou (continuando sem):', (err as Error).message)
    return null
  }
}

// ---------------------------------------------------------------------------
// _callWithVercelAiSdkTools — core function: generateText + follow-up
// ---------------------------------------------------------------------------

async function _callWithVercelAiSdkTools(
  providerLabel: 'gemini' | 'openrouter',
  config: IaConfiguracao,
  currentMsg: string,
  historico: IaMensagem[],
  contexto: IaContexto | undefined,
  createModel: (modelo: string) => any,
  conversa_id?: string,
  anexos?: IaAnexo[]
): Promise<{ resposta: string; acoes: ToolCall[] }> {
  const modelo = resolveModel(config, providerLabel)

  // History compaction (se conversa_id disponivel)
  let resumoCompactado: string | null = null
  if (conversa_id) {
    try {
      resumoCompactado = await _maybeCompact(conversa_id, historico, createModel, modelo)
    } catch (err) {
      console.warn('[AI SDK] Compaction falhou (continuando sem):', (err as Error).message)
    }
  }

  const fullSystemPrompt = await buildFullSystemPrompt(contexto, currentMsg)
  const messages = buildChatMessages(historico, currentMsg, resumoCompactado, anexos)
  const tools = iaTools
  const model = createModel(modelo)

  let result
  try {
    result = await generateText({
      model,
      system: fullSystemPrompt,
      messages,
      tools,
      stopWhen: stepCountIs(10),
      onStepFinish({ text, toolCalls, finishReason, usage }) {
        console.log(`[AI SDK:${providerLabel}] Step:`, {
          finishReason,
          hasText: !!text,
          toolCalls: toolCalls?.length ?? 0,
          tokens: usage?.totalTokens,
        })
      },
    })
  } catch (err: any) {
    if (anexos?.length && (err.name === 'AI_InvalidPromptError' || err.message?.includes('schema'))) {
      console.warn(`[AI SDK:${providerLabel}] Prompt invalido com anexos — retry sem anexos:`, err.message)
      const fallbackMessages = buildChatMessages(historico, currentMsg, resumoCompactado)
      const aviso = `[Nota: nao consegui processar ${anexos.length} anexo(s) (${anexos.map(a => a.nome).join(', ')}). Formato nao suportado ou arquivo corrompido. Responda ao usuario normalmente.]`
      fallbackMessages.push({ role: 'user', content: aviso })
      result = await generateText({
        model,
        system: fullSystemPrompt,
        messages: fallbackMessages,
        tools,
        stopWhen: stepCountIs(10),
        onStepFinish({ text, toolCalls, finishReason, usage }) {
          console.log(`[AI SDK:${providerLabel}] Step (fallback):`, {
            finishReason,
            hasText: !!text,
            toolCalls: toolCalls?.length ?? 0,
            tokens: usage?.totalTokens,
          })
        },
      })
    } else {
      throw err
    }
  }

  const acoes = extractToolCallsFromSteps(result.steps as any[] | undefined)

  // If model ran tools but produced no final text, do a clean follow-up
  // using the structured response messages (preserves real tool results).
  let finalText = result.text

  if ((!finalText || finalText.trim().length === 0) && acoes.length > 0) {
    console.log(`[AI SDK:${providerLabel}] Executou tools sem texto final. Follow-up com response.messages...`)

    const followUpMessages: ModelMessage[] = [
      ...result.response.messages,
      { role: 'user', content: 'Com base nos resultados das ferramentas, responda ao usuario.' },
    ]

    const finalResult = await generateText({
      model,
      system: fullSystemPrompt,
      messages: followUpMessages,
      tools,
      stopWhen: stepCountIs(3),
    })

    finalText = finalResult.text || 'Feito!'
    const followUpAcoes = extractToolCallsFromSteps(finalResult.steps as any[] | undefined)
    acoes.push(...followUpAcoes)
    console.log(`[AI SDK:${providerLabel}] Follow-up:`, finalText.substring(0, 80))
  }

  const resposta = finalText || '(Resposta vazia)'
  return { resposta, acoes }
}

// =============================================================================
// iaEnviarMensagem — funcao publica principal (non-streaming)
// =============================================================================

export async function iaEnviarMensagem(
  mensagem: string,
  historico: IaMensagem[],
  contexto?: IaContexto,
  conversa_id?: string,
  anexos?: IaAnexo[]
): Promise<{ resposta: string; acoes: ToolCall[] }> {
  const config = await queryOne<IaConfiguracao>(
    'SELECT * FROM configuracao_ia LIMIT 1',
    []
  )

  if (!config) {
    throw new Error('Assistente IA nao configurado.')
  }

  const factory = buildModelFactory(config)
  if (!factory) {
    throw new Error(
      config.provider === 'gemini'
        ? 'API Key do Gemini nao configurada.'
        : config.provider === 'openrouter'
          ? 'Token do OpenRouter nao configurado.'
          : `Provider "${config.provider}" sem API key configurada.`
    )
  }

  const providerLabel = config.provider as 'gemini' | 'openrouter'
  return _callWithVercelAiSdkTools(
    providerLabel,
    config,
    mensagem,
    historico,
    contexto,
    factory.createModel,
    conversa_id,
    anexos
  )
}

// =============================================================================
// _callWithVercelAiSdkToolsStreaming — streaming via streamText + follow-up
// =============================================================================

async function _callWithVercelAiSdkToolsStreaming(
  providerLabel: 'gemini' | 'openrouter',
  config: IaConfiguracao,
  currentMsg: string,
  historico: IaMensagem[],
  streamId: string,
  contexto: IaContexto | undefined,
  createModel: (modelo: string) => any,
  conversa_id?: string,
  anexos?: IaAnexo[]
): Promise<{ resposta: string; acoes: ToolCall[] }> {
  const modelo = resolveModel(config, providerLabel)

  // History compaction (se conversa_id disponivel)
  let resumoCompactado: string | null = null
  if (conversa_id) {
    try {
      resumoCompactado = await _maybeCompact(conversa_id, historico, createModel, modelo)
    } catch (err) {
      console.warn('[AI SDK:stream] Compaction falhou (continuando sem):', (err as Error).message)
    }
  }

  const fullSystemPrompt = await buildFullSystemPrompt(contexto, currentMsg)
  const messages = buildChatMessages(historico, currentMsg, resumoCompactado, anexos)
  const tools = iaTools
  const model = createModel(modelo)

  let stepIndex = 0

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- streamText generic variance
    let result: any
    try {
      result = streamText({
        model,
        system: fullSystemPrompt,
        messages,
        tools,
        stopWhen: stepCountIs(10),
        onStepFinish({ text, toolCalls, finishReason, usage }) {
          console.log(`[AI SDK:${providerLabel}:stream] Step ${stepIndex}:`, {
            finishReason,
            hasText: !!text,
            toolCalls: toolCalls?.length ?? 0,
            tokens: usage?.totalTokens,
          })
          emitStream({ type: 'step-finish', stream_id: streamId, step_index: stepIndex })
          stepIndex++
        },
      })
      // Force the stream to start so prompt validation runs eagerly
      const reader = result.fullStream[Symbol.asyncIterator]()
      const first = await reader.next()
      // Re-emit the first part
      if (!first.done) {
        const part = first.value
        if (part.type === 'start-step') {
          emitStream({ type: 'start-step', stream_id: streamId, step_index: stepIndex })
        } else if (part.type === 'text-delta') {
          emitStream({ type: 'text-delta', stream_id: streamId, delta: part.text })
        } else if (part.type === 'tool-call') {
          emitStream({
            type: 'tool-call-start',
            stream_id: streamId,
            tool_call_id: part.toolCallId,
            tool_name: part.toolName,
            args: normalizeToolArgs(part.input) ?? {},
          })
        } else if (part.type === 'tool-result') {
          emitStream({
            type: 'tool-result',
            stream_id: streamId,
            tool_call_id: part.toolCallId,
            tool_name: part.toolName,
            result: part.output,
          })
        } else if (part.type === 'error') {
          throw part.error instanceof Error ? part.error : new Error(String(part.error))
        }
      }
    } catch (promptErr: any) {
      if (anexos?.length && (promptErr.name === 'AI_InvalidPromptError' || promptErr.message?.includes('schema'))) {
        console.warn(`[AI SDK:${providerLabel}:stream] Prompt invalido com anexos — retry sem anexos:`, promptErr.message)
        const fallbackMessages = buildChatMessages(historico, currentMsg, resumoCompactado)
        const aviso = `[Nota: nao consegui processar ${anexos.length} anexo(s) (${anexos.map(a => a.nome).join(', ')}). Formato nao suportado ou arquivo corrompido. Responda ao usuario normalmente.]`
        fallbackMessages.push({ role: 'user', content: aviso })
        result = streamText({
          model,
          system: fullSystemPrompt,
          messages: fallbackMessages,
          tools,
          stopWhen: stepCountIs(10),
          onStepFinish({ text, toolCalls, finishReason, usage }) {
            console.log(`[AI SDK:${providerLabel}:stream] Step ${stepIndex} (fallback):`, {
              finishReason,
              hasText: !!text,
              toolCalls: toolCalls?.length ?? 0,
              tokens: usage?.totalTokens,
            })
            emitStream({ type: 'step-finish', stream_id: streamId, step_index: stepIndex })
            stepIndex++
          },
        })
      } else {
        throw promptErr
      }
    }

    for await (const part of result.fullStream) {
      if (part.type === 'start-step') {
        emitStream({ type: 'start-step', stream_id: streamId, step_index: stepIndex })
      } else if (part.type === 'text-delta') {
        emitStream({ type: 'text-delta', stream_id: streamId, delta: part.text })
      } else if (part.type === 'tool-call') {
        emitStream({
          type: 'tool-call-start',
          stream_id: streamId,
          tool_call_id: part.toolCallId,
          tool_name: part.toolName,
          args: normalizeToolArgs(part.input) ?? {},
        })
      } else if (part.type === 'tool-result') {
        emitStream({
          type: 'tool-result',
          stream_id: streamId,
          tool_call_id: part.toolCallId,
          tool_name: part.toolName,
          result: part.output,
        })
      } else if (part.type === 'error') {
        // Surface the real stream error instead of letting it become a generic AI_NoOutputGeneratedError
        const err = part.error instanceof Error ? part.error : new Error(String(part.error))
        console.error(`[AI SDK:${providerLabel}:stream] Erro no stream (event):`, err.message)
        throw err
      }
    }

    // Fetch steps BEFORE text: if text throws AI_NoOutputGeneratedError,
    // we already have tool calls to decide if we should follow-up.
    const steps = await result.steps
    const acoes = extractToolCallsFromSteps(steps as any[] | undefined)

    let finalText: string
    try {
      finalText = await result.text
    } catch (textErr: any) {
      if (textErr?.name === 'AI_NoOutputGeneratedError' && acoes.length > 0) {
        // Model ran tools but did not generate final text — follow-up will cover
        console.log(`[AI SDK:${providerLabel}:stream] AI_NoOutputGeneratedError apos tools — ativando follow-up`)
        finalText = ''
      } else {
        throw textErr
      }
    }

    // Follow-up: if tools ran but no final text, do a streaming follow-up
    if ((!finalText || finalText.trim().length === 0) && acoes.length > 0) {
      console.log(`[AI SDK:${providerLabel}:stream] Tools sem texto final. Follow-up streaming...`)
      emitStream({ type: 'follow-up-start', stream_id: streamId })

      const responseMessages = await result.response
      const followUpMessages: ModelMessage[] = [
        ...responseMessages.messages,
        { role: 'user', content: 'Com base nos resultados das ferramentas, responda ao usuario.' },
      ]

      const followUp = streamText({
        model,
        system: fullSystemPrompt,
        messages: followUpMessages,
        tools,
        stopWhen: stepCountIs(3),
      })

      for await (const part of followUp.fullStream) {
        if (part.type === 'start-step') {
          emitStream({ type: 'start-step', stream_id: streamId, step_index: stepIndex })
        } else if (part.type === 'text-delta') {
          emitStream({ type: 'text-delta', stream_id: streamId, delta: part.text })
        } else if (part.type === 'tool-call') {
          emitStream({
            type: 'tool-call-start',
            stream_id: streamId,
            tool_call_id: part.toolCallId,
            tool_name: part.toolName,
            args: normalizeToolArgs(part.input) ?? {},
          })
        } else if (part.type === 'tool-result') {
          emitStream({
            type: 'tool-result',
            stream_id: streamId,
            tool_call_id: part.toolCallId,
            tool_name: part.toolName,
            result: part.output,
          })
        }
      }

      const followUpSteps = await followUp.steps
      const followUpAcoes = extractToolCallsFromSteps(followUpSteps as any[] | undefined)
      acoes.push(...followUpAcoes)
      const followUpText = await followUp.text
      const resposta = followUpText || 'Feito!'

      emitStream({ type: 'finish', stream_id: streamId, resposta, acoes })
      return { resposta, acoes }
    }

    const resposta = finalText || '(Resposta vazia)'
    emitStream({ type: 'finish', stream_id: streamId, resposta, acoes })
    return { resposta, acoes }
  } catch (err: any) {
    console.error(`[AI SDK:${providerLabel}:stream] Erro:`, err.message)
    emitStream({ type: 'error', stream_id: streamId, message: err.message })
    throw err
  }
}

// =============================================================================
// iaEnviarMensagemStream — funcao publica principal (streaming)
// =============================================================================

export async function iaEnviarMensagemStream(
  mensagem: string,
  historico: IaMensagem[],
  streamId: string,
  contexto?: IaContexto,
  conversa_id?: string,
  anexos?: IaAnexo[]
): Promise<{ resposta: string; acoes: ToolCall[] }> {
  const config = await queryOne<IaConfiguracao>(
    'SELECT * FROM configuracao_ia LIMIT 1',
    []
  )

  if (!config) {
    throw new Error('Assistente IA nao configurado.')
  }

  const factory = buildModelFactory(config)
  if (!factory) {
    throw new Error(
      config.provider === 'gemini'
        ? 'API Key do Gemini nao configurada.'
        : config.provider === 'openrouter'
          ? 'Token do OpenRouter nao configurado.'
          : `Provider "${config.provider}" sem API key configurada.`
    )
  }

  const providerLabel = config.provider as 'gemini' | 'openrouter'
  return _callWithVercelAiSdkToolsStreaming(
    providerLabel,
    config,
    mensagem,
    historico,
    streamId,
    contexto,
    factory.createModel,
    conversa_id,
    anexos
  )
}

// =============================================================================
// iaTestarConexao — teste de conectividade com provider
// =============================================================================

export async function iaTestarConexao(
  provider: string,
  apiKey: string,
  modelo: string
): Promise<{ sucesso: boolean; mensagem: string }> {
  if (!apiKey) throw new Error('API Key nao fornecida.')

  try {
    if (provider === 'gemini') {
      const google = createGoogleGenerativeAI({ apiKey })
      const result = await generateText({
        model: google(modelo),
        prompt: 'Responda apenas: OK',
      })
      return {
        sucesso: true,
        mensagem: `Conectado! Modelo "${modelo}" respondeu: "${result.text.substring(0, 50)}"`,
      }
    }

    if (provider === 'openrouter') {
      const openrouter = createOpenRouter({ apiKey })
      const result = await generateText({
        model: openrouter(modelo),
        prompt: 'Responda apenas: OK',
      })
      return {
        sucesso: true,
        mensagem: `OpenRouter conectado! Modelo "${modelo}" respondeu: "${result.text.substring(0, 50)}"`,
      }
    }

    throw new Error(`Provider "${provider}" nao suportado.`)
  } catch (err: any) {
    throw new Error(`Modelo "${modelo}" retornou erro: ${err.message}`)
  }
}

// =============================================================================
// Backward compat — chat() legacy export
// Mantido ate tipc.ts ser atualizado em subtask-1-7a
// =============================================================================

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** @deprecated Use iaEnviarMensagem() */
export async function chat(messages: ChatMessage[]): Promise<string> {
  const historico: IaMensagem[] = messages.slice(0, -1).map((m, i) => ({
    id: `legacy-${i}`,
    papel: m.role === 'user' ? 'usuario' as const : 'assistente' as const,
    conteudo: m.content,
    criada_em: new Date().toISOString(),
  }))

  const lastMsg = messages[messages.length - 1]
  if (!lastMsg || lastMsg.role !== 'user') {
    throw new Error('Ultima mensagem deve ser do usuario')
  }

  const { resposta } = await iaEnviarMensagem(lastMsg.content, historico)
  return resposta
}
