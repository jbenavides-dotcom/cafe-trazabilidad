import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NuevoBache from './pages/NuevoBache'
import ListaBaches from './pages/ListaBaches'
import DetalleBache from './pages/DetalleBache'
import AnalisisSensorial from './pages/AnalisisSensorial'
import AnalisisFisico from './pages/AnalisisFisico'
import AnalisisLista from './pages/AnalisisLista'
import AsignarNanolote from './pages/AsignarNanolote'
import Ventas from './pages/Ventas'
import Fichas from './pages/Fichas'
import CraftLab from './pages/CraftLab'
import PedidosCraftLab from './pages/PedidosCraftLab'
import AppShell from './components/AppShell'
import { getStoredUser, type AuthUser } from './lib/auth'
import OfferingPublic from './pages/OfferingPublic'
import SignPublic from './pages/SignPublic'

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(getStoredUser())

  useEffect(() => {
    const t = setInterval(() => setUser(getStoredUser()), 30_000)
    return () => clearInterval(t)
  }, [])

  // Rutas públicas (sin login, sin AppShell) — el cliente entra por email link.
  // HashRouter usa el hash (#/offering/...) — detectar antes de exigir auth.
  const hash = window.location.hash
  const isPublicRoute = hash.startsWith('#/offering/') || hash.startsWith('#/sign/')

  if (isPublicRoute) {
    return (
      <Routes>
        <Route path="/offering/:token" element={<OfferingPublic />} />
        <Route path="/sign/:token" element={<SignPublic />} />
        <Route path="*" element={<div style={{ padding: 40 }}>Enlace no válido.</div>} />
      </Routes>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={setUser} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <AppShell user={user} onLogout={() => setUser(null)}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/baches" element={<ListaBaches />} />
        <Route path="/baches/nuevo" element={<NuevoBache />} />
        <Route path="/baches/:numero" element={<DetalleBache />} />
        <Route path="/baches/:batch/fisico" element={<AnalisisFisico />} />
        <Route path="/baches/:batch/sensorial" element={<AnalisisSensorial />} />
        <Route path="/analisis/fisico" element={<AnalisisLista tipo="fisico" />} />
        <Route path="/analisis/sensorial" element={<AnalisisLista tipo="sensorial" />} />
        <Route path="/nanolotes" element={<AsignarNanolote />} />
        <Route path="/ventas" element={<Ventas />} />
        <Route path="/fichas" element={<Fichas />} />
        <Route path="/craftlab" element={<CraftLab />} />
        <Route path="/pedidos-craftlab" element={<PedidosCraftLab />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}
