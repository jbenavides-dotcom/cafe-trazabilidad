import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// HashRouter en lugar de BrowserRouter porque GH Pages no soporta SPA fallback
// nativamente: las rutas profundas darían 404 al refrescar. Hash las preserva.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
