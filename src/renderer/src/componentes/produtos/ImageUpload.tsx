import { Upload } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { client } from '@renderer/servicos/client'
import { adicionarImagem } from '@renderer/servicos/produtos'

interface Props {
  produto_id: number
  onUploaded: () => void
}

export function ImageUpload({ produto_id, onUploaded }: Props) {
  async function handleClick() {
    try {
      const result = await client['dialog.abrir_imagem']()
      if (result.canceled || !result.path) return

      await adicionarImagem(produto_id, result.path)
      onUploaded()
    } catch (err) {
      console.error('Erro ao adicionar imagem:', err)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick}>
      <Upload className="h-4 w-4 mr-2" />
      Adicionar Imagem
    </Button>
  )
}
