// Google OAuth via Google Identity Services (GIS)
// Login con Google y obtención de access_token para Sheets API

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets'

export interface AuthUser {
  email: string
  name: string
  picture: string
  access_token: string
  expires_at: number
}

const STORAGE_KEY = 'cafe-trazabilidad-auth'

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const u: AuthUser = JSON.parse(raw)
    if (Date.now() > u.expires_at) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return u
  } catch { return null }
}

export function saveUser(u: AuthUser) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
}

export function logout() {
  localStorage.removeItem(STORAGE_KEY)
  if (window.google?.accounts?.oauth2) {
    const u = getStoredUser()
    if (u?.access_token) {
      window.google.accounts.oauth2.revoke(u.access_token, () => {})
    }
  }
}

/**
 * Solicita login Google + access_token con scope Sheets.
 * Devuelve promesa que resuelve con AuthUser.
 */
export function requestGoogleLogin(): Promise<AuthUser> {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts) {
      reject(new Error('Google Identity Services no cargado'))
      return
    }
    if (!GOOGLE_CLIENT_ID) {
      reject(new Error('VITE_GOOGLE_CLIENT_ID no configurado'))
      return
    }

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: async (tokenResponse) => {
        if (tokenResponse.error) {
          reject(new Error(tokenResponse.error))
          return
        }
        try {
          // Obtener info del usuario con el access_token
          const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
          })
          const info = await r.json()
          const user: AuthUser = {
            email: info.email,
            name: info.name,
            picture: info.picture,
            access_token: tokenResponse.access_token,
            expires_at: Date.now() + (tokenResponse.expires_in - 60) * 1000,
          }
          saveUser(user)
          resolve(user)
        } catch (e) {
          reject(e)
        }
      },
    })
    tokenClient.requestAccessToken({ prompt: 'consent' })
  })
}

/** Devuelve el access_token actual (o null si expiró/no hay sesión) */
export function getAccessToken(): string | null {
  const u = getStoredUser()
  return u?.access_token ?? null
}
