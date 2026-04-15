import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  base: mode === 'development' ? '/' : '/interlock-web/',
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: "all"
  },
  preview: {
    host: true,
    allowedHosts: "all"
  }
}))