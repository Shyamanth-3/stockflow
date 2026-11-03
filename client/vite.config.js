import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.join(import.meta.dirname, '../server'), '')

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': `http://localhost:${env.PORT || 3001}`,
      },
    },
  }
})
