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
    }
  }
}
