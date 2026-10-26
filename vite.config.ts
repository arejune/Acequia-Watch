import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // the app shell, the Learn page chunk, fonts, and the OSE snapshot are
      // precached so they open with no signal after the first visit
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,geojson}'],
        navigateFallback: '/index.html',
        maximumFileSizeToCacheInBytes: 3_000_000,
        runtimeCaching: [
          {
            // map tiles: keep a small cache of what was viewed; never prefetch
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\//,
            handler: 'CacheFirst',
            options: { cacheName: 'osm-tiles', expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 14 } },
          },
        ],
      },
      manifest: {
        name: 'Acequia Watch',
        short_name: 'Acequia Watch',
        description: 'Document acequia damage offline, combine reports for agencies with consent, and learn why acequias matter.',
        start_url: '/',
        display: 'standalone',
        background_color: '#f5f0e6',
        theme_color: '#f5f0e6',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 700 },
  test: {
    include: ['src/**/*.test.ts', 'supabase/*.test.ts'],
  },
})
