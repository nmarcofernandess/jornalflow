import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Star, Trash2, Save, Package } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Badge } from '@renderer/components/ui/badge'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { ImageUpload } from '@renderer/componentes/produtos/ImageUpload'
import {
  listarProdutos,
  atualizarProduto,
  deletarProduto,
  listarImagens,
  definirDefault,
  removerImagem
} from '@renderer/servicos/produtos'
import { UNIDADES, CATEGORIAS } from '@shared/constants'
import type { Produto, ProdutoImagem } from '@shared/types'

export default function ProdutoDetalhe() {
  const { produto_id } = useParams<{ produto_id: string }>()
  const navigate = useNavigate()
  const id = Number(produto_id)

  const [produto, setProduto] = useState<Produto | null>(null)
  const [imagens, setImagens] = useState<ProdutoImagem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState<string | null>(null)

  // Editable fields
  const [nome, setNome] = useState('')
  const [nome_card, setNomeCard] = useState('')
  const [unidade, setUnidade] = useState('')
  const [categoria, setCategoria] = useState('')

  const carregarProduto = useCallback(async () => {
    if (!id || isNaN(id)) return
    setCarregando(true)
    try {
      // Load all products and find the one we need (no individual get handler)
      const todos = await listarProdutos()
      const found = todos.find((p) => p.produto_id === id) ?? null
      setProduto(found)
      if (found) {
        setNome(found.nome)
        setNomeCard(found.nome_card ?? '')
        setUnidade(found.unidade)
        setCategoria(found.categoria ?? '')
      }
    } catch (err) {
      console.error('Erro ao carregar produto:', err)
    } finally {
      setCarregando(false)
    }
  }, [id])

  const carregarImagens = useCallback(async () => {
    if (!id || isNaN(id)) return
    try {
      const imgs = await listarImagens(id)
      setImagens(imgs)
    } catch (err) {
      console.error('Erro ao carregar imagens:', err)
    }
  }, [id])

  useEffect(() => {
    carregarProduto()
    carregarImagens()
  }, [carregarProduto, carregarImagens])

  async function handleSalvar() {
    if (!produto) return
    setSalvando(true)
    setMensagem(null)
    try {
      const updated = await atualizarProduto(produto.produto_id, {
        nome: nome.trim(),
        nome_card: nome_card.trim() || undefined,
        unidade,
        categoria: categoria || undefined
      })
      setProduto(updated)
      setMensagem('Produto salvo!')
      setTimeout(() => setMensagem(null), 2000)
    } catch (err) {
      setMensagem(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  async function handleDeletar() {
    if (!produto) return
    if (!confirm(`Deletar "${produto.nome}"? Essa acao nao pode ser desfeita.`)) return
    try {
      await deletarProduto(produto.produto_id)
      navigate('/produtos')
    } catch (err) {
      console.error('Erro ao deletar:', err)
    }
  }

  async function handleDefinirDefault(imagem_id: number) {
    try {
      await definirDefault(imagem_id)
      await carregarImagens()
    } catch (err) {
      console.error('Erro ao definir default:', err)
    }
  }

  async function handleRemoverImagem(imagem_id: number) {
    try {
      await removerImagem(imagem_id)
      await carregarImagens()
    } catch (err) {
      console.error('Erro ao remover imagem:', err)
    }
  }

  if (carregando) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      </div>
    )
  }

  if (!produto) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate('/produtos')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <p className="mt-4 text-muted-foreground">Produto nao encontrado.</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/produtos')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{produto.nome}</h1>
            <p className="text-sm text-muted-foreground">
              Codigo: {produto.codigo} · Criado em{' '}
              {new Date(produto.criado_em).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={handleDeletar}>
          <Trash2 className="h-4 w-4 mr-2" />
          Deletar
        </Button>
      </div>

      {/* Form */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Informacoes</h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="edit-nome">Nome</Label>
            <Input
              id="edit-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-nome-card">Nome Card</Label>
            <Input
              id="edit-nome-card"
              value={nome_card}
              onChange={(e) => setNomeCard(e.target.value)}
              placeholder="Nome curto (opcional)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-unidade">Unidade</Label>
            <select
              id="edit-unidade"
              value={unidade}
              onChange={(e) => setUnidade(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {UNIDADES.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-categoria">Categoria</Label>
            <select
              id="edit-categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Sem categoria</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleSalvar} disabled={salvando}>
            <Save className="h-4 w-4 mr-2" />
            {salvando ? 'Salvando...' : 'Salvar'}
          </Button>
          {mensagem && (
            <span className="text-sm text-muted-foreground">{mensagem}</span>
          )}
        </div>
      </div>

      {/* Images */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Imagens</h2>
          <ImageUpload produto_id={id} onUploaded={carregarImagens} />
        </div>

        {imagens.length === 0 ? (
          <div className="border rounded-lg p-8 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhuma imagem cadastrada</p>
            <p className="text-xs mt-1">Use o botao acima para adicionar imagens</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {imagens.map((img) => (
              <div
                key={img.imagem_id}
                className="relative border rounded-lg overflow-hidden group"
              >
                <div className="aspect-square bg-muted">
                  <img
                    src={`file://${img.arquivo_path}`}
                    alt={img.variacao ?? 'Imagem'}
                    className="w-full h-full object-cover"
                  />
                </div>

                {img.is_default && (
                  <Badge className="absolute top-1 left-1 text-xs">
                    <Star className="h-3 w-3 mr-1" />
                    Padrao
                  </Badge>
                )}

                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {!img.is_default && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleDefinirDefault(img.imagem_id)}
                    >
                      <Star className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleRemoverImagem(img.imagem_id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>

                {img.variacao && (
                  <p className="text-xs text-center py-1 text-muted-foreground truncate px-1">
                    {img.variacao}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
