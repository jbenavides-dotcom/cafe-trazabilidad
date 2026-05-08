import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages: base = '/cafe-trazabilidad/'
// Puerto 5174 fijo: registrado en Google Cloud Console como Authorized JS origin
// para el OAuth Client lpet-cafe-trazabilidad. Si está ocupado, falla en vez de
// caer a otro puerto (que rompería el OAuth con origin_mismatch).
export default defineConfig({
  base: '/cafe-trazabilidad/',
  server: {
    port: 5174,
    strictPort: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // react-pdf añade ~2MB; subir límite a 3MB para evitar error de precache
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      manifest: {
        name: 'Café Trazabilidad LP&ET',
        short_name: 'Trazabilidad',
        description: 'Trazabilidad de café La Palma y El Tucán',
        theme_color: '#0e1e36',
        background_color: '#ececec',
        display: 'standalone',
        scope: '/cafe-trazabilidad/',
        start_url: '/cafe-trazabilidad/',
        icons: []
      }
    })
  ]
})
