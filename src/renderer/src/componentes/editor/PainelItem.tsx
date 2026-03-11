import { useState, useEffect, useCallback } from 'react'
import { useEditorStore } from '@renderer/store/editorStore'
import { atualizarItem } from '@renderer/servicos/jornais'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Badge } from '@renderer/components/ui/badge'
import { Save, Package, ImagePlus } from 'lucide-react'
import { ImagePicker } from './ImagePicker'
import { ImageComposer } from './ImageComposer'
import type { ProdutoImagem } from '@shared/types'

export function PainelItem() {
  const { selected_item_id, itens, produtos_map, imagens_map, updateItem } = useEditorStore()

  const item = itens.find((i) => i.item_id === selected_item_id) || null
  const produto = item ? produtos_map[item.produto_id] || null : null
  const imagem = item?.imagem_id ? imagens_map[item.imagem_id] || null : null

  // Local form state
  const [preco_oferta, setPrecoOferta] = useState('')
  const [preco_clube, setPrecoClube] = useState('')
  const [unidade_display, setUnidadeDisplay] = useState('')
  const [img_scale, setImgScale] = useState(1)
  const [img_offset_x, setImgOffsetX] = useState(0)
  const [img_offset_y, setImgOffsetY] = useState(0)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [picker_open, setPickerOpen] = useState(false)

  // Sync local state when selected item changes
  const syncFromItem = useCallback(() => {
    if (item) {
      setPrecoOferta(item.preco_oferta.toFixed(2))
      setPrecoClube(item.preco_clube.toFixed(2))
      setUnidadeDisplay(item.unidade_display || '')
      setImgScale(item.img_scale)
      setImgOffsetX(item.img_offset_x)
      setImgOffsetY(item.img_offset_y)
      setDirty(false)
    }
  }, [item])

  useEffect(() => {
    syncFromItem()
  }, [syncFromItem])

  function markDirty() {
    setDirty(true)
  }

  async function handleImageSelect(imagem: ProdutoImagem) {
    if (!item) return
    const changes = { imagem_id: imagem.imagem_id }
    try {
      await atualizarItem(item.item_id, changes)
      updateItem(item.item_id, changes)
    } catch (err) {
      console.error('Erro ao trocar imagem:', err)
    }
  }

  async function handleImgsCompostas(paths: string[]) {
    if (!item) return
    const imgs_compostas = paths.length > 0 ? paths : null
    const changes = { imgs_compostas }
    try {
      await atualizarItem(item.item_id, changes)
      updateItem(item.item_id, changes)
    } catch (err) {
      console.error('Erro ao atualizar composicao:', err)
    }
  }

  async function handleSave() {
    if (!item) return

    const changes = {
      preco_oferta: parseFloat(preco_oferta) || 0,
      preco_clube: parseFloat(preco_clube) || 0,
      unidade_display: unidade_display || null,
      img_scale,
      img_offset_x,
      img_offset_y
    }

    setSaving(true)
    try {
      await atualizarItem(item.item_id, changes)
      updateItem(item.item_id, changes)
      setDirty(false)
    } catch (err) {
      console.error('Erro ao salvar item:', err)
    } finally {
      setSaving(false)
    }
  }

  if (!item || !produto) {
    return (
      <div className="p-4 flex flex-col items-center gap-3 text-center">
        <Package className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">
          Selecione um item no preview ou na lista de secoes
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Product info (read-only) */}
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold truncate">{produto.nome}</p>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] h-5">
            {produto.codigo}
          </Badge>
          {item.is_fallback && (
            <Badge variant="secondary" className="text-[10px] h-5 bg-yellow-100 text-yellow-800">
              Fallback
            </Badge>
          )}
          {!item.imagem_id && (
            <Badge variant="secondary" className="text-[10px] h-5 bg-red-100 text-red-800">
              Sem imagem
            </Badge>
          )}
        </div>
      </div>

      {/* Image preview */}
      {imagem && (
        <div className="rounded-md border overflow-hidden bg-gray-50 aspect-[4/3] flex items-center justify-center">
          <img
            src={`file://${imagem.arquivo_path}`}
            alt={produto.nome}
            className="w-full h-full object-cover"
            style={{
              transform: `scale(${img_scale})`,
              objectPosition: `${50 + img_offset_x}% ${50 + img_offset_y}%`
            }}
          />
        </div>
      )}

      {/* Image picker trigger */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setPickerOpen(true)}
        className="w-full text-xs"
      >
        <ImagePlus className="h-3.5 w-3.5 mr-1.5" />
        Trocar Imagem
      </Button>

      <ImagePicker
        produto_id={item.produto_id}
        current_imagem_id={item.imagem_id}
        open={picker_open}
        onClose={() => setPickerOpen(false)}
        onSelect={handleImageSelect}
      />

      {/* Multi-image composer */}
      {item.imgs_compostas !== undefined && (
        <ImageComposer
          produto_id={item.produto_id}
          imgs_compostas={item.imgs_compostas}
          onChange={handleImgsCompostas}
        />
      )}

      {/* Price fields */}
      <div className="flex gap-2">
        <div className="flex-1 flex flex-col gap-1.5">
          <Label className="text-[10px]">Preco Oferta</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={preco_oferta}
            onChange={(e) => {
              setPrecoOferta(e.target.value)
              markDirty()
            }}
            className="h-8 text-xs"
          />
        </div>
        <div className="flex-1 flex flex-col gap-1.5">
          <Label className="text-[10px]">Preco Clube</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={preco_clube}
            onChange={(e) => {
              setPrecoClube(e.target.value)
              markDirty()
            }}
            className="h-8 text-xs"
          />
        </div>
      </div>

      {/* Unit display */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-[10px]">Unidade Display</Label>
        <Input
          type="text"
          value={unidade_display}
          onChange={(e) => {
            setUnidadeDisplay(e.target.value)
            markDirty()
          }}
          placeholder={produto.unidade}
          className="h-8 text-xs"
        />
      </div>

      {/* Image adjustments */}
      <div className="flex flex-col gap-3">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          Ajuste de Imagem
        </p>

        {/* Zoom */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <Label className="text-[10px]">Zoom</Label>
            <span className="text-[10px] text-muted-foreground">{img_scale.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={img_scale}
            onChange={(e) => {
              setImgScale(parseFloat(e.target.value))
              markDirty()
            }}
            className="w-full h-1.5 accent-primary"
          />
        </div>

        {/* Offset X */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <Label className="text-[10px]">Offset X</Label>
            <span className="text-[10px] text-muted-foreground">{img_offset_x}%</span>
          </div>
          <input
            type="range"
            min="-50"
            max="50"
            step="1"
            value={img_offset_x}
            onChange={(e) => {
              setImgOffsetX(parseInt(e.target.value))
              markDirty()
            }}
            className="w-full h-1.5 accent-primary"
          />
        </div>

        {/* Offset Y */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <Label className="text-[10px]">Offset Y</Label>
            <span className="text-[10px] text-muted-foreground">{img_offset_y}%</span>
          </div>
          <input
            type="range"
            min="-50"
            max="50"
            step="1"
            value={img_offset_y}
            onChange={(e) => {
              setImgOffsetY(parseInt(e.target.value))
              markDirty()
            }}
            className="w-full h-1.5 accent-primary"
          />
        </div>
      </div>

      {/* Save button */}
      <Button
        onClick={handleSave}
        disabled={!dirty || saving}
        className="w-full"
        size="sm"
      >
        <Save className="h-3.5 w-3.5 mr-1.5" />
        {saving ? 'Salvando...' : 'Salvar Alteracoes'}
      </Button>
    </div>
  )
}
