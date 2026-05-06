/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string
  readonly VITE_N8N_WEBHOOK_NANOLOTE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Google Identity Services types (mínimos)
declare namespace google.accounts.oauth2 {
  interface TokenResponse {
    access_token: string
    expires_in: number
    error?: string
    error_description?: string
    scope?: string
  }
  interface TokenClient {
    requestAccessToken(overrideConfig?: { prompt?: 'none' | 'consent' | 'select_account' }): void
  }
  interface TokenClientConfig {
    client_id: string
    scope: string
    callback: (response: TokenResponse) => void
    error_callback?: (err: unknown) => void
  }
  function initTokenClient(config: TokenClientConfig): TokenClient
  function revoke(token: string, done: () => void): void
}

declare namespace google.accounts {
  // namespace id used by GIS
}

interface Window {
  google?: {
    accounts: {
      oauth2: typeof google.accounts.oauth2
    }
  }
}
