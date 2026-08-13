import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves the app from /<repo>/, so the asset base has to match.
  // Set VITE_BASE at build time; dev and any root-hosted deploy keep '/'.
  base: process.env.VITE_BASE ?? '/',
  // Two entries: the Telegram Mini App and the admin dashboard. Separate pages
  // rather than a route inside the app, so Telegram users never download the
  // admin bundle (recharts alone is bigger than the whole Mini App).
  build: {
    rollupOptions: {
      input: {
        index: new URL('./index.html', import.meta.url).pathname,
        admin: new URL('./admin.html', import.meta.url).pathname,
      },
    },
  },
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
