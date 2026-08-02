interface Window {
  Telegram?: {
    WebApp?: {
      ready: () => void
      expand: () => void
      setBackgroundColor: (color: string) => void
      setHeaderColor: (color: string) => void
      setBottomBarColor: (color: string) => void
      initData: string
      initDataUnsafe: Record<string, unknown>
      colorScheme: 'light' | 'dark'
      BackButton: { show: () => void; hide: () => void; onClick: (cb: () => void) => void; offClick: (cb: () => void) => void }
      MainButton: { show: () => void; hide: () => void; setText: (t: string) => void; onClick: (cb: () => void) => void; offClick: (cb: () => void) => void }
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
