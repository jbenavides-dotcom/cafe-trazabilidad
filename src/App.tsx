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
import AppShell from './components/AppShell'
import { getStoredUser, type AuthUser } from './lib/auth'

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(getStoredUser())

  useEffect(() => {
    const t = setInterval(() => setUser(getStoredUser()), 30_000)
    return () => clearInterval(t)
  }, [])

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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}
