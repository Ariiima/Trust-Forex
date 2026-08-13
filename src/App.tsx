import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { BrowserRouter, Routes, Route, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, m, useReducedMotion } from 'motion/react'
import { Notification, preloadEmoji } from './design-system/components'
import type { NavigationTab } from './design-system/components'
import cashbackEmoji from './assets/emoji/cashback.json?url'
import homeExpiredEmoji from './assets/emoji/home-expired.json?url'
import homeEmoji from './assets/emoji/home.json?url'
import referralEmoji from './assets/emoji/referral.json?url'
import { ApiError, cachedGateways, createOrder, getFlags, getGateways, getMe, getPromos, getSignals, selectGateway } from './api/client'
import type { Gateway } from './api/client'
import Home from './screens/home/Home'
import ChoosePlan from './screens/plans/ChoosePlan'
import Checkout from './screens/plans/Checkout'
import PaymentCurrency from './screens/payment/PaymentCurrency'
import PaymentNetwork from './screens/payment/PaymentNetwork'
import PaymentReceive from './screens/payment/PaymentReceive'
import CashbackRoute from './screens/cashback/CashbackRoute'
import CashbackHistory from './screens/cashback/CashbackHistory'
import BrokerDetail from './screens/broker/BrokerDetail'
import ReferralRoute from './screens/referral/ReferralRoute'
import EarningMain from './screens/earning/EarningMain'
import WithdrawCurrency from './screens/earning/WithdrawCurrency'
import WithdrawAmount from './screens/earning/WithdrawAmount'
import Splash from './screens/splash/Splash'
import HomeSkeleton from './screens/home/HomeSkeleton'

const TAB_ROUTES: Partial<Record<NavigationTab, string>> = {
  home: '/',
  cashback: '/cashback',
  referral: '/referral',
  earning: '/earning',
}
const TAB_PATHS = new Set(Object.values(TAB_ROUTES))

/* Every step of a flow slides: forward in from the right, back out to the
   right. The browser's own view transition does the overlap off a snapshot, so
   the two screens never both live in the DOM — which is what rules out an
   AnimatePresence page stack here: overlapping real pages needs absolute
   positioning, and #root being the scroller plus the sticky CTAs need normal
   flow. Keyframes live in index.css.
   Not for tab switches — those are four peers, not a sequence — and not under
   reduced motion or in browsers without the API, which cut like before. */
function useSlideNav() {
  const nav = useNavigate()
  const still = useReducedMotion()
  return useCallback(
    (to: string | number) => {
      const go = () => (typeof to === 'number' ? nav(to) : nav(to))
      if (still || !document.startViewTransition) return go()
      if (typeof to === 'string' && TAB_PATHS.has(to.split('?')[0])) return go()
      document.documentElement.dataset.nav = to === -1 ? 'back' : 'fwd'
      document.startViewTransition(() => flushSync(go))
    },
    [nav, still],
  )
}

function HomeRoute() {
  const nav = useSlideNav()
  return (
    <Home
      /* `checkout?plan=gold` — the picked plan rides along so checkout doesn't
         fall back to its silver default. */
      onNavigate={(route) => {
        if (route === 'plans') nav('/plans')
        else if (route.startsWith('checkout')) nav(`/${route}`)
      }}
      onTabChange={(tab) => TAB_ROUTES[tab] && nav(TAB_ROUTES[tab])}
    />
  )
}

