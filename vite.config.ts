import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages: base = '/cafe-trazabilidad/'
export default defineConfig({
  base: '/cafe-trazabilidad/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
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
