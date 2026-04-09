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
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
          {
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
  optimizeDeps: {
    // Pre-bundle heavy deps so Vite doesn't re-process on every cold start
    include: [
      'pdfjs-dist',
      'mammoth',
    ],
    // pdfjs ships its own worker — exclude it from the bundle
    exclude: [
      'pdfjs-dist/build/pdf.worker.min.mjs',
    ],
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // ── pdfjs + mammoth — large, infrequently used
          // Split into their own chunks so main bundle stays lean.
          // They only load when user attaches a document.
          if (id.includes('pdfjs-dist')) return 'pdf-worker';
          if (id.includes('mammoth'))    return 'doc-parser';

          // ── Framework ────────────────────────────────
          if (id.includes('react-dom') ||
              id.includes('react-router') ||
              id.includes('node_modules/react/')) return 'react-vendor';

          // ── UI libraries ─────────────────────────────
          if (id.includes('@radix-ui')) return 'ui-vendor';
          if (id.includes('framer-motion')) return 'animation';

          // ── Data layer ───────────────────────────────
          if (id.includes('@supabase')) return 'supabase';

          // ── AI SDKs ──────────────────────────────────
          if (id.includes('@anthropic-ai') ||
              id.includes('@google/generative-ai') ||
              id.includes('openai')) return 'ai-vendors';

          // ── Utilities ─────────────────────────────────
          if (id.includes('i18next')) return 'i18n';
          if (id.includes('recharts')) return 'charts';
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  define: {
    'process.env.VITE_SUPABASE_URL':      JSON.stringify(process.env.VITE_SUPABASE_URL),
    'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY),
    'process.env.VITE_VERCEL_URL':        JSON.stringify(process.env.VITE_VERCEL_URL),
  },
});