import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useEditorStore } from '@renderer/store/editorStore'
import { carregarJornal } from '@renderer/servicos/jornais'
import { JornalPreview } from '@renderer/componentes/jornal/JornalPreview'
import { PainelImport } from '@renderer/componentes/editor/PainelImport'
import { PainelSecoes } from '@renderer/componentes/editor/PainelSecoes'
import { PainelItem } from '@renderer/componentes/editor/PainelItem'
import { PainelAlertas } from '@renderer/componentes/editor/PainelAlertas'
import { ExportDialog } from '@renderer/componentes/editor/ExportDialog'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { Button } from '@renderer/components/ui/button'
import { Download } from 'lucide-react'

type EditorTab = 'import' | 'secoes' | 'item' | 'alertas'

const tabLabels: Record<EditorTab, string> = {
  import: 'Import',
  secoes: 'Secoes',
  item: 'Item',
  alertas: 'Alertas'
}

export default function EditorJornal() {
  const { jornal_id } = useParams()
  const store = useEditorStore()
  const [tab, setTab] = useState<EditorTab>('import')
  const [exportOpen, setExportOpen] = useState(false)

  useEffect(() => {
    if (jornal_id) {
      loadJournal(Number(jornal_id))
    }
    // Reset store when component unmounts
    return () => {
      store.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jornal_id])

  async function loadJournal(id: number) {
    store.setLoading(true)
    try {
      const data = await carregarJornal(id)
      store.loadJornal(data)
      // Switch to secoes tab after loading
      setTab('secoes')
    } catch (err) {
      console.error('Erro ao carregar jornal:', err)
      store.setLoading(false)
    }
  }

  // When an item is selected, switch to item tab
  useEffect(() => {
    if (store.selected_item_id) setTab('item')
  }, [store.selected_item_id])

  return (
    <div className="flex h-full">
      {/* Left Panel */}
      <div className="w-80 border-r flex flex-col bg-background flex-shrink-0">
        {/* Tab buttons */}
        <div className="flex border-b">
          {(['import', 'secoes', 'item', 'alertas'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-xs font-medium transition-colors relative
                ${tab === t ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {tabLabels[t]}
              {t === 'alertas' && store.alerts.length > 0 && (
                <span className="ml-1 bg-yellow-500 text-white text-[10px] rounded-full px-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px]">
                  {store.alerts.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-auto">
          {tab === 'import' && <PainelImport onJournalCreated={loadJournal} />}
          {tab === 'secoes' && <PainelSecoes />}
          {tab === 'item' && <PainelItem />}
          {tab === 'alertas' && <PainelAlertas />}
        </div>
      </div>

      {/* Right Panel — Preview */}
      <div className="flex-1 overflow-auto bg-gray-100 flex flex-col">
        {store.jornal && (
          <div className="flex items-center justify-end px-4 py-2 border-b bg-background flex-shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setExportOpen(true)}
            >
              <Download className="h-4 w-4" />
              Exportar
            </Button>
          </div>
        )}
        <div className="flex-1 overflow-auto p-4">
        {store.loading ? (
          <div className="flex flex-col gap-4 max-w-4xl mx-auto">
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-8 w-full rounded" />
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-48 w-full rounded-lg" />
              ))}
            </div>
          </div>
        ) : store.jornal ? (
          <JornalPreview
            jornal={store.jornal}
            paginas={store.paginas}
            secoes={store.secoes}
            items={store.itens}
            produtos_map={store.produtos_map}
            imagens_map={store.imagens_map}
            templates_map={store.templates_map}
            loja={store.loja}
            selected_item_id={store.selected_item_id}
            onSelectItem={(id) => store.selectItem(id)}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm">Importe uma planilha para comecar</p>
              <p className="text-xs text-muted-foreground/60">
                Use a aba Import no painel esquerdo
              </p>
            </div>
          </div>
        )}
        </div>
      </div>

      {store.jornal && (
        <ExportDialog
          jornal_id={store.jornal.jornal_id}
          open={exportOpen}
          onClose={() => setExportOpen(false)}
        />
      )}
    </div>
  )
}
