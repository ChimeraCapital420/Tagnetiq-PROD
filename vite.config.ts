import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // THIS IS THE CRUCIAL ADDITION
  server: {
    proxy: {
      // Proxying API requests to the Vercel dev server endpoint
      '/api': {
        target: 'http://localhost:3000', // Default port for Vercel CLI dev server
        changeOrigin: true,
        secure: false,
      },
    },
  },
})