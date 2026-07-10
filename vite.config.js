import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Honor a PORT env var when provided (e.g. preview/hosting), else default to 5173.
  server: process.env.PORT ? { port: Number(process.env.PORT) } : undefined,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'icon.png', 'icon-maskable.png'],
      manifest: {
        name: 'ShowUp — Community Volunteer Marketplace',
        short_name: 'ShowUp',
        description:
          'Find volunteer opportunities, log verified hours, and build your service portfolio.',
        theme_color: '#E8553E',
        background_color: '#FDFCFF',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon.png', sizes: '1024x1024', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable.png', sizes: '1024x1024', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
