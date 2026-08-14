import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// Chunk strategy (stack §10.1): react + query core are named so the shell
// budget is measurable; the admin graph stays isolated behind its lazy
// boundary (recharts never leaves the admin chunk).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    allowedHosts: ['.monkeycode-ai.live'],
    proxy: {
      '/api': {
        target: 'https://social-media-marketplace.up.railway.app',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'https://social-media-marketplace.up.railway.app',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (
            id.includes('react') ||
            id.includes('react-dom') ||
            id.includes('react-router')
          ) {
            return 'react-vendor'
          }
          if (
            id.includes('@tanstack/react-query') ||
            id.includes('zustand') ||
            id.includes('axios') ||
            id.includes('socket.io-client') ||
            id.includes('engine.io-client') ||
            id.includes('sonner') ||
            id.includes('react-hook-form') ||
            id.includes('zod') ||
            id.includes('@hookform/resolvers')
          ) {
            return 'query-vendor'
          }
          return undefined
        },
      },
    },
  },
})
