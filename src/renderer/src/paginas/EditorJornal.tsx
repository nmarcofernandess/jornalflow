import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useEditorStore } from '@renderer/store/editorStore'
import { useIaStore } from '@renderer/store/iaStore'
import { carregarJornal } from '@renderer/servicos/jornais'
import { client } from '@renderer/servicos/client'
import { JornalPreview } from '@renderer/componentes/jornal/JornalPreview'
import { PainelImport } from '@renderer/componentes/editor/PainelImport'
import { PainelSecoes } from '@renderer/componentes/editor/PainelSecoes'
import { PainelItem } from '@renderer/componentes/editor/PainelItem'
import { PainelAlertas } from '@renderer/componentes/editor/PainelAlertas'
import { PoolProdutos } from '@renderer/componentes/editor/PoolProdutos'
import { ExportDialog } from '@renderer/componentes/editor/ExportDialog'
import { IaChatPanel } from '@renderer/componentes/ia/IaChatPanel'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { Button } from '@renderer/components/ui/button'
import { Download, Bot, Plus, FilePlus } from 'lucide-react'
import type { Produto } from '@shared/types'

type EditorTab = 'import' | 'secoes' | 'item' | 'alertas' | 'pool'

const tabLabels: Record<EditorTab, string> = {
  import: 'Import',
  secoes: 'Secoes',
  item: 'Item',
  alertas: 'Alertas',
  pool: 'Produtos'
}

export default function EditorJornal() {
  const { jornal_id } = useParams()
  const store = useEditorStore()
  const iaStore = useIaStore()
  const [tab, setTab] = useState<EditorTab>('import')
  const [exportOpen, setExportOpen] = useState(false)

  // Especial mode creation state
  const [showCriarEspecial, setShowCriarEspecial] = useState(false)
  const [especTitulo, setEspecTitulo] = useState('')
  const [especInicio, setEspecInicio] = useState('')
  const [especFim, setEspecFim] = useState('')

  const isEspecial = store.jornal?.tipo === 'especial'

  const availableTabs: readonly EditorTab[] = isEspecial
    ? (['pool', 'secoes', 'item', 'alertas'] as const)
    : (['import', 'secoes', 'item', 'alertas'] as const)

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
      // Switch to appropriate tab after loading
      setTab(data.jornal.tipo === 'especial' ? 'pool' : 'secoes')
    } catch (err) {
      console.error('Erro ao carregar jornal:', err)
      store.setLoading(false)
    }
  }

  async function criarEspecial() {
    if (!especTitulo || !especInicio || !especFim) return
    try {
      const jornal = await client['jornal.criar_especial']({
        titulo: especTitulo,
        data_inicio: especInicio,
        data_fim: especFim
      })
      // Add first page
      await client['jornal.adicionar_pagina']({ jornal_id: jornal.jornal_id })
      // Load the journal
      await loadJournal(jornal.jornal_id)
      setShowCriarEspecial(false)
      setEspecTitulo('')
      setEspecInicio('')
      setEspecFim('')
    } catch (err) {
      console.error('Erro ao criar jornal especial:', err)
    }
  }

  async function handleAddProduto(produto: Produto) {
    const precoStr = window.prompt(`Preco oferta para ${produto.nome}:`)
    if (!precoStr) return
    const preco = parseFloat(precoStr.replace(',', '.'))
    if (isNaN(preco)) return

    const clubeStr = window.prompt('Preco clube (0 se nao tiver):') || '0'
    const clube = parseFloat(clubeStr.replace(',', '.')) || 0

    const secao_id = store.secoes[0]?.jornal_secao_id
    if (!secao_id || !store.jornal) return

    await client['jornal.adicionar_item']({
      jornal_id: store.jornal.jornal_id,
      jornal_secao_id: secao_id,
      produto_id: produto.produto_id,
      preco_oferta: preco,
      preco_clube: clube
    })

    await loadJournal(store.jornal.jornal_id)
  }

  async function handleAddPagina() {
    if (!store.jornal) return
    await client['jornal.adicionar_pagina']({ jornal_id: store.jornal.jornal_id })
    await loadJournal(store.jornal.jornal_id)
  }

  async function handleAddSecao() {
    if (!store.jornal || store.paginas.length === 0) return
    const nome = window.prompt('Nome da secao:')
    if (!nome) return
    const pagina_id = store.paginas[store.paginas.length - 1].pagina_id
    await client['jornal.adicionar_secao']({
      jornal_id: store.jornal.jornal_id,
      pagina_id,
      nome_custom: nome
    })
    await loadJournal(store.jornal.jornal_id)
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
          {availableTabs.map((t) => (
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
          {tab === 'pool' && <PoolProdutos onAddProduto={handleAddProduto} />}
          {tab === 'secoes' && <PainelSecoes />}
          {tab === 'item' && <PainelItem />}
          {tab === 'alertas' && <PainelAlertas />}
        </div>
      </div>

      {/* Right Panel — Preview */}
      <div className="flex-1 overflow-auto bg-gray-100 flex flex-col">
        {store.jornal && (
          <div className="flex items-center justify-between gap-2 px-4 py-2 border-b bg-background flex-shrink-0">
            <div className="flex items-center gap-2">
              {isEspecial && (
                <>
                  <Button size="sm" variant="outline" onClick={handleAddPagina}>
                    <FilePlus className="h-4 w-4" />
                    Pagina
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleAddSecao}>
                    <Plus className="h-4 w-4" />
                    Secao
                  </Button>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={iaStore.open ? 'default' : 'outline'}
                onClick={() => iaStore.toggleOpen()}
              >
                <Bot className="h-4 w-4" />
                IA
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setExportOpen(true)}
              >
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            </div>
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
        ) : showCriarEspecial ? (
          <div className="flex items-center justify-center h-full">
            <div className="bg-background border rounded-lg p-6 w-full max-w-sm space-y-4">
              <h2 className="text-lg font-semibold">Novo Jornal Especial</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Titulo</label>
                  <input
                    type="text"
                    value={especTitulo}
                    onChange={(e) => setEspecTitulo(e.target.value)}
                    placeholder="Ex: Pascoa 2026"
                    className="w-full rounded-md border px-3 py-2 text-sm mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Inicio</label>
                    <input
                      type="date"
                      value={especInicio}
                      onChange={(e) => setEspecInicio(e.target.value)}
                      className="w-full rounded-md border px-3 py-2 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Fim</label>
                    <input
                      type="date"
                      value={especFim}
                      onChange={(e) => setEspecFim(e.target.value)}
                      className="w-full rounded-md border px-3 py-2 text-sm mt-1"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowCriarEspecial(false)}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={criarEspecial}
                  disabled={!especTitulo || !especInicio || !especFim}
                >
                  Criar
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm">Importe uma planilha para criar um jornal semanal</p>
              <p className="text-xs text-muted-foreground/60">
                Use a aba Import no painel esquerdo
              </p>
              <div className="border-t pt-4 mt-2">
                <button
                  onClick={() => setShowCriarEspecial(true)}
                  className="text-sm text-primary hover:underline"
                >
                  Ou crie um Jornal Especial
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* IA Chat Panel */}
      <IaChatPanel />

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
