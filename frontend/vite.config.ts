import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  build: {
    // Target Chrome 72+, Safari 12+, Firefox 68+ so the PWA runs on 2018-era
    // budget Android phones and older iOS devices, not just 2021+ flagships.
    target: ['chrome72', 'firefox68', 'safari12.1', 'edge79'],
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'icons';
          }
          if (id.includes('node_modules/cmdk')) {
            return 'command';
          }
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-') || id.includes('node_modules/victory')) {
            return 'charts';
          }
          if (id.includes('node_modules/docx') || id.includes('node_modules/xlsx') || id.includes('node_modules/exceljs') || id.includes('node_modules/file-saver')) {
            return 'export-libs';
          }
          if (id.includes('node_modules/@radix-ui')) {
            return 'radix-ui';
          }
          if (id.includes('node_modules/date-fns') || id.includes('node_modules/dayjs') || id.includes('node_modules/moment')) {
            return 'date-utils';
          }
          if (id.includes('node_modules/framer-motion') || id.includes('node_modules/@motionone')) {
            return 'animation';
          }
          if (id.includes('node_modules/zod') || id.includes('node_modules/react-hook-form') || id.includes('node_modules/@hookform')) {
            return 'forms';
          }
          if (id.includes('node_modules/axios') || id.includes('node_modules/@tanstack/react-query')) {
            return 'data-fetching';
          }
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Ledgio Business Accounting Software | Multi-Tenant ERP & Accounting Platform',
        short_name: 'Ledgio',
        description:
          'Multi-tenant accounting and ERP platform with double-entry bookkeeping, multi-warehouse inventory, invoicing, bank reconciliation, and instant SMS cash-shortage alerts.',
        theme_color: '#022c22',
        background_color: '#022c22',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cap per-file precache size so the SW install doesn't download the
        // entire split-bundle set on a slow connection (default is 2 MB).
        maximumFileSizeToCacheInBytes: 500 * 1024, // 500 KB per asset
        // Financial data must never be served from cache; partner static pages
        // must resolve to their own HTML, not the SPA shell.
        navigateFallbackDenylist: [/^\/api\//, /^\/partner\//],
        runtimeCaching: [
          {
            // Cache Google Fonts stylesheets for 1 year (stale-while-revalidate
            // so the page doesn't block on a slow connection).
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Cache the actual font files (woff2) for 1 year — they are
            // content-addressed so a new font version gets a new URL.
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
