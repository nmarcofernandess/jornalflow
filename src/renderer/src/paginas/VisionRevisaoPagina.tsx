import { useState, useEffect, useCallback } from 'react'
import type { AnaliseVisionProduto } from '@shared/types'
import { analisarBatch, listarProdutosComImagem } from '../servicos/vision'
import type { ProdutoComImagem } from '../servicos/vision'
import { atualizarProduto } from '../servicos/produtos'
import { useDataDir, imageUrl } from '@renderer/lib/image-url'

// ── Confidence badge ──

function BadgeConfianca({ valor }: { valor: number }) {
  const cor =
    valor > 80
      ? 'bg-green-100 text-green-800'
      : valor > 50
        ? 'bg-yellow-100 text-yellow-800'
        : 'bg-red-100 text-red-800'

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cor}`}>
      {valor}% confiança
    </span>
  )
}

// ── Product Card ──

interface CardProdutoProps {
  produto: ProdutoComImagem
  resultado: AnaliseVisionProduto | undefined
  dataDir: string
  editando: { nome: string; nome_card: string } | undefined
  onAceitar: () => void
  onRejeitar: () => void
  onIniciarEdicao: () => void
  onSalvarEdicao: (nome: string, nome_card: string) => void
  onCancelarEdicao: () => void
  onMudarEdicao: (campo: 'nome' | 'nome_card', valor: string) => void
}

function CardProduto({
  produto,
  resultado,
  dataDir,
  editando,
  onAceitar,
  onRejeitar,
  onIniciarEdicao,
  onSalvarEdicao,
  onCancelarEdicao,
  onMudarEdicao
}: CardProdutoProps) {
  const src = imageUrl(dataDir, produto.arquivo_path)

  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-hidden flex flex-col">
      {/* Thumbnail */}
      <div className="aspect-square bg-muted relative overflow-hidden">
        {src ? (
          <img
            src={src}
            alt={produto.nome}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
            Sem imagem
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        {/* Nome atual */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
            Nome atual
          </p>
          <p className="text-sm font-medium truncate" title={produto.nome}>
            {produto.nome}
          </p>
          {produto.nome_card && (
            <p className="text-xs text-muted-foreground truncate">{produto.nome_card}</p>
          )}
        </div>

        {/* Sugestão IA */}
        {resultado && !editando && (
          <div className="border-t pt-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                Sugestão IA
              </p>
              <BadgeConfianca valor={resultado.confianca} />
            </div>
            <p className="text-sm font-semibold truncate text-foreground" title={resultado.nome_sugerido}>
              {resultado.nome_sugerido}
            </p>
            {resultado.nome_card && (
              <p className="text-xs text-muted-foreground truncate">{resultado.nome_card}</p>
            )}
            {resultado.marca && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {resultado.marca}{resultado.peso ? ` · ${resultado.peso}` : ''}
                {resultado.categoria ? ` · ${resultado.categoria}` : ''}
              </p>
            )}
          </div>
        )}

        {/* Edição inline */}
        {editando && (
          <div className="border-t pt-2 space-y-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium block mb-0.5">
                Nome completo
              </label>
              <input
                type="text"
                value={editando.nome}
                onChange={(e) => onMudarEdicao('nome', e.target.value)}
                className="w-full text-sm border rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium block mb-0.5">
                Nome card
              </label>
              <input
                type="text"
                value={editando.nome_card}
                onChange={(e) => onMudarEdicao('nome_card', e.target.value)}
                className="w-full text-sm border rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-1.5 mt-auto pt-2">
          {editando ? (
            <>
              <button
                onClick={() => onSalvarEdicao(editando.nome, editando.nome_card)}
                className="flex-1 text-xs px-2 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
              >
                Salvar
              </button>
              <button
                onClick={onCancelarEdicao}
                className="flex-1 text-xs px-2 py-1.5 rounded border hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
            </>
          ) : resultado ? (
            <>
              <button
                onClick={onAceitar}
                className="flex-1 text-xs px-2 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 transition-colors font-medium"
              >
                Aceitar
              </button>
              <button
                onClick={onIniciarEdicao}
                className="flex-1 text-xs px-2 py-1.5 rounded border hover:bg-muted transition-colors"
              >
                Editar
              </button>
              <button
                onClick={onRejeitar}
                className="flex-1 text-xs px-2 py-1.5 rounded border hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-colors"
              >
                Rejeitar
              </button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground italic">Aguardando análise...</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ──

export default function VisionRevisaoPagina() {
  const dataDir = useDataDir()

  const [produtos, setProdutos] = useState<ProdutoComImagem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [resultados, setResultados] = useState<Map<number, AnaliseVisionProduto>>(new Map())
  const [progresso, setProgresso] = useState<{ running: boolean; current: number; total: number }>({
    running: false,
    current: 0,
    total: 0
  })
  const [editando, setEditando] = useState<Map<number, { nome: string; nome_card: string }>>(
    new Map()
  )
  const [rejeitados, setRejeitados] = useState<Set<number>>(new Set())

  // ── Data loading ──

  const carregarProdutos = useCallback(async () => {
    setCarregando(true)
    try {
      const lista = await listarProdutosComImagem()
      setProdutos(lista)
    } catch (err) {
      console.error('Erro ao carregar produtos com imagem:', err)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregarProdutos()
  }, [carregarProdutos])

  // ── IPC progress listener ──

  useEffect(() => {
    const handler = (_event: unknown, data: { current: number; total: number; produto_id?: number; resultado?: AnaliseVisionProduto }) => {
      setProgresso((prev) => ({ ...prev, current: data.current, total: data.total }))
      if (data.resultado && data.produto_id != null) {
        setResultados((prev) => new Map(prev).set(data.produto_id!, data.resultado!))
      }
      if (data.current === data.total) {
        setProgresso((prev) => ({ ...prev, running: false }))
      }
    }
    window.electron.ipcRenderer.on('vision:progress', handler)
    return () => {
      window.electron.ipcRenderer.removeListener('vision:progress', handler)
    }
  }, [])

  // ── Actions ──

  async function handleAnalisarTodos() {
    setProgresso({ running: true, current: 0, total: produtos.length })
    try {
      await analisarBatch({ limite: 30 })
    } catch (err) {
      console.error('Erro ao iniciar análise batch:', err)
      setProgresso((prev) => ({ ...prev, running: false }))
    }
  }

  async function handleAceitarTodosAcima80() {
    const entradas = Array.from(resultados.entries()).filter(
      ([produto_id, res]) => res.confianca > 80 && !rejeitados.has(produto_id)
    )
    for (const [produto_id, res] of entradas) {
      try {
        await atualizarProduto(produto_id, {
          nome: res.nome_sugerido,
          nome_card: res.nome_card
        })
        // Optimistic update on local list
        setProdutos((prev) =>
          prev.map((p) =>
            p.produto_id === produto_id
              ? { ...p, nome: res.nome_sugerido, nome_card: res.nome_card }
              : p
          )
        )
      } catch (err) {
        console.error(`Erro ao aceitar produto ${produto_id}:`, err)
      }
    }
  }

  async function handleAceitar(produto_id: number) {
    const res = resultados.get(produto_id)
    if (!res) return
    try {
      await atualizarProduto(produto_id, {
        nome: res.nome_sugerido,
        nome_card: res.nome_card
      })
      setProdutos((prev) =>
        prev.map((p) =>
          p.produto_id === produto_id
            ? { ...p, nome: res.nome_sugerido, nome_card: res.nome_card }
            : p
        )
      )
    } catch (err) {
      console.error(`Erro ao aceitar produto ${produto_id}:`, err)
    }
  }

  async function handleSalvarEdicao(produto_id: number, nome: string, nome_card: string) {
    try {
      await atualizarProduto(produto_id, { nome, nome_card })
      setProdutos((prev) =>
        prev.map((p) => (p.produto_id === produto_id ? { ...p, nome, nome_card } : p))
      )
      setEditando((prev) => {
        const next = new Map(prev)
        next.delete(produto_id)
        return next
      })
    } catch (err) {
      console.error(`Erro ao salvar edição do produto ${produto_id}:`, err)
    }
  }

  function handleIniciarEdicao(produto_id: number) {
    const res = resultados.get(produto_id)
    const produto = produtos.find((p) => p.produto_id === produto_id)
    setEditando((prev) =>
      new Map(prev).set(produto_id, {
        nome: res?.nome_sugerido ?? produto?.nome ?? '',
        nome_card: res?.nome_card ?? produto?.nome_card ?? ''
      })
    )
  }

  function handleCancelarEdicao(produto_id: number) {
    setEditando((prev) => {
      const next = new Map(prev)
      next.delete(produto_id)
      return next
    })
  }

  function handleMudarEdicao(produto_id: number, campo: 'nome' | 'nome_card', valor: string) {
    setEditando((prev) => {
      const atual = prev.get(produto_id)
      if (!atual) return prev
      return new Map(prev).set(produto_id, { ...atual, [campo]: valor })
    })
  }

  function handleRejeitar(produto_id: number) {
    setRejeitados((prev) => new Set(prev).add(produto_id))
  }

  // ── Computed ──

  const produtosVisiveis = produtos.filter((p) => !rejeitados.has(p.produto_id))
  const totalAcima80 = Array.from(resultados.values()).filter(
    (r) => r.confianca > 80
  ).length
  const porcentagem =
    progresso.total > 0 ? Math.round((progresso.current / progresso.total) * 100) : 0

  // ── Render ──

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Vision AI — Nomeador de Produtos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {carregando
              ? 'Carregando produtos...'
              : `${produtosVisiveis.length} produto${produtosVisiveis.length !== 1 ? 's' : ''} com imagem`}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={handleAnalisarTodos}
            disabled={progresso.running || carregando || produtos.length === 0}
            className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {progresso.running ? 'Analisando...' : 'Analisar Todos'}
          </button>
          {totalAcima80 > 0 && (
            <button
              onClick={handleAceitarTodosAcima80}
              disabled={progresso.running}
              className="px-4 py-2 rounded bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Aceitar todos &gt; 80% ({totalAcima80})
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {progresso.running && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Analisando imagens...</span>
            <span>
              {progresso.current}/{progresso.total} ({porcentagem}%)
            </span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${porcentagem}%` }}
            />
          </div>
        </div>
      )}

      {/* Grid */}
      {carregando ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card shadow-sm overflow-hidden">
              <div className="aspect-square bg-muted animate-pulse" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-muted rounded animate-pulse w-1/3" />
                <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : produtosVisiveis.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-4xl mb-3">🔍</p>
          <p className="font-medium">Nenhum produto com imagem</p>
          <p className="text-sm mt-1">
            Atribua imagens aos produtos na Galeria antes de usar o Vision AI.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {produtosVisiveis.map((produto) => (
            <CardProduto
              key={produto.produto_id}
              produto={produto}
              resultado={resultados.get(produto.produto_id)}
              dataDir={dataDir}
              editando={editando.get(produto.produto_id)}
              onAceitar={() => handleAceitar(produto.produto_id)}
              onRejeitar={() => handleRejeitar(produto.produto_id)}
              onIniciarEdicao={() => handleIniciarEdicao(produto.produto_id)}
              onSalvarEdicao={(nome, nome_card) =>
                handleSalvarEdicao(produto.produto_id, nome, nome_card)
              }
              onCancelarEdicao={() => handleCancelarEdicao(produto.produto_id)}
              onMudarEdicao={(campo, valor) =>
                handleMudarEdicao(produto.produto_id, campo, valor)
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
