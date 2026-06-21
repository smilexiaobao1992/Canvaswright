import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { canvasMiddleware } from './src/server/canvasMiddleware.js'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'canvaswright-api',
      configureServer(server) {
        server.middlewares.use(canvasMiddleware())
      }
    }
  ]
})
