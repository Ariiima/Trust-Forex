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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
