import { NavLink } from 'react-router-dom'
import { Home, Package, Newspaper, Clock, Settings, Bot } from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: Home },
  { to: '/produtos', label: 'Produtos', icon: Package },
  { to: '/editor', label: 'Editor', icon: Newspaper },
  { to: '/historico', label: 'Histórico', icon: Clock },
  { to: '/ia', label: 'Assistente IA', icon: Bot },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
]

export function AppSidebar() {
  return (
    <aside className="w-60 border-r bg-sidebar flex flex-col h-screen">
      <div className="p-4 border-b">
        <h1 className="text-lg font-bold tracking-tight">JornalFlow</h1>
        <p className="text-xs text-muted-foreground">Gerador de Ofertas</p>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
              }`
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t text-xs text-muted-foreground">
        Sup Fernandes v1.0
      </div>
    </aside>
  )
}
