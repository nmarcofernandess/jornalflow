import { useState, useRef } from 'react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { importarPlanilha } from '@renderer/servicos/jornais'
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react'

interface PainelImportProps {
  onJournalCreated: (jornal_id: number) => void
}

interface ImportStats {
  total: number
  matched: number
  fallbacks: number
}

export function PainelImport({ onJournalCreated }: PainelImportProps) {
  const [file, setFile] = useState<File | null>(null)
  const [data_inicio, setDataInicio] = useState('')
  const [data_fim, setDataFim] = useState('')
  const [importing, setImporting] = useState(false)
  const [stats, setStats] = useState<ImportStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] || null
    setFile(selected)
    setStats(null)
    setError(null)
  }

  async function handleImport() {
    if (!file || !data_inicio || !data_fim) return

    setImporting(true)
    setError(null)
    setStats(null)

    try {
      const text = await file.text()

      const result = await importarPlanilha({
        text,
        data_inicio,
        data_fim,
        arquivo_nome: file.name
      })

      setStats({
        total: result.total,
        matched: result.matched,
        fallbacks: result.fallbacks
      })

      // Load the created journal
      onJournalCreated(result.jornal_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao importar planilha')
    } finally {
      setImporting(false)
    }
  }

  const canImport = file && data_inicio && data_fim && !importing

  return (
    <div className="p-4 flex flex-col gap-4">
      <h3 className="font-semibold text-sm">Importar Planilha</h3>

      {/* Drop zone / file picker */}
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
      >
        {file ? (
          <>
            <FileSpreadsheet className="h-8 w-8 text-primary" />
            <p className="text-xs font-medium text-center truncate max-w-full">{file.name}</p>
            <p className="text-[10px] text-muted-foreground">Clique para trocar</p>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-xs text-muted-foreground text-center">
              Clique para selecionar planilha
            </p>
            <p className="text-[10px] text-muted-foreground">.tsv, .csv, .txt</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".tsv,.csv,.txt"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Date inputs */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="data_inicio" className="text-xs">
            Data Inicio
          </Label>
          <Input
            id="data_inicio"
            type="date"
            value={data_inicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="data_fim" className="text-xs">
            Data Fim
          </Label>
          <Input
            id="data_fim"
            type="date"
            value={data_fim}
            onChange={(e) => setDataFim(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      </div>

      {/* Import button */}
      <Button onClick={handleImport} disabled={!canImport} className="w-full" size="sm">
        {importing ? 'Importando...' : 'Importar'}
      </Button>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="rounded-md bg-muted/50 border p-3 flex flex-col gap-2">
          <p className="text-xs font-semibold">Resultado da importacao</p>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
              <span>
                {stats.matched} produtos encontrados
              </span>
            </div>
            {stats.fallbacks > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-600" />
                <span>
                  {stats.fallbacks} com imagem generica
                </span>
              </div>
            )}
            <div className="text-[10px] text-muted-foreground mt-1">
              Total: {stats.total} itens processados
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
