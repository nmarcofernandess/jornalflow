import { useState } from 'react'
import { Button } from '@renderer/components/ui/button'
import { client } from '@renderer/servicos/client'
import { FolderOpen } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface BatchResult {
  total_files: number
  matched: number
  playground: number
  errors: number
  details: Array<{
    filename: string
    codigo: string | null
    status: 'matched' | 'playground' | 'error'
    message?: string
  }>
}

interface BatchImportProps {
  onComplete?: () => void
}

export function BatchImport({ onComplete }: BatchImportProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BatchResult | null>(null)
  const navigate = useNavigate()

  async function handleClick() {
    const dialog = await client['dialog.abrir_pasta']()
    if (dialog.canceled || !dialog.path) return

    setLoading(true)
    setResult(null)
    try {
      const res = (await client['import.batch_imagens']({ dir_path: dialog.path })) as BatchResult
      setResult(res)
      if (res.matched > 0) onComplete?.()
    } catch (err) {
      console.error('Batch import error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Button variant="outline" onClick={handleClick} disabled={loading}>
        <FolderOpen className="h-4 w-4 mr-2" />
        {loading ? 'Importando...' : 'Selecionar Pasta'}
      </Button>

      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{result.matched}</p>
              <p className="text-xs text-muted-foreground">Organizadas</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold text-yellow-600">{result.playground}</p>
              <p className="text-xs text-muted-foreground">Playground</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{result.errors}</p>
              <p className="text-xs text-muted-foreground">Erros</p>
            </div>
          </div>

          {result.playground > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/galeria')}
              className="w-full"
            >
              Organizar {result.playground} imagem{result.playground !== 1 ? 's' : ''} no Playground
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
