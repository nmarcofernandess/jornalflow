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
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { UNIDADES, CATEGORIAS } from '@shared/constants'
import { criarProduto } from '@renderer/servicos/produtos'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCriado: () => void
}

export function NovoProdutoDialog({ open, onOpenChange, onCriado }: Props) {
  const [codigo, setCodigo] = useState('')
  const [nome, setNome] = useState('')
  const [unidade, setUnidade] = useState<string>(UNIDADES[0])
  const [categoria, setCategoria] = useState<string>('')
  const [nome_card, setNomeCard] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function resetForm() {
    setCodigo('')
    setNome('')
    setUnidade(UNIDADES[0])
    setCategoria('')
    setNomeCard('')
    setErro(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!codigo.trim() || !nome.trim()) {
      setErro('Codigo e nome sao obrigatorios')
      return
    }

    setSalvando(true)
    setErro(null)

    try {
      await criarProduto({
        codigo: codigo.trim(),
        nome: nome.trim(),
        unidade,
        nome_card: nome_card.trim() || undefined,
        categoria: categoria || undefined
      })
      resetForm()
      onOpenChange(false)
      onCriado()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar produto')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Produto</DialogTitle>
          <DialogDescription>
            Cadastre um novo produto no catalogo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="codigo">Codigo *</Label>
              <Input
                id="codigo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Ex: 001234"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unidade">Unidade</Label>
              <select
                id="unidade"
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome completo do produto"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nome_card">Nome Card</Label>
            <Input
              id="nome_card"
              value={nome_card}
              onChange={(e) => setNomeCard(e.target.value)}
              placeholder="Nome curto para o card (opcional)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoria">Categoria</Label>
            <select
              id="categoria"
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

          {erro && (
            <p className="text-sm text-destructive">{erro}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Criar Produto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
