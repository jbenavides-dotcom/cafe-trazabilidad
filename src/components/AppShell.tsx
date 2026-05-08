import { type ReactNode, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Package, FlaskConical, Coffee, ShoppingBag, LogOut, Menu, X, Beaker, Sparkles, FileText } from 'lucide-react'
import { logout, type AuthUser } from '../lib/auth'
import './AppShell.css'

interface Props {
  user: AuthUser
  onLogout: () => void
  children: ReactNode
}

interface NavItem {
  path: string
  label: string
  icon: typeof LayoutDashboard
  disabled?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Resumen', icon: LayoutDashboard },
  { path: '/baches', label: 'Baches', icon: Package },
  { path: '/analisis/fisico', label: 'Análisis físico', icon: Beaker },
  { path: '/analisis/sensorial', label: 'Análisis sensorial', icon: FlaskConical },
  { path: '/nanolotes', label: 'Nanolotes', icon: Coffee },
  { path: '/craftlab', label: 'CraftLab', icon: Sparkles },
  { path: '/ventas', label: 'Ventas', icon: ShoppingBag },
  { path: '/fichas', label: 'Fichas técnicas', icon: FileText },
]

export default function AppShell({ user, onLogout, children }: Props) {
  const [navOpen, setNavOpen] = useState(false)
  const location = useLocation()

  function handleLogout() {
    logout()
    onLogout()
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <button
          className="nav-toggle"
          onClick={() => setNavOpen(!navOpen)}
          aria-label="Menú"
        >
          {navOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="app-brand">
          <span className="app-brand-icon">☕</span>
          <h1 className="app-brand-title">Café Trazabilidad</h1>
        </div>
        <div className="app-user">
          <img src={user.picture} alt={user.name} className="app-user-avatar" />
          <div className="app-user-info">
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </div>
          <button className="app-user-logout" onClick={handleLogout} title="Salir">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="app-body">
        <nav className={`app-nav ${navOpen ? 'open' : ''}`}>
          {NAV_ITEMS.map(({ path, label, icon: Icon, disabled }) => {
            const active = location.pathname === path || (path !== '/' && location.pathname.startsWith(path))
            return (
              <Link
                key={path}
                to={disabled ? '#' : path}
                className={`nav-link ${active ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
                onClick={(e) => {
                  if (disabled) e.preventDefault()
                  else setNavOpen(false)
                }}
              >
                <Icon size={18} />
                <span>{label}</span>
                {disabled && <em className="nav-soon">pronto</em>}
              </Link>
            )
          })}
        </nav>

        <main className="app-main">{children}</main>
      </div>
    </div>
  )
}
