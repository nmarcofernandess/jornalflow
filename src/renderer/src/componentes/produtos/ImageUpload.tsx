import { useRef } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { adicionarImagem } from '@renderer/servicos/produtos'

interface Props {
  produto_id: number
  onUploaded: () => void
}

export function ImageUpload({ produto_id, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    // In Electron, file inputs expose the real filesystem path
    const file = files[0]
    const filePath = (file as File & { path?: string }).path
    if (!filePath) return

    try {
      await adicionarImagem(produto_id, filePath)
      onUploaded()
    } catch (err) {
      console.error('Erro ao adicionar imagem:', err)
    }

    // Reset input so same file can be picked again
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-4 w-4 mr-2" />
        Adicionar Imagem
      </Button>
    </>
  )
}
