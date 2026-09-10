interface Window {
  Telegram?: {
    WebApp?: {
      ready: () => void
      expand: () => void
      setBackgroundColor: (color: string) => void
      setHeaderColor: (color: string) => void
      setBottomBarColor: (color: string) => void
      initData: string
      /** `user.allows_write_to_pm` — signed by Telegram: false until the user
       *  has started the bot or granted write access, so it is the one honest
       *  "can we DM them?" signal the client has. */
      initDataUnsafe: { user?: { id: number; allows_write_to_pm?: boolean }; [k: string]: unknown }
      colorScheme: 'light' | 'dark'
      BackButton: { show: () => void; hide: () => void; onClick: (cb: () => void) => void; offClick: (cb: () => void) => void }
      MainButton: { show: () => void; hide: () => void; setText: (t: string) => void; onClick: (cb: () => void) => void; offClick: (cb: () => void) => void }
      /** Bot API 6.9+ — Telegram's own "Allow <bot> to message you?" prompt.
       *  Granting it is what /start does for DMs, without leaving the app. */
      requestWriteAccess?: (cb?: (granted: boolean) => void) => void
      /** Bot API 6.1+ — opens a t.me link inside Telegram instead of a browser. */
      openTelegramLink?: (url: string) => void
      /** Bot API 6.1+ — opens an external https link outside the webview. */
      openLink?: (url: string) => void
      /** Bot API 7.7+ — keeps a vertical drag from minimising the Mini App. */
      disableVerticalSwipes?: () => void
      enableVerticalSwipes?: () => void
      /** Bot API 6.1+. Absent on older WebViews and on the web preview, so every
       *  member is optional — see haptic() in design-system/useCountUp.ts. */
      HapticFeedback?: {
        impactOccurred?: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
        notificationOccurred?: (type: 'error' | 'success' | 'warning') => void
        selectionChanged?: () => void
      }
    }
  }
}
