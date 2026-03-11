import { useState, useEffect } from 'react'
import { listarImagens } from '@renderer/servicos/produtos'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@renderer/components/ui/dialog'
import { Badge } from '@renderer/components/ui/badge'
import { ImageOff, Loader2 } from 'lucide-react'
import type { ProdutoImagem } from '@shared/types'

interface ImagePickerProps {
  produto_id: number
  current_imagem_id: number | null
  open: boolean
  onClose: () => void
  onSelect: (imagem: ProdutoImagem) => void
}

export function ImagePicker({
  produto_id,
  current_imagem_id,
  open,
  onClose,
  onSelect
}: ImagePickerProps) {
  const [imagens, setImagens] = useState<ProdutoImagem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return

    let cancelled = false
    setLoading(true)

    listarImagens(produto_id)
      .then((result) => {
        if (!cancelled) setImagens(result)
      })
      .catch((err) => {
        console.error('Erro ao listar imagens:', err)
        if (!cancelled) setImagens([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, produto_id])

  function handleSelect(imagem: ProdutoImagem) {
    onSelect(imagem)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Escolher Imagem</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Selecione uma imagem para este item
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && imagens.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <ImageOff className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              Nenhuma imagem cadastrada para este produto
            </p>
          </div>
        )}

        {!loading && imagens.length > 0 && (
          <div className="grid grid-cols-3 gap-2 max-h-[320px] overflow-y-auto pr-1">
            {imagens.map((img) => {
              const is_current = img.imagem_id === current_imagem_id
              return (
                <button
                  key={img.imagem_id}
                  onClick={() => handleSelect(img)}
                  className={`relative rounded-md border-2 overflow-hidden aspect-square cursor-pointer transition-colors hover:border-primary/60 ${
                    is_current
                      ? 'border-primary ring-2 ring-primary/30'
                      : 'border-transparent'
                  }`}
                >
                  <img
                    src={`file://${img.arquivo_path}`}
                    alt={img.variacao || 'Imagem do produto'}
                    className="w-full h-full object-cover"
                  />

                  {/* Default badge */}
                  {img.is_default && (
                    <Badge
                      variant="secondary"
                      className="absolute top-1 left-1 text-[8px] h-4 px-1 bg-blue-100 text-blue-800"
                    >
                      Default
                    </Badge>
                  )}

                  {/* Current indicator */}
                  {is_current && (
                    <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                      <Badge className="text-[9px] h-5">Atual</Badge>
                    </div>
                  )}

                  {/* Variation label */}
                  {img.variacao && (
                    <span className="absolute bottom-1 left-1 right-1 text-[8px] text-white bg-black/60 rounded px-1 py-0.5 truncate text-center">
                      {img.variacao}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
