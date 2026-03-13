import { useState } from 'react'
import { ImagePicker } from './ImagePicker'
import { Button } from '@renderer/components/ui/button'
import { Plus, X } from 'lucide-react'
import type { ProdutoImagem } from '@shared/types'
import { useDataDir, imageUrl } from '@renderer/lib/image-url'

interface ImageComposerProps {
  produto_id: number
  imgs_compostas: string[] | null
  onChange: (paths: string[]) => void
}

const MAX_SLOTS = 3

export function ImageComposer({ produto_id, imgs_compostas, onChange }: ImageComposerProps) {
  const dataDir = useDataDir()
  const paths = imgs_compostas || []
  const [picker_slot, setPickerSlot] = useState<number | null>(null)

  function handleSelect(imagem: ProdutoImagem) {
    const updated = [...paths]
    if (picker_slot !== null && picker_slot < MAX_SLOTS) {
      if (picker_slot < updated.length) {
        updated[picker_slot] = imagem.arquivo_path
      } else {
        updated.push(imagem.arquivo_path)
      }
      onChange(updated)
    }
    setPickerSlot(null)
  }

  function handleRemove(index: number) {
    const updated = paths.filter((_, i) => i !== index)
    onChange(updated)
  }

  const slots_to_show = Math.min(Math.max(paths.length + 1, 1), MAX_SLOTS)

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
        Composicao de Imagens
      </p>

      <div className="flex gap-2">
        {Array.from({ length: slots_to_show }).map((_, index) => {
          const path = paths[index]

          if (path) {
            return (
              <div
                key={index}
                className="relative rounded-md border overflow-hidden aspect-square flex-1 max-w-[80px] group"
              >
                <img
                  src={imageUrl(dataDir, path)}
                  alt={`Imagem ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => handleRemove(index)}
                  className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
                <span className="absolute bottom-0.5 left-0.5 text-[8px] text-white bg-black/60 rounded px-1">
                  {index + 1}
                </span>
              </div>
            )
          }

          return (
            <Button
              key={index}
              variant="outline"
              onClick={() => setPickerSlot(index)}
              className="aspect-square flex-1 max-w-[80px] border-dashed flex items-center justify-center"
            >
              <Plus className="h-4 w-4 text-muted-foreground" />
            </Button>
          )
        })}
      </div>

      <ImagePicker
        produto_id={produto_id}
        current_imagem_id={null}
        open={picker_slot !== null}
        onClose={() => setPickerSlot(null)}
        onSelect={handleSelect}
      />
    </div>
  )
}
