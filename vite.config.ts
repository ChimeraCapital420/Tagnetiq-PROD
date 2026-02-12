import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Tagnetiq',
        short_name: 'Tagnetiq',
        description: 'AI-powered valuation platform',
        theme_color: '#000000',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      // FIX: Raise precache limit so the SW doesn't choke on large chunks
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4MB limit
        // Don't precache source maps or huge chunks — fetch on demand instead
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Cache API calls with network-first strategy
            urlPattern: /^https:\/\/.*\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
          {
            // Cache fonts/images with cache-first
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|woff2)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'asset-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    minify: 'terser',
    chunkSizeWarningLimit: 600, // Raise from default 500 to reduce noise
    rollupOptions: {
      output: {
        manualChunks: {
          // ── Framework ─────────────────────────────────
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],

          // ── UI libraries ──────────────────────────────
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-tabs',
          ],
          'animation': ['framer-motion'],

          // ── Data layer ────────────────────────────────
          'supabase': ['@supabase/supabase-js'],

          // ── AI SDKs (server-side, but imported in shared types)
          'ai-vendors': ['@anthropic-ai/sdk', '@google/generative-ai', 'openai'],

          // ── Utilities ─────────────────────────────────
          'i18n': ['i18next', 'react-i18next'],
          'charts': ['recharts'],
        }
      }
    }
  },
  server: {
    port: 5173,
    host: true
  },
  define: {
    // Only expose specific env vars that are safe for client-side
    'process.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL),
    'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY),
    'process.env.VITE_VERCEL_URL': JSON.stringify(process.env.VITE_VERCEL_URL),
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
  }
});