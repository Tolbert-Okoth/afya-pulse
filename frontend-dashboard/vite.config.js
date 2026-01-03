import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // Keep this pointing to 4000 (Your Backend Port)
        target: 'http://127.0.0.1:4000', 
        changeOrigin: true,
        secure: false,
      }
    },
    headers: {
      // ⚠️ FIX: "unsafe-none" is the magic key. 
      // It tells the browser "Don't isolate me, let me talk to the popup!"
      "Cross-Origin-Opener-Policy": "unsafe-none",
      "Cross-Origin-Embedder-Policy": "unsafe-none"
    },
  },
})