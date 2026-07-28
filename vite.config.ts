import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves the app from /<repo>/, so the asset base has to match.
  // Set VITE_BASE at build time; dev and any root-hosted deploy keep '/'.
  base: process.env.VITE_BASE ?? '/',
  server: {
    proxy: {
      '/api': `http://localhost:${process.env.TF_PORT ?? 8787}`,
    },
  },
  // The Mini App is served to Telegram through a tunnel, so the Host header is
  // never localhost. Preview is a local-only server; accepting any host is safe.
  preview: {
    allowedHosts: true,
  },
})
