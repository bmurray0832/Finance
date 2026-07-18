import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // In dev, forward API calls to the backend running on :3000 (npm run dev:server).
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
