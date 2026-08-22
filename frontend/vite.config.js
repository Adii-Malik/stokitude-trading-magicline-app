import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// loadEnv, not process.env: Vite reads .env files into import.meta.env for client
// code, but leaves process.env inside this file to the actual shell. Reading it
// here silently fell back to the default port, which only showed up on /uploads
// because VITE_API_URL is absolute and never touches the proxy.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const api = `http://localhost:${env.VITE_API_PORT || 5000}`

  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/api': { target: api, changeOrigin: true },
        // Uploaded charts are served by the API, not by this dev server.
        '/uploads': { target: api, changeOrigin: true }
      }
    }
  }
})
