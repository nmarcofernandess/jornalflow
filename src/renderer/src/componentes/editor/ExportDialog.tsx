import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { gerarExportacao, abrirPasta } from '@renderer/servicos/exportacao'
import { Loader2, CheckCircle2, FolderOpen, AlertCircle } from 'lucide-react'

interface ExportDialogProps {
  jornal_id: number
  open: boolean
  onClose: () => void
}

type ExportState = 'idle' | 'loading' | 'done' | 'error'

export function ExportDialog({ jornal_id, open, onClose }: ExportDialogProps) {
  const [state, setState] = useState<ExportState>('idle')
  const [files, setFiles] = useState<string[]>([])
  const [outputDir, setOutputDir] = useState('')
  const [error, setError] = useState('')

  function handleOpenChange(next: boolean) {
    if (!next) {
      // Reset state when closing
      setState('idle')
      setFiles([])
      setOutputDir('')
      setError('')
      onClose()
    }
  }

  async function handleExport() {
    setState('loading')
    setError('')
    try {
      const result = await gerarExportacao(jornal_id)
      setFiles(result.files)
      setOutputDir(result.outputDir)
      setState('done')
    } catch (err) {
      console.error('Erro na exportacao:', err)
      setError(err instanceof Error ? err.message : 'Erro desconhecido ao exportar')
      setState('error')
    }
  }

  async function handleOpenFolder() {
    if (outputDir) {
      await abrirPasta(outputDir)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar Jornal</DialogTitle>
          <DialogDescription>
            {state === 'done'
              ? `${files.length} arquivos gerados com sucesso.`
              : 'O jornal sera exportado em multiplos formatos.'}
          </DialogDescription>
        </DialogHeader>

        {state === 'idle' && (
          <div className="space-y-4">
            <ul className="text-sm text-muted-foreground space-y-1.5 pl-1">
              <li className="flex items-center gap-2">
                <span className="text-foreground font-medium">PDF</span> completo
              </li>
              <li className="flex items-center gap-2">
                <span className="text-foreground font-medium">PNG</span> por pagina
              </li>
              <li className="flex items-center gap-2">
                <span className="text-foreground font-medium">Stories</span> 1080x1920
              </li>
              <li className="flex items-center gap-2">
                <span className="text-foreground font-medium">Carrossel</span> 1080x1080
              </li>
            </ul>
            <Button onClick={handleExport} className="w-full">
              Gerar Exportacoes
            </Button>
          </div>
        )}

        {state === 'loading' && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Gerando exportacoes...</p>
          </div>
        )}

        {state === 'done' && (
          <div className="space-y-4">
            <div className="max-h-48 overflow-auto rounded-md border p-3 space-y-1">
              {files.map((file) => (
                <div key={file} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <span className="truncate">{file}</span>
                </div>
              ))}
            </div>
            <DialogFooter className="flex gap-2 sm:gap-2">
              <Button variant="outline" onClick={handleOpenFolder}>
                <FolderOpen className="h-4 w-4" />
                Abrir Pasta
              </Button>
              <Button onClick={() => handleOpenChange(false)}>Fechar</Button>
            </DialogFooter>
          </div>
        )}

        {state === 'error' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
            <DialogFooter className="flex gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Fechar
              </Button>
              <Button onClick={handleExport}>Tentar Novamente</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