function CheckoutRoute() {
  const nav = useSlideNav()
  const [q] = useSearchParams()
  const creating = useRef(false)
  const [failed, setFailed] = useState(false)
  return (
    <>
      <Checkout
        initialPlan={(q.get('plan') as never) ?? undefined}
        onBack={() => nav(-1)}
        onReviewOrder={({ planId, total, code, useBalance }) => {
          if (creating.current) return
          creating.current = true
          // amountUsd is display-only — the server prices from planId + code,
          // and works out for itself how much balance it can apply.
          createOrder({ planId, billing: 'monthly', amountUsd: total, code, useBalance })
            /* Straight to the receive screen when there is nothing left to pick:
               an order with an address is a resumed partial payment, and one the
               earning balance paid off outright is already confirmed — that
               screen opens its own "payment confirmed" sheet for it. */
            .then((o) =>
              nav(
                o.address || o.status === 'confirmed'
                  ? `/payment/receive?order=${o.id}`
                  : `/payment/currency?order=${o.id}`,
              ),
            )
            .catch(() => {
              creating.current = false
              setFailed(true)
            })
        }}
      />
      {failed ? (
        <div className="app-toast">
          <Notification
            variant="error"
            title="Could not create the order"
            description="Check your connection and try again."
            autoDismiss={4000}
            onClose={() => setFailed(false)}
          />
        </div>
      ) : null}
    </>
  )
}

/** One fetch of the live payment options, shared by the two picker routes.
 *  `undefined` while loading; `[]` when the API is unreachable or empty. */
function useGateways(enabled: boolean): Gateway[] | undefined {
  const [gateways, setGateways] = useState<Gateway[] | undefined>(cachedGateways)
  useEffect(() => {
    if (!enabled) return
    getGateways()
      .then(setGateways)
      .catch(() => setGateways([]))
  }, [enabled])
  return gateways
}

function PaymentCurrencyRoute() {
  const nav = useSlideNav()
  const [q] = useSearchParams()
  const orderId = q.get('order')
  const gateways = useGateways(orderId != null)
  // Live flow waits for the option list; the bare route is the demo render.
  if (orderId && !gateways) return <div className="scr-route-hold" />
  return (
    <PaymentCurrency
      gateways={orderId ? gateways : undefined}
      onBack={() => nav(-1)}
      onContinue={(currencyId) =>
        nav(orderId ? `/payment/network?order=${orderId}&currency=${currencyId}` : '/payment/network')
      }
    />
  )
}

