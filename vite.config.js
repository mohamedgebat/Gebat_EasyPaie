import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['gebat_logo.jpg'],
      manifest: {
        name: 'Gebat EasyPaie',
        short_name: 'EasyPaie',
        description: 'Gestion de la Paie',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'gebat_logo.jpg',
            sizes: '192x192',
            type: 'image/jpeg'
          },
          {
            src: 'gebat_logo.jpg',
            sizes: '512x512',
            type: 'image/jpeg'
          }
        ]
      }
    })
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  },
  // En production (Vercel), les appels /api/* sont redirigés vers VITE_API_URL
  // En développement local, le proxy ci-dessus prend le relais
})
