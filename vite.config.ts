import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // process.env alone won't see .env values here — vite.config.ts runs before
  // its own env loading. loadEnv reads .env the same way `npm run dev` does.
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    // GitHub Pages serves the app from /<repo>/, so the asset base has to match.
    // Set VITE_BASE at build time; dev and any root-hosted deploy keep '/'.
    base: env.VITE_BASE ?? '/',
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
        // TF_API_TARGET overrides the local server for pointing dev at prod
        // (e.g. https://app.trustforex.net). Defaults to the local server.
        '/api': {
          target: env.TF_API_TARGET || `http://localhost:${env.TF_PORT ?? 8787}`,
          changeOrigin: true,
        },
      },
    },
    // The Mini App is served to Telegram through a tunnel, so the Host header is
    // never localhost. Preview is a local-only server; accepting any host is safe.
    preview: {
      allowedHosts: true,
    },
  }
})
