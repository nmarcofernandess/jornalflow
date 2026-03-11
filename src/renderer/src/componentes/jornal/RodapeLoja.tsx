import type { Loja } from '@shared/types'

interface RodapeLojaProps {
  loja: Loja
}

export function RodapeLoja({ loja }: RodapeLojaProps) {
  return (
    <div
      className="w-full bg-gray-900 text-white px-6 py-3 flex items-center justify-center gap-6 text-xs"
      data-export="rodape-loja"
    >
      <span className="font-bold text-sm">{loja.nome}</span>

      {loja.endereco && (
        <span className="text-gray-300">{loja.endereco}</span>
      )}

      {loja.telefone && (
        <span className="text-gray-300">{loja.telefone}</span>
      )}

      {loja.horario_func && (
        <span className="text-gray-300">{loja.horario_func}</span>
      )}
    </div>
  )
}
