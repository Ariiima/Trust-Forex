import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './design-system/tokens.css'
import './index.css'
import App from './App.tsx'

const tg = window.Telegram?.WebApp
tg?.ready()
tg?.expand()
// Pin light surfaces so Telegram's dark theme never paints gray around the app.
tg?.setBackgroundColor?.('#f1f1f1')
tg?.setHeaderColor?.('#ffffff')
tg?.setBottomBarColor?.('#ffffff')
/* Stop Telegram treating a vertical drag as "minimise the app". Without it a
   swipe near the top of a page drags the whole Mini App sheet down and springs
   it back, which reads as the page bouncing. Bot API 7.7+, hence the guard —
   the CSS overscroll-behavior in index.css covers the WebView's own rubber-band
   on older clients. */
tg?.disableVerticalSwipes?.()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
// Retires the pre-boot blue in index.html — see the comment there.
document.body.classList.add('booted')

/* Telegram keeps a mini app's WebView warm and reuses it across opens, so a
   colleague can reopen the app and still be looking at yesterday's bundle no
   matter what Cache-Control says — the page was never re-requested at all.
   Every time the tab/mini-app comes back into view, re-fetch index.html
   (no-store, so this one request is never served from any cache) and compare
   its hashed bundle name to the one this document loaded; a mismatch means a
   deploy landed underneath us, so force a real reload. */
const bootedBundle = document.querySelector<HTMLScriptElement>('script[src*="/assets/index-"]')?.src ?? ''
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !bootedBundle) return
  fetch(location.pathname, { cache: 'no-store' })
    .then((r) => r.text())
    .then((html) => {
      const latest = html.match(/\/assets\/index-[\w-]+\.js/)?.[0]
      if (latest && !bootedBundle.includes(latest)) location.reload()
    })
    .catch(() => {}) // offline — next visibility flip retries
})
