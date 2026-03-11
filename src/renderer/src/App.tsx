import { HashRouter, Routes, Route } from 'react-router-dom'
import { AppSidebar } from '@renderer/componentes/AppSidebar'
import Dashboard from '@renderer/paginas/Dashboard'
import ProdutosLista from '@renderer/paginas/ProdutosLista'
import ProdutoDetalhe from '@renderer/paginas/ProdutoDetalhe'
import EditorJornal from '@renderer/paginas/EditorJornal'
import HistoricoLista from '@renderer/paginas/HistoricoLista'
import HistoricoDetalhe from '@renderer/paginas/HistoricoDetalhe'
import IaPagina from '@renderer/paginas/IaPagina'
import ConfiguracoesPagina from '@renderer/paginas/ConfiguracoesPagina'

export default function App() {
  return (
    <HashRouter>
      <div className="flex h-screen">
        <AppSidebar />
        <main className="flex-1 overflow-auto min-h-0">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/produtos" element={<ProdutosLista />} />
            <Route path="/produtos/:produto_id" element={<ProdutoDetalhe />} />
            <Route path="/editor" element={<EditorJornal />} />
            <Route path="/editor/:jornal_id" element={<EditorJornal />} />
            <Route path="/historico" element={<HistoricoLista />} />
            <Route path="/historico/:jornal_id" element={<HistoricoDetalhe />} />
            <Route path="/ia" element={<IaPagina />} />
            <Route path="/configuracoes" element={<ConfiguracoesPagina />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}
