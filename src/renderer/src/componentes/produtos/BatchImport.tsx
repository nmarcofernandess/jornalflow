import { useState } from 'react'
import { Button } from '@renderer/components/ui/button'
import { client } from '@renderer/servicos/client'

interface BatchResult {
  total_files: number
  matched: number
  unmatched: number
  errors: number
  details: Array<{
    filename: string
    codigo: string | null
    status: 'matched' | 'unmatched' | 'error'
    message?: string
  }>
}

interface BatchImportProps {
  onComplete?: () => void
}

export function BatchImport({ onComplete }: BatchImportProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BatchResult | null>(null)

  async function handleImport(dirPath: string) {
    setLoading(true)
    setResult(null)
    try {
      const res = (await client['import.batch_imagens']({ dir_path: dirPath })) as BatchResult
      setResult(res)
      if (res.matched > 0) onComplete?.()
    } catch (err) {
      console.error('Batch import error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Use a hidden input with webkitdirectory for folder selection
  function handleDirSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    // Get directory path from first file
    const firstFile = files[0]
    // webkitRelativePath gives us "dirname/filename"
    const relativePath = (firstFile as any).webkitRelativePath as string
    if (!relativePath) return
    // In Electron, we can get the full path from the file
    const fullPath = (firstFile as any).path as string
    if (fullPath) {
      // Extract the selected folder: fullPath minus the relative path parts
      const depth = relativePath.split('/').length - 1
      let selectedDir = fullPath
      for (let i = 0; i < depth; i++) {
        selectedDir = selectedDir.substring(0, selectedDir.lastIndexOf('/'))
      }
      handleImport(selectedDir)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="cursor-pointer">
          <input
            type="file"
            className="hidden"
            {...({ webkitdirectory: '', directory: '' } as any)}
            onChange={handleDirSelect}
            disabled={loading}
          />
          <Button variant="outline" asChild disabled={loading}>
            <span>{loading ? 'Importando...' : 'Selecionar Pasta'}</span>
          </Button>
        </label>
      </div>

      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{result.matched}</p>
              <p className="text-xs text-muted-foreground">Importadas</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold text-yellow-600">{result.unmatched}</p>
              <p className="text-xs text-muted-foreground">Sem match</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{result.errors}</p>
              <p className="text-xs text-muted-foreground">Erros</p>
            </div>
          </div>

          {result.details.filter((d) => d.status !== 'matched').length > 0 && (
            <div className="border rounded-lg max-h-48 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2">Arquivo</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {result.details
                    .filter((d) => d.status !== 'matched')
                    .map((d, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 font-mono text-xs">{d.filename}</td>
                        <td className="p-2">
                          <span
                            className={`text-xs ${d.status === 'error' ? 'text-red-600' : 'text-yellow-600'}`}
                          >
                            {d.status === 'error' ? 'Erro' : 'Sem match'}
                          </span>
                        </td>
                        <td className="p-2 text-xs text-muted-foreground">{d.message}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
