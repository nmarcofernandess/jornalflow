import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Search,
  FolderOpen,
  ImageIcon,
  Package,
  X,
  Check,
  Trash2,
  CheckSquare,
  Square,
  FolderSearch,
  Eye,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Badge } from '@renderer/components/ui/badge'
import { useDataDir, imageUrl } from '@renderer/lib/image-url'
import {
  listarOrfas,
  listarTodasImagens,
  listarProdutos,
  buscarProdutos,
  atribuirAProduto,
  removerImagem,
  mostrarNoFinder
} from '@renderer/servicos/produtos'
import { client } from '@renderer/servicos/client'
import type { Produto, ProdutoImagem } from '@shared/types'

type Tab = 'playground' | 'organizadas'
type ImagemComProduto = ProdutoImagem & { produto_nome?: string; produto_codigo?: string }

// ── Context Menu ──

interface ContextMenuState {
  x: number
  y: number
  imagem: ProdutoImagem | ImagemComProduto
}

function ContextMenu({
  state,
  onClose,
  onMostrarFinder,
  onAbrir,
  onAtribuir,
  onRemover,
  showAtribuir
}: {
  state: ContextMenuState
  onClose: () => void
  onMostrarFinder: () => void
  onAbrir: () => void
  onAtribuir?: () => void
  onRemover: () => void
  showAtribuir: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  // Clamp position so menu doesn't go off-screen
  const style: React.CSSProperties = {
    position: 'fixed',
    top: Math.min(state.y, window.innerHeight - 200),
    left: Math.min(state.x, window.innerWidth - 200),
    zIndex: 100
  }

  const itemClass =
    'flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted rounded-sm text-left transition-colors'

  return (
    <div ref={ref} style={style} className="bg-popover border rounded-md shadow-lg py-1 min-w-[180px]">
      <button className={itemClass} onClick={() => { onAbrir(); onClose() }}>
        <Eye className="h-4 w-4" /> Abrir imagem
      </button>
      {showAtribuir && onAtribuir && (
        <button className={itemClass} onClick={() => { onAtribuir(); onClose() }}>
          <Package className="h-4 w-4" /> Atribuir a produto
        </button>
      )}
      <button className={itemClass} onClick={() => { onMostrarFinder(); onClose() }}>
        <FolderSearch className="h-4 w-4" /> Mostrar no Finder
      </button>
      <div className="border-t my-1" />
      <button
        className={`${itemClass} text-destructive hover:text-destructive`}
        onClick={() => { onRemover(); onClose() }}
      >
        <Trash2 className="h-4 w-4" /> Deletar
      </button>
    </div>
  )
}

// ── Lightbox ──

function Lightbox({
  src,
  nome,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext
}: {
  src: string
  nome: string
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
  hasPrev: boolean
  hasNext: boolean
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === ' ') {
        e.preventDefault()
        onClose()
      }
      if (e.key === 'ArrowLeft' && hasPrev && onPrev) onPrev()
      if (e.key === 'ArrowRight' && hasNext && onNext) onNext()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose, onPrev, onNext, hasPrev, hasNext])

  return (
    <div
      className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Nav left */}
      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev?.() }}
          className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 rounded-full p-2 text-white transition-colors"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Image */}
      <div className="max-w-[90vw] max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={nome} className="max-w-full max-h-[85vh] object-contain rounded-lg" />
        <p className="text-white/70 text-sm mt-3 truncate max-w-md">{nome}</p>
      </div>

      {/* Nav right */}
      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext?.() }}
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 rounded-full p-2 text-white transition-colors"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 rounded-full p-2 text-white transition-colors"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  )
}

// ── Selection Toolbar ──

