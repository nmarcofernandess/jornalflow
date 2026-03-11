import { useState, useEffect } from 'react'
import { listarProdutos, buscarProdutos } from '@renderer/servicos/produtos'
import type { Produto } from '@shared/types'
import { Search, Plus } from 'lucide-react'

interface PoolProdutosProps {
  onAddProduto: (produto: Produto) => void
}

export function PoolProdutos({ onAddProduto }: PoolProdutosProps) {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [termo, setTermo] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const lista = termo.trim()
          ? await buscarProdutos(termo.trim())
          : await listarProdutos()
        setProdutos(lista)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }, termo ? 300 : 0)

    return () => clearTimeout(timer)
  }, [termo])

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar produto..."
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            className="w-full rounded-md border px-8 py-1.5 text-sm"
          />
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {loading ? (
          <p className="p-3 text-sm text-muted-foreground">Carregando...</p>
        ) : produtos.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">Nenhum produto encontrado.</p>
        ) : (
          <div className="divide-y">
            {produtos.map((p) => (
              <button
                key={p.produto_id}
                onClick={() => onAddProduto(p)}
                className="w-full flex items-center justify-between p-2.5 text-left hover:bg-accent text-sm transition-colors"
              >
                <div>
                  <p className="font-medium">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">{p.codigo} · {p.unidade}</p>
                </div>
                <Plus className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
