import { fileURLToPath } from 'url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  build:{rollupOptions:{input:{main:fileURLToPath(new URL('./index.html',import.meta.url)),'nova-local-worker':fileURLToPath(new URL('./src/workers/localAI.worker.js',import.meta.url))},output:{entryFileNames:chunk=>chunk.name==='nova-local-worker'?'ai-runtime/nova-local-worker.js':'assets/[name]-[hash].js'}}},
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