function SelectionToolbar({
  count,
  onAtribuir,
  onDeletar,
  onLimpar,
  showAtribuir
}: {
  count: number
  onAtribuir?: () => void
  onDeletar: () => void
  onLimpar: () => void
  showAtribuir: boolean
}) {
  return (
    <div className="sticky top-0 z-30 bg-primary text-primary-foreground rounded-lg px-4 py-2.5 flex items-center gap-3 shadow-lg animate-in slide-in-from-top-2 duration-200">
      <CheckSquare className="h-4 w-4" />
      <span className="text-sm font-medium">
        {count} selecionada{count !== 1 ? 's' : ''}
      </span>

      <div className="flex-1" />

      {showAtribuir && onAtribuir && (
        <Button size="sm" variant="secondary" onClick={onAtribuir} className="h-7 text-xs">
          <Package className="h-3 w-3 mr-1" />
          Atribuir {count > 1 ? `(${count})` : ''}
        </Button>
      )}
      <Button size="sm" variant="secondary" onClick={onDeletar} className="h-7 text-xs text-destructive hover:text-destructive">
        <Trash2 className="h-3 w-3 mr-1" />
        Deletar {count > 1 ? `(${count})` : ''}
      </Button>
      <button onClick={onLimpar} className="ml-1 hover:bg-primary-foreground/20 rounded p-1 transition-colors">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

// ── Image Thumbnail ──

function ImageThumb({
  img,
  dataDir,
  selected,
  focused,
  onSelect,
  onContextMenu,
  onDoubleClick
}: {
  img: ProdutoImagem | ImagemComProduto
  dataDir: string
  selected: boolean
  focused: boolean
  onSelect: (e: React.MouseEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
  onDoubleClick: () => void
}) {
  const nome = img.nome_original || img.arquivo_path.split('/').pop() || ''
  const hasProduto = 'produto_nome' in img && img.produto_nome

  return (
    <div
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClick}
      className={`group relative rounded-lg border overflow-hidden cursor-pointer transition-all outline-none ${
        selected
          ? 'ring-2 ring-primary border-primary'
          : focused
            ? 'ring-1 ring-primary/50 border-primary/50'
            : 'hover:border-foreground/30'
      }`}
      tabIndex={0}
    >
      {/* Checkbox */}
      <div className={`absolute top-2 left-2 z-10 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        {selected ? (
          <CheckSquare className="h-5 w-5 text-primary drop-shadow-md" />
        ) : (
          <Square className="h-5 w-5 text-white drop-shadow-md" />
        )}
      </div>

      {/* Image */}
      <div className="aspect-square bg-muted">
        <img
          src={imageUrl(dataDir, img.arquivo_path)}
          alt={nome}
          className="w-full h-full object-cover"
          draggable={false}
        />
      </div>

      {/* Footer */}
      <div className="p-2">
        <p className="text-xs truncate text-muted-foreground" title={nome}>
          {nome}
        </p>
        {hasProduto && (
          <p className="text-[10px] text-muted-foreground/70 truncate">
            {(img as ImagemComProduto).produto_nome}
          </p>
        )}
      </div>

      {/* Default badge */}
      {img.is_default && (
        <Badge className="absolute top-2 right-2 text-[10px] px-1 py-0">
          Default
        </Badge>
      )}
    </div>
  )
}

// ── Main Component ──

export default function GaleriaImagens() {
  const [tab, setTab] = useState<Tab>('playground')
  const [orfas, setOrfas] = useState<ProdutoImagem[]>([])
  const [organizadas, setOrganizadas] = useState<ImagemComProduto[]>([])
  const [carregando, setCarregando] = useState(true)
  const [importando, setImportando] = useState(false)
  const [filtroOrg, setFiltroOrg] = useState('')
  const dataDir = useDataDir()

  // Selection
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [lastClicked, setLastClicked] = useState<number | null>(null)

  // Context menu
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null)

  // Lightbox
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

  // Assign dialog
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [produtoBusca, setProdutoBusca] = useState('')
  const [produtosResultado, setProdutosResultado] = useState<Produto[]>([])
  const [buscandoProdutos, setBuscandoProdutos] = useState(false)

  // Current images list for the active tab
  const currentImages: (ProdutoImagem | ImagemComProduto)[] =
    tab === 'playground' ? orfas : orgFiltradasComputed()

  function orgFiltradasComputed() {
    if (!filtroOrg.trim()) return organizadas
    return organizadas.filter(
      (img) =>
        img.produto_nome?.toLowerCase().includes(filtroOrg.toLowerCase()) ||
        img.produto_codigo?.toLowerCase().includes(filtroOrg.toLowerCase())
    )
  }

  // Clear selection on tab change
  useEffect(() => {
    setSelected(new Set())
    setLastClicked(null)
  }, [tab])

  // ── Data Loading ──

  const carregarOrfas = useCallback(async () => {
    setCarregando(true)
    try {
      setOrfas(await listarOrfas())
    } finally {
      setCarregando(false)
    }
  }, [])

  const carregarOrganizadas = useCallback(async () => {
    setCarregando(true)
    try {
      setOrganizadas(await listarTodasImagens())
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'playground') carregarOrfas()
    else carregarOrganizadas()
  }, [tab, carregarOrfas, carregarOrganizadas])

  // Product search for assign dialog
  useEffect(() => {
    if (!showAssignDialog) return
    const timer = setTimeout(async () => {
      setBuscandoProdutos(true)
      try {
        const res = produtoBusca.trim()
          ? await buscarProdutos(produtoBusca.trim())
          : await listarProdutos()
        setProdutosResultado(res.slice(0, 20))
      } finally {
        setBuscandoProdutos(false)
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [produtoBusca, showAssignDialog])

  // ── Keyboard ──

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (lightboxIdx !== null || showAssignDialog) return
      if (e.key === ' ' && document.activeElement?.getAttribute('tabindex') === '0') {
        e.preventDefault()
        // Find which image is focused
        const focused = document.activeElement as HTMLElement
        const grid = focused.parentElement
        if (!grid) return
        const items = Array.from(grid.children)
        const idx = items.indexOf(focused)
        if (idx >= 0 && idx < currentImages.length) {
          setLightboxIdx(idx)
        }
      }
      // Ctrl/Cmd+A to select all
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault()
        setSelected(new Set(currentImages.map((i) => i.imagem_id)))
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [currentImages, lightboxIdx, showAssignDialog])

  // ── Selection ──

  function handleSelect(e: React.MouseEvent, img: ProdutoImagem | ImagemComProduto, index: number) {
    const id = img.imagem_id

    if (e.shiftKey && lastClicked !== null) {
      // Range select
      const lastIdx = currentImages.findIndex((i) => i.imagem_id === lastClicked)
      if (lastIdx >= 0) {
        const from = Math.min(lastIdx, index)
        const to = Math.max(lastIdx, index)
        const newSet = new Set(selected)
        for (let i = from; i <= to; i++) newSet.add(currentImages[i].imagem_id)
        setSelected(newSet)
        return
      }
    }

    if (e.metaKey || e.ctrlKey) {
      // Toggle single
      const newSet = new Set(selected)
      if (newSet.has(id)) newSet.delete(id)
      else newSet.add(id)
      setSelected(newSet)
    } else {
      // Single select (if clicking already-selected, deselect)
      if (selected.has(id) && selected.size === 1) {
        setSelected(new Set())
      } else {
        setSelected(new Set([id]))
      }
    }
    setLastClicked(id)
  }

  // ── Context Menu ──

  function handleContextMenu(e: React.MouseEvent, img: ProdutoImagem | ImagemComProduto) {
    e.preventDefault()
    // If right-clicking a non-selected image, select it
    if (!selected.has(img.imagem_id)) {
      setSelected(new Set([img.imagem_id]))
    }
    setCtxMenu({ x: e.clientX, y: e.clientY, imagem: img })
  }

  function getFilePath(img: ProdutoImagem | ImagemComProduto): string {
    if (img.arquivo_path.startsWith('/')) return img.arquivo_path
    return dataDir ? `${dataDir}/${img.arquivo_path}` : img.arquivo_path
  }

  // ── Actions ──

  async function handleImportPasta() {
    const dialog = await client['dialog.abrir_pasta']()
    if (dialog.canceled || !dialog.path) return
    setImportando(true)
    try {
      await client['import.batch_imagens']({ dir_path: dialog.path })
      if (tab === 'playground') await carregarOrfas()
      else await carregarOrganizadas()
    } finally {
      setImportando(false)
    }
  }

  async function handleAtribuir(produto: Produto) {
    const ids = Array.from(selected)
    for (const id of ids) {
      await atribuirAProduto(id, produto.produto_id)
    }
    setShowAssignDialog(false)
    setProdutoBusca('')
    setSelected(new Set())
    if (tab === 'playground') await carregarOrfas()
    else await carregarOrganizadas()
  }

  async function handleDeletarSelecionadas() {
    const ids = Array.from(selected)
    for (const id of ids) {
      await removerImagem(id)
    }
    setSelected(new Set())
    if (tab === 'playground') await carregarOrfas()
    else await carregarOrganizadas()
  }

  async function handleDeletarUma(id: number) {
    await removerImagem(id)
    selected.delete(id)
    setSelected(new Set(selected))
    if (tab === 'playground') await carregarOrfas()
    else await carregarOrganizadas()
  }

  // ── Lightbox nav ──

  const lightboxImages = currentImages
  const lightboxHasPrev = lightboxIdx !== null && lightboxIdx > 0
  const lightboxHasNext = lightboxIdx !== null && lightboxIdx < lightboxImages.length - 1

  // ── Render ──

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Galeria de Imagens</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {tab === 'playground'
              ? `${orfas.length} imagem${orfas.length !== 1 ? 's' : ''} aguardando organização`
              : `${organizadas.length} imagem${organizadas.length !== 1 ? 's' : ''} organizadas`}
          </p>
        </div>
        <Button onClick={handleImportPasta} disabled={importando}>
          <FolderOpen className="h-4 w-4 mr-2" />
          {importando ? 'Importando...' : 'Importar Pasta'}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setTab('playground')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'playground'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <ImageIcon className="h-4 w-4 inline mr-2" />
          Playground
          {orfas.length > 0 && (
            <Badge variant="secondary" className="ml-2 text-xs">
              {orfas.length}
            </Badge>
          )}
        </button>
        <button
          onClick={() => setTab('organizadas')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'organizadas'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Package className="h-4 w-4 inline mr-2" />
          Organizadas
        </button>
      </div>

      {/* Selection Toolbar */}
      {selected.size > 0 && (
        <SelectionToolbar
          count={selected.size}
          showAtribuir={tab === 'playground'}
          onAtribuir={() => setShowAssignDialog(true)}
          onDeletar={handleDeletarSelecionadas}
          onLimpar={() => setSelected(new Set())}
        />
      )}

      {/* Filter (organizadas only) */}
      {tab === 'organizadas' && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filtrar por produto..."
            value={filtroOrg}
            onChange={(e) => setFiltroOrg(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* Grid */}
      {carregando ? (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-square bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : currentImages.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          {tab === 'playground' ? (
            <>
              <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Playground vazio</p>
              <p className="text-sm mt-1">
                Importe uma pasta — fotos sem match vão aparecer aqui pra você organizar.
              </p>
            </>
          ) : (
            <>
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Nenhuma imagem organizada</p>
              <p className="text-sm mt-1">
                {filtroOrg ? 'Nenhum resultado pra esse filtro.' : 'Atribua imagens do Playground aos produtos.'}
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {currentImages.map((img, idx) => (
            <ImageThumb
              key={img.imagem_id}
              img={img}
              dataDir={dataDir}
              selected={selected.has(img.imagem_id)}
              focused={false}
              onSelect={(e) => handleSelect(e, img, idx)}
              onContextMenu={(e) => handleContextMenu(e, img)}
              onDoubleClick={() => setLightboxIdx(idx)}
            />
          ))}
        </div>
      )}

      {/* Hint */}
      {!carregando && currentImages.length > 0 && selected.size === 0 && (
        <p className="text-xs text-muted-foreground/60 text-center pt-2">
          Clique pra selecionar · Shift+clique pra selecionar intervalo · Cmd+A pra selecionar tudo · Espaço pra abrir · Botão direito pra mais opções
        </p>
      )}

      {/* Context Menu */}
      {ctxMenu && (
        <ContextMenu
          state={ctxMenu}
          onClose={() => setCtxMenu(null)}
          showAtribuir={tab === 'playground'}
          onAbrir={() => {
            const idx = currentImages.findIndex((i) => i.imagem_id === ctxMenu.imagem.imagem_id)
            if (idx >= 0) setLightboxIdx(idx)
          }}
          onAtribuir={() => setShowAssignDialog(true)}
          onMostrarFinder={() => mostrarNoFinder(getFilePath(ctxMenu.imagem))}
          onRemover={() => handleDeletarUma(ctxMenu.imagem.imagem_id)}
        />
      )}

      {/* Lightbox */}
      {lightboxIdx !== null && lightboxImages[lightboxIdx] && (
        <Lightbox
          src={imageUrl(dataDir, lightboxImages[lightboxIdx].arquivo_path) || ''}
          nome={
            lightboxImages[lightboxIdx].nome_original ||
            lightboxImages[lightboxIdx].arquivo_path.split('/').pop() ||
            ''
          }
          onClose={() => setLightboxIdx(null)}
          hasPrev={lightboxHasPrev}
          hasNext={lightboxHasNext}
          onPrev={() => setLightboxIdx((i) => (i !== null && i > 0 ? i - 1 : i))}
          onNext={() =>
            setLightboxIdx((i) =>
              i !== null && i < lightboxImages.length - 1 ? i + 1 : i
            )
          }
        />
      )}

      {/* Assign Dialog */}
      {showAssignDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg border shadow-lg w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">
                Atribuir {selected.size > 1 ? `${selected.size} imagens` : 'imagem'} a produto
              </h3>
              <button
                onClick={() => {
                  setShowAssignDialog(false)
                  setProdutoBusca('')
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Preview selected images */}
            <div className="px-4 pt-3 flex items-center gap-2 overflow-x-auto">
              {Array.from(selected).slice(0, 6).map((id) => {
                const img = currentImages.find((i) => i.imagem_id === id)
                if (!img) return null
                return (
                  <div key={id} className="w-12 h-12 rounded bg-muted overflow-hidden flex-shrink-0">
                    <img src={imageUrl(dataDir, img.arquivo_path)} className="w-full h-full object-cover" />
                  </div>
                )
              })}
              {selected.size > 6 && (
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  +{selected.size - 6}
                </span>
              )}
            </div>

            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto por nome ou codigo..."
                  value={produtoBusca}
                  onChange={(e) => setProdutoBusca(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-auto px-4 pb-4 space-y-1">
              {buscandoProdutos ? (
                <p className="text-sm text-muted-foreground text-center py-4">Buscando...</p>
              ) : produtosResultado.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum produto encontrado
                </p>
              ) : (
                produtosResultado.map((p) => (
                  <button
                    key={p.produto_id}
                    onClick={() => handleAtribuir(p)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted text-left transition-colors"
                  >
                    <Check className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.codigo} · {p.unidade}
                        {p.categoria ? ` · ${p.categoria}` : ''}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
