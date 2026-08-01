import { BrowserRouter, Routes, Route, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { NavigationTab } from './design-system/components'
import Home from './screens/home/Home'
import ChoosePlan from './screens/plans/ChoosePlan'
import Checkout from './screens/plans/Checkout'
import PaymentCurrency from './screens/payment/PaymentCurrency'
import PaymentNetwork from './screens/payment/PaymentNetwork'
import PaymentReceive from './screens/payment/PaymentReceive'
import Cashback from './screens/cashback/Cashback'
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

function HomeRoute() {
  const nav = useNavigate()
  return (
    <Home
      onNavigate={(route) => {
        if (route === 'plans') nav('/plans')
        else if (route === 'checkout') nav('/checkout')
        else if (route === 'vip-channel') nav('/checkout')
      }}
      onTabChange={(tab) => TAB_ROUTES[tab] && nav(TAB_ROUTES[tab])}
    />
  )
}

function CashbackRoute() {
  const nav = useNavigate()
  return (
    <Cashback
      onNavigate={(tab) => TAB_ROUTES[tab] && nav(TAB_ROUTES[tab])}
      onOpenBroker={(brokerId) => nav(`/cashback/broker/${brokerId}`)}
      onCashbackHistory={() => nav('/cashback/history')}
      onUpgradePlan={() => nav('/plans')}
      onStartEarning={() => nav('/cashback/broker/xm')}
    />
  )
}

function BrokerRoute() {
  const nav = useNavigate()
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
  const nav = useNavigate()
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
  const nav = useNavigate()
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
  const nav = useNavigate()
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
  const nav = useNavigate()
  const [q] = useSearchParams()
  const sheet = q.get('sheet')
  return (
    <WithdrawAmount
      initialAmount={q.get('amount') ?? undefined}
      initialWallet={q.get('wallet') ?? undefined}
      initialSheet={sheet === 'change' || sheet === 'summary' || sheet === 'submitted' ? sheet : undefined}
      onBack={() => nav(-1)}
    />
  )
}

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AppRoutes />
    </BrowserRouter>
  )
}

function AppRoutes() {
  const nav = useNavigate()
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/plans" element={<ChoosePlan onBack={() => nav(-1)} onContinue={() => nav('/checkout')} />} />
      <Route path="/checkout" element={<Checkout onBack={() => nav(-1)} onReviewOrder={() => nav('/payment/currency')} />} />
      <Route path="/payment/currency" element={<PaymentCurrency onBack={() => nav(-1)} onContinue={() => nav('/payment/network')} />} />
      <Route
        path="/payment/network"
        element={<PaymentNetwork onBack={() => nav(-1)} onCurrencyChange={() => nav('/payment/currency')} onContinue={() => nav('/payment/receive')} />}
      />
      <Route path="/payment/receive" element={<PaymentReceive onBack={() => nav(-1)} onDone={() => nav('/')} />} />
      <Route path="/splash" element={<Splash />} />
      <Route path="/loading" element={<HomeSkeleton />} />
      <Route path="/referral" element={<ReferralRouteQ />} />
      <Route path="/earning" element={<EarningRouteQ />} />
      <Route path="/earning/withdraw" element={<WithdrawCurrencyQ />} />
      <Route path="/earning/withdraw/amount" element={<WithdrawAmountQ />} />
      <Route path="/cashback" element={<CashbackRoute />} />
      <Route path="/cashback/history" element={<CashbackHistory onBack={() => nav(-1)} />} />
      <Route path="/cashback/broker/:brokerId" element={<BrokerRoute />} />
    </Routes>
  )
}

export default App