function PaymentNetworkRoute() {
  const nav = useSlideNav()
  const [q, setQ] = useSearchParams()
  const orderId = q.get('order')
  const gateways = useGateways(orderId != null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (orderId && !gateways) return <div className="scr-route-hold" />
  return (
    <PaymentNetwork
      gateways={orderId ? gateways : undefined}
      initialCurrencyId={q.get('currency') ?? undefined}
      busy={busy}
      error={error}
      onBack={() => nav(-1)}
      /* Keep the URL honest so a webview refresh reopens on the right currency.
         The component owns the selection state (see route comment below). */
      onCurrencyChange={(c) => {
        if (!orderId) return
        setQ(
          (prev) => {
            prev.set('currency', c)
            return prev
          },
          { replace: true },
        )
      }}
      onContinue={(networkId, currencyId) => {
        if (!orderId) return nav('/payment/receive')
        setBusy(true)
        setError('')
        selectGateway(orderId, { currency: currencyId, network: networkId })
          .then(() => nav(`/payment/receive?order=${orderId}`))
          .catch((e) => {
            setBusy(false)
            setError(
              e instanceof ApiError && e.body.includes('rate_unavailable')
                ? 'Live price is unavailable right now — try again in a minute.'
                : 'Could not prepare the payment. Please try again.',
            )
          })
      }}
    />
  )
}

function PaymentReceiveRoute() {
  const nav = useSlideNav()
  const [q] = useSearchParams()
  return (
    <PaymentReceive
      orderId={q.get('order') ?? undefined}
      onBack={() => nav(-1)}
      onDone={() => nav('/')}
      onExpired={() => nav('/checkout')}
    />
  )
}

function CashbackRouteQ() {
  const nav = useSlideNav()
  const [q] = useSearchParams()
  return (
    <CashbackRoute
      force={(q.get('state') as 'preview' | 'main' | null) ?? undefined}
      /* history is a sheet over the dashboard, not a route — see Cashback.tsx */
      initialSheet={(q.get('sheet') as 'about' | 'history' | null) ?? undefined}
      onNavigate={(tab) => TAB_ROUTES[tab] && nav(TAB_ROUTES[tab])}
      onOpenBroker={(brokerId) => nav(`/cashback/broker/${brokerId}`)}
      onUpgradePlan={() => nav('/plans')}
    />
  )
}

function BrokerRoute() {
  const nav = useSlideNav()
  const { brokerId } = useParams()
  const [q] = useSearchParams()
  return (
    <BrokerDetail
      brokerId={brokerId}
      onBack={() => nav(-1)}
      initialAccountStatus={(q.get('account') as never) ?? undefined}
      initialDepositStatus={(q.get('deposit') as never) ?? undefined}
    />
  )
}

/* ---------------------------------------------------------------------------
 * Query-param wrappers. They exist so design/review/index.html can deep-link
 * every designed state (sheets, prefilled forms, empty lists) side by side with
 * its Figma frame. Harmless in normal use — no param means default state.
 * ------------------------------------------------------------------------- */
function ReferralRouteQ() {
  const nav = useSlideNav()
  const [q] = useSearchParams()
  return (
    <ReferralRoute
      force={(q.get('state') as 'preview' | 'main' | 'empty' | null) ?? undefined}
      initialSheet={q.get('sheet') === 'about' ? 'about' : undefined}
      onNavigate={(tab) => TAB_ROUTES[tab] && nav(TAB_ROUTES[tab])}
    />
  )
}

function EarningRouteQ() {
  const nav = useSlideNav()
  const [q] = useSearchParams()
  return (
    <EarningMain
      initialSheet={q.get('sheet') === 'history' ? 'history' : undefined}
      onNavigate={(tab) => TAB_ROUTES[tab] && nav(TAB_ROUTES[tab])}
      onWithdraw={() => nav('/earning/withdraw')}
    />
  )
}

function WithdrawCurrencyQ() {
  const nav = useSlideNav()
  const [q] = useSearchParams()
  return (
    <WithdrawCurrency
      initialSelected={q.get('selected') ?? undefined}
      onBack={() => nav(-1)}
      onContinue={() => nav('/earning/withdraw/amount')}
    />
  )
}

function WithdrawAmountQ() {
  const nav = useSlideNav()
  const [q] = useSearchParams()
  const sheet = q.get('sheet')
  return (
    <WithdrawAmount
      initialAmount={q.get('amount') ?? undefined}
      initialWallet={q.get('wallet') ?? undefined}
      initialSheet={sheet === 'change' || sheet === 'summary' || sheet === 'submitted' ? sheet : undefined}
      /* Not nav(-1): the withdraw flow is two screens deep by now, so going
         back one lands on the amount step again. This ends the flow. */
      onDone={() => nav('/earning')}
      onBack={() => nav(-1)}
    />
  )
}

/* Typing gets the screen to itself: the on-screen keyboard takes the bottom
   half, and the nav bar and sticky CTAs that live down there end up sandwiched
   against it, covering the field being filled in. `is-typing` on <body> is what
   index.css hides them by.

   focusin/focusout rather than visualViewport geometry: an editable element
   holding focus IS the "keyboard is up" signal, and it needs no threshold to
   guess at. A hardware keyboard hides the bar too, which costs nothing.

   Telegram's in-app keyboard can dismiss (swipe-down / system "done") without
   blurring the field, so focusout never fires and the bar stays hidden until
   a stray tap elsewhere. visualViewport resize is the fallback signal for
   "keyboard closed while still focused": once it's back to full height, drop
   the class even if focus never left. */
function useTypingClass(): void {
  useEffect(() => {
    const editable = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    const on = (e: FocusEvent) => editable(e.target) && document.body.classList.add('is-typing');
    // Guard on the incoming element too: moving between two fields fires
    // focusout before focusin, which would flicker the bar back for a frame.
    const off = (e: FocusEvent) =>
      !editable(e.relatedTarget) && document.body.classList.remove('is-typing');
    document.addEventListener('focusin', on);
    document.addEventListener('focusout', off);

    const vv = window.visualViewport;
    // Baseline captured once, at mount — Telegram's WebView resizes
    // window.innerHeight along with the keyboard too, so comparing against
    // *live* innerHeight never shows a diff and this never fires.
    const fullHeight = vv?.height ?? window.innerHeight;
    const onResize = () => {
      if (!vv) return;
      const shrunk = fullHeight - vv.height > 100;
      document.body.classList.toggle('is-typing', shrunk && editable(document.activeElement));
    };
    vv?.addEventListener('resize', onResize);

    return () => {
      document.removeEventListener('focusin', on);
      document.removeEventListener('focusout', off);
      vv?.removeEventListener('resize', onResize);
      document.body.classList.remove('is-typing');
    };
  }, []);
}

function App() {
  useTypingClass()
  return (
    /* reducedMotion="user" is more than an accessibility courtesy here: the
       screenshot harness (design/review/shoot.mjs) captures with
       reducedMotion:'reduce', so this is what keeps the Figma pixel diff
       deterministic. Anything animated must degrade through this switch. */
    <MotionConfig reducedMotion="user">
      {/* Nothing here drags or does layout projection, so the app only needs
          motion's animation feature set — `strict` makes the build fail loudly
          if a `motion.*` component (which would pull in everything) sneaks in. */}
      <LazyMotion features={domAnimation} strict>
        <Boot>
          <BrowserRouter basename={import.meta.env.BASE_URL}>
            <AppRoutes />
          </BrowserRouter>
        </Boot>
      </LazyMotion>
    </MotionConfig>
  )
}

/* Boot splash. The screens mount when it ends, not underneath it: an entrance
   animation that plays behind the splash is an animation nobody sees, and home
   was arriving with its ring already swept and its carousel already advanced.
   What mounting underneath used to buy — a warm cache — the prefetch below buys
   instead, so the first screen still renders from memory. The splash fades out
   over the freshly mounted screen, so its entrance runs into view.
   Skipped entirely under reduced motion: it is a timed animation with nothing
   behind it, and the capture harness (reducedMotion:'reduce') has to land on
   the real screen. */
/* The splash lasts as long as booting actually takes, floored and capped:
     floor — under this it is a flash, and the copy never gets read.
     cap   — a dead network must not trap anyone on the splash forever. The app
             opens on whatever did arrive; the screens handle their own misses. */
const BOOT_MIN_MS = 2000
const BOOT_MAX_MS = 10000

/* Every image the app ships — broker logos, crypto marks, plan and home art,
   icons — decoded before the splash lifts, so no screen after it pops in half
   drawn. A glob, not a list of imports: an asset added to src/assets is covered
   without anyone remembering to add it here. ~700KB of PNG/SVG in total, and
   the whole app is four tabs deep, so there is no point being selective. */
const ASSET_URLS = Object.values(
  import.meta.glob('./assets/**/*.{png,jpg,jpeg,svg,webp}', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
) as string[]

/* Resolves on error too: a missing image must not hold the splash to its cap.
   decode() over onload — onload fires with the bytes in, but the first paint
   still costs a decode, which is the pop this is meant to remove. */
function preloadImage(url: string): Promise<void> {
  const img = new Image()
  img.src = url
  return img.decode().catch(() => {})
}

function Boot({ children }: { children: ReactNode }) {
  const still = useReducedMotion()
  const [done, setDone] = useState(false)
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    let live = true
    const jobs = [
      // What home reads. Everything else is a tab away, i.e. its own fetch.
      getMe(),
      getSignals(),
      getPromos('subscription'),
      // Same list for everyone, so warming it here means the payment flow's
      // `scr-route-hold` blank frame never has to show mid-transition.
      getGateways(),
      // Same reason: cashback/referral read this via cachedFlags() to decide
      // preview-vs-main synchronously. Unwarmed, the first tap into either
      // tab this session hits their `scr-route-hold` frame for a full
      // round trip — near-white (#F1F1F1), so it reads as a blank flash.
      getFlags(),
      /* Every animated emoji in the app, parsed into memory while the splash is
         up: ~280KB of Lottie JSON, paid for here once, after which the screens
         that use them mount instantly instead of each showing a skeleton. */
      preloadEmoji([homeEmoji, homeExpiredEmoji, cashbackEmoji, referralEmoji]),
      /* The document's own load: bundle, CSS, fonts, the splash artwork. Fires
         late here — the splash is already on screen by the time this mounts —
         so check readyState first or the event is missed and never resolves. */
      document.readyState === 'complete'
        ? Promise.resolve()
        : new Promise<void>((r) => window.addEventListener('load', () => r(), { once: true })),
      // Sora, both subsets. Without this the first screen after the splash can
      // still reflow as the webfont swaps in over the fallback.
      document.fonts.ready,
      ...ASSET_URLS.map(preloadImage),
    ]
    // The bar reports the real thing: one job settled = one step of the bar.
    // Rejections count as settled — a failed fetch is still a finished wait.
    let settled = 0
    const step = () => live && setProgress(++settled / jobs.length)
    for (const job of jobs) Promise.resolve(job).then(step, step)

    const after = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
    void Promise.all([
      after(BOOT_MIN_MS),
      Promise.race([Promise.allSettled(jobs), after(BOOT_MAX_MS)]),
    ]).then(() => live && setDone(true))
    return () => {
      live = false
    }
  }, [])
  if (still) return <>{children}</>
  return (
    <>
      {done && children}
      <AnimatePresence>
        {done ? null : (
          <m.div className="scr-splash-boot" exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
            <Splash progress={progress} />
          </m.div>
        )}
      </AnimatePresence>
    </>
  )
}

