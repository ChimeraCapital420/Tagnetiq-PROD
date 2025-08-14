import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // This line explicitly tells Vite where to find your static assets.
  // This is the crucial fix for the artwork issue.
  publicDir: 'public', 
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})