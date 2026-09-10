/**
 * Admin shell + routes.
 *
 * HashRouter, not BrowserRouter: the dashboard is one static file served by
 * nginx, and hash routes need no server-side rewrite rule to survive a reload.
 */
import { useEffect, useState } from 'react';
import { HashRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api, setUnauthorizedHandler, type Alerts } from './data';
import { useAsync } from './useAsync';
import { Button, Icon, Sweep, type IconName } from './ui';
import { UserSearch } from './ui/UserSearch';
import Login from './sections/Login';
import UserDetail from './sections/UserDetail';
import Brokers from './sections/Brokers';
import BrokerManage from './sections/BrokerManage';
import Subscription from './sections/Subscription';
import Referral from './sections/Referral';
import Campaigns from './sections/Campaigns';
import Results from './sections/Results';
import MoneySection from './sections/Money';
import Messages from './sections/Messages';
import Analytics from './sections/Analytics';
import Wallets from './sections/Wallets';
import Settings from './sections/Settings';
import Notifications from './sections/Notifications';

/* `badge` reads the polled alert counts — a section only wears a number while
   something on it is waiting for a human. */
const NAV: { to: string; label: string; icon: IconName; badge?: (a: Alerts) => number }[] = [
  { to: '/notifications', label: 'Notifications', icon: 'bell',
    badge: (a) => a.reviews + a.withdrawals + a.unmatched + a.campaignBrokers },
  { to: '/brokers', label: 'Brokers', icon: 'briefcase', badge: (a) => a.reviews },
  { to: '/subscription', label: 'Subscription', icon: 'calendar' },
  { to: '/referral', label: 'Referral', icon: 'user-plus', badge: (a) => a.campaignBrokers },
  { to: '/campaigns', label: 'Campaigns', icon: 'megaphone' },
  { to: '/results', label: 'Results', icon: 'target' },
  { to: '/money', label: 'Money', icon: 'gift', badge: (a) => a.withdrawals + a.unmatched },
  { to: '/analytics', label: 'Analytics', icon: 'trending-up' },
  { to: '/wallets', label: 'Wallets', icon: 'wallet' },
  { to: '/messages', label: 'Bot Messages', icon: 'mail' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

function Sidebar({ username, onSignOut }: { username: string; onSignOut: () => void }) {
  // Polled, not pushed: a 30s round-trip of three COUNT(*)s is cheaper than a
  // socket, and nothing here is time-critical to the second.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  const alerts = useAsync(api.alerts, [tick]);

  return (
    <nav className="a-sidebar">
      <div className="a-sidebar__brand">
        <span className="a-sidebar__mark">TF</span>
        Trust Forex
      </div>
      {NAV.map((n) => {
        const count = alerts && n.badge ? n.badge(alerts) : 0;
        return (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) => `a-navitem${isActive ? ' a-navitem--active' : ''}`}
            title={n.label}
          >
            <Icon name={n.icon} size={18} />
            {n.label}
            {count > 0 && <span className="a-navitem__badge">{count}</span>}
          </NavLink>
        );
      })}
      <div className="a-sidebar__foot">
        <div className="a-navitem" style={{ fontWeight: 400, cursor: 'default' }}>
          <Icon name="user" size={18} />
          {username}
        </div>
        <Button variant="ghost" icon="external" onClick={onSignOut}><span>Sign out</span></Button>
      </div>
    </nav>
  );
}

export default function AdminApp() {
  // undefined = still checking the cookie, null = signed out.
  const [username, setUsername] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    // Any 401 anywhere in the app drops straight back to the login screen —
    // an expired session must not leave stale data on screen.
    setUnauthorizedHandler(() => setUsername(null));
    api.session().then((s) => setUsername(s.username)).catch(() => setUsername(null));
  }, []);

  if (username === undefined) return null;
  if (username === null) return <Login onSignedIn={setUsername} />;

  return (
    <HashRouter>
      <div className="a-shell">
        <Sidebar
          username={username}
          onSignOut={() => api.logout().finally(() => setUsername(null))}
        />
        <main className="a-main">
          {/* Fixed to the shell, not to a section: the same search is in the
              same corner of every page, and it lands on the account. */}
          <div className="a-topbar">
            <UserSearch />
          </div>
          <RoutedViews />
        </main>
      </div>
    </HashRouter>
  );
}

/* Keyed on the path so every section change replays the sweep. */
function RoutedViews() {
  const location = useLocation();
  return (
    <Sweep key={location.pathname}>
      <Routes location={location}>
        <Route path="/" element={<Navigate to="/brokers" replace />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/users/:id" element={<UserDetail />} />
        <Route path="/brokers" element={<Brokers />} />
        <Route path="/brokers/:brokerId" element={<BrokerManage />} />
        <Route path="/subscription" element={<Subscription />} />
        <Route path="/referral" element={<Referral />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/results" element={<Results />} />
        {/* The section was called Signals until it was named for what it holds. */}
        <Route path="/signals" element={<Navigate to="/results" replace />} />
        <Route path="/money" element={<MoneySection />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/wallets" element={<Wallets />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/brokers" replace />} />
      </Routes>
    </Sweep>
  );
}
