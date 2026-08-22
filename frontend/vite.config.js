import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.VITE_API_PORT || 5000}`,
        changeOrigin: true,
      },
      // Uploaded charts are served by the API, not by this dev server. Without
      // this every <img src="/uploads/..."> asks Vite for a file it has never
      // heard of and renders broken.
      '/uploads': {
        target: `http://localhost:${process.env.VITE_API_PORT || 5000}`,
        changeOrigin: true,
      }
    }
  }
})

