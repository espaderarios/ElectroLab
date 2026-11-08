import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ command, mode }) => ({
  plugins: [react()],
  // GitHub Pages serves from /ElectroLab/, including direct editor deep links.
  // Desktop builds must use relative URLs for the Tauri file/protocol bundle.
  base: command === 'serve' ? '/' : mode === 'desktop' ? './' : '/ElectroLab/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  // Large 3D parts file needs more patience during transform
  optimizeDeps: {
    include: ['three', '@react-three/fiber', '@react-three/drei', 'zustand'],
  },
  build: {
    chunkSizeWarningLimit: 2000,
  },
}))
