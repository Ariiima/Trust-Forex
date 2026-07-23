import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom'
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

// Tabs without designed screens (referral, earning) stay put for now.
const TAB_ROUTES: Partial<Record<NavigationTab, string>> = {
  home: '/',
  cashback: '/cashback',
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
  return <BrokerDetail brokerId={brokerId} onBack={() => nav(-1)} />
}

function App() {
  return (
    <BrowserRouter>
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
        element={<PaymentNetwork onBack={() => nav(-1)} onChangeCurrency={() => nav('/payment/currency')} onContinue={() => nav('/payment/receive')} />}
      />
      <Route path="/payment/receive" element={<PaymentReceive onBack={() => nav(-1)} onDone={() => nav('/')} />} />
      <Route path="/cashback" element={<CashbackRoute />} />
      <Route path="/cashback/history" element={<CashbackHistory onBack={() => nav(-1)} />} />
      <Route path="/cashback/broker/:brokerId" element={<BrokerRoute />} />
    </Routes>
  )
}

export default App
