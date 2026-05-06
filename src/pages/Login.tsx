import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { requestGoogleLogin, type AuthUser } from '../lib/auth'
import './Login.css'

interface Props {
  onLogin: (user: AuthUser) => void
}

export default function Login({ onLogin }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function handleLogin() {
    setLoading(true)
    setError(null)
    try {
      const user = await requestGoogleLogin()
      onLogin(user)
      navigate('/')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card card">
        <div className="login-brand">
          <div className="login-logo">☕</div>
          <h1 className="login-title">Café Trazabilidad</h1>
          <p className="login-subtitle">La Palma y el Tucán · Cosecha 2026</p>
        </div>

        <div className="login-content">
          <p className="login-intro">
            Ingresa con tu cuenta Google de La Palma y el Tucán para registrar baches,
            análisis y nanolotes directamente en el sistema.
          </p>

          <button
            className="btn btn-google login-btn"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <span>Conectando…</span>
            ) : (
              <>
                <GoogleIcon />
                <span>Ingresar con Google</span>
              </>
            )}
          </button>

          {error && <div className="login-error">{error}</div>}

          <div className="login-footer">
            <small>
              Tu cuenta debe tener acceso al Sheet <em>2026 INVENTARIO</em>.
              Si tienes problemas, contacta a Felipe.
            </small>
          </div>
        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}
