import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, FolderOpen } from 'lucide-react'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { ProdutoCard } from '@renderer/componentes/produtos/ProdutoCard'
import { NovoProdutoDialog } from '@renderer/componentes/produtos/NovoProdutoDialog'
import { BatchImport } from '@renderer/componentes/produtos/BatchImport'
import { listarProdutos, buscarProdutos, listarImagens } from '@renderer/servicos/produtos'
import type { Produto, ProdutoImagem } from '@shared/types'

export default function ProdutosLista() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [defaultImages, setDefaultImages] = useState<Record<number, string | null>>({})
  const [termo, setTermo] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [batchOpen, setBatchOpen] = useState(false)

  const carregarProdutos = useCallback(async () => {
    setCarregando(true)
    try {
      const lista = termo.trim()
        ? await buscarProdutos(termo.trim())
        : await listarProdutos()
      setProdutos(lista)

      // Load default images for each product
      const imgMap: Record<number, string | null> = {}
      await Promise.all(
        lista.map(async (p) => {
          try {
            const imgs: ProdutoImagem[] = await listarImagens(p.produto_id)
            const def = imgs.find((i) => i.is_default)
            imgMap[p.produto_id] = def?.arquivo_path ?? imgs[0]?.arquivo_path ?? null
          } catch {
            imgMap[p.produto_id] = null
          }
        })
      )
      setDefaultImages(imgMap)
    } catch (err) {
      console.error('Erro ao carregar produtos:', err)
    } finally {
      setCarregando(false)
    }
  }, [termo])

  useEffect(() => {
    const timer = setTimeout(() => {
      carregarProdutos()
    }, termo ? 300 : 0)

    return () => clearTimeout(timer)
  }, [termo, carregarProdutos])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {carregando ? '...' : `${produtos.length} produto${produtos.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setBatchOpen(!batchOpen)}>
            <FolderOpen className="h-4 w-4 mr-2" />
            Importar Imagens
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Produto
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou codigo..."
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Batch Import */}
      {batchOpen && (
        <div className="border rounded-lg p-4">
          <h3 className="font-medium mb-3">Importar Imagens em Lote</h3>
          <BatchImport onComplete={carregarProdutos} />
        </div>
      )}

      {/* Grid */}
      {carregando ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="border rounded-lg p-3 space-y-2">
              <Skeleton className="aspect-square rounded-md" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : produtos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {termo
            ? `Nenhum produto encontrado para "${termo}"`
            : 'Nenhum produto cadastrado. Clique em "Novo Produto" para comecar.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {produtos.map((produto) => (
            <ProdutoCard
              key={produto.produto_id}
              produto={produto}
              imagem_path={defaultImages[produto.produto_id]}
            />
          ))}
        </div>
      )}

      {/* Dialog */}
      <NovoProdutoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCriado={carregarProdutos}
      />
    </div>
  )
}
