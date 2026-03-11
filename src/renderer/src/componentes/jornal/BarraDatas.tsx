interface BarraDatasProps {
  data_inicio: string
  data_fim: string
}

function formatDateBR(iso: string): string {
  const date = new Date(iso + 'T00:00:00')
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}`
}

export function BarraDatas({ data_inicio, data_fim }: BarraDatasProps) {
  return (
    <div
      className="w-full bg-red-600 text-white text-center py-2 px-4 font-bold text-sm tracking-wide uppercase"
      data-export="barra-datas"
    >
      OFERTAS VÁLIDAS DE {formatDateBR(data_inicio)} A {formatDateBR(data_fim)} OU ENQUANTO
      DURAREM OS ESTOQUES
    </div>
  )
}
