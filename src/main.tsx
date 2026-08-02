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