/* The screen swap itself is animated by useSlideNav, not from here: react-router
   commits both pages in one go, so anything done at this level would only fade
   the incoming page up from the background. */
function AppRoutes() {
  const nav = useSlideNav()
  /* Every route opens at its own top. #root is the scroller (index.css) and it
     outlives the route swap, so a broker page opened from halfway down the
     cashback list used to inherit that offset and start mid-page. Layout effect,
     not effect: reset before the browser paints the new screen. */
  const { pathname } = useLocation()
  useLayoutEffect(() => {
    document.getElementById('root')?.scrollTo(0, 0)
  }, [pathname])
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/plans" element={<ChoosePlan onBack={() => nav(-1)} onContinue={(planId) => nav(`/checkout?plan=${planId}`)} />} />
      <Route path="/checkout" element={<CheckoutRoute />} />
      <Route path="/payment/currency" element={<PaymentCurrencyRoute />} />
      <Route
        path="/payment/network"
        /* onCurrencyChange only syncs the URL: the sheet already commits the
           new currency into this step (PaymentNetwork.handleChoose), so
           navigation stays put — the user is never thrown back a step. */
        element={<PaymentNetworkRoute />}
      />
      <Route path="/payment/receive" element={<PaymentReceiveRoute />} />
      <Route path="/splash" element={<Splash />} />
      <Route path="/loading" element={<HomeSkeleton />} />
      <Route path="/referral" element={<ReferralRouteQ />} />
      <Route path="/earning" element={<EarningRouteQ />} />
      <Route path="/earning/withdraw" element={<WithdrawCurrencyQ />} />
      <Route path="/earning/withdraw/amount" element={<WithdrawAmountQ />} />
      <Route path="/cashback" element={<CashbackRouteQ />} />
      <Route path="/cashback/history" element={<CashbackHistory onBack={() => nav(-1)} />} />
      <Route path="/cashback/broker/:brokerId" element={<BrokerRoute />} />
    </Routes>
  )
}

export default App
