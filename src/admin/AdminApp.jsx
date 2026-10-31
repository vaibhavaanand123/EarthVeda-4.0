import {
  Bell,
  BookOpen,
  Box,
  LogOut,
  Mail,
  MessageSquare,
  Package,
  RotateCcw,
  Settings,
  ShoppingCart,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { adminApi } from './adminApi';
import { AdminContext } from './AdminContext';
import Account from './pages/Account';
import Inventory from './pages/Inventory';
import Jobs from './pages/Jobs';
import Content from './pages/Content';
import Login from './pages/Login';
import Notifications from './pages/Notifications';
import OrderDetail from './pages/OrderDetail';
import Orders from './pages/Orders';
import ProductForm from './pages/ProductForm';
import Products from './pages/Products';
import SettingsPage from './pages/Settings';
import Subscribers from './pages/Subscribers';
import Team from './pages/Team';
import Withdrawals from './pages/Withdrawals';
import { formatEuro } from './ui';
import './admin.css';

const FEED_MS = 30_000;

/** Short two-tone chime via Web Audio (no asset needed). */
function chime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.32);
    });
  } catch {
    /* audio blocked until the user interacts; the popup still shows */
  }
}

/** Polls for newly paid orders and raises an in-app popup, a sound and a desktop notification. */
function useNewOrderAlerts(enabled) {
  const [alerts, setAlerts] = useState([]);
  const since = useRef(new Date().toISOString());
  const navigate = useNavigate();

  useEffect(() => {
    if (!enabled) return undefined;
    let stopped = false;
    const check = async () => {
      if (document.hidden) return;
      try {
        const { orders, now } = await adminApi.feed(since.current);
        since.current = now;
        if (stopped || !orders.length) return;
        setAlerts((a) => [...orders, ...a].slice(0, 5));
        chime();
        if ('Notification' in window && Notification.permission === 'granted')
          orders.forEach((o) => {
            const n = new Notification(`New order ${o.orderNumber}`, {
              body: `${o.name} · ${formatEuro(o.total)} · ${o.country}`,
              tag: o.orderNumber,
            });
            n.onclick = () => {
              window.focus();
              navigate(`/admin/orders/${o.orderNumber}`);
            };
          });
      } catch {
        /* offline or logged out: try again next tick */
      }
    };
    const id = setInterval(check, FEED_MS);
    document.addEventListener('visibilitychange', check);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, [enabled, navigate]);

  return { alerts, dismiss: (n) => setAlerts((a) => a.filter((x) => x.orderNumber !== n)) };
}

function Shell({ user, onLogout }) {
  const navigate = useNavigate();
  const { alerts, dismiss } = useNewOrderAlerts(!user.mfaRequired);
  const [notifyPerm, setNotifyPerm] = useState(() =>
    'Notification' in window ? Notification.permission : 'unsupported',
  );
  const owner = user.role === 'owner';
  const links = [
    { to: 'orders', icon: ShoppingCart, label: 'Orders' },
    { to: 'products', icon: Package, label: 'Products' },
    { to: 'inventory', icon: Package, label: 'Inventory' },
    { to: 'content', icon: BookOpen, label: 'Story' },
    { to: 'subscribers', icon: Mail, label: 'Newsletter' },
    { to: 'withdrawals', icon: RotateCcw, label: 'Withdrawals' },
    { to: 'notifications', icon: MessageSquare, label: 'Messages' },
    ...(owner
      ? [
          { to: 'jobs', icon: RotateCcw, label: 'Refund jobs' },
          { to: 'settings', icon: Settings, label: 'Settings' },
          { to: 'team', icon: Users, label: 'Team' },
        ]
      : []),
  ];
  return (
    <div className="adm">
      <aside className="adm__side">
        <a className="adm__brand" href="/" target="_blank" rel="noopener noreferrer">
          <Box size={20} aria-hidden="true" /> earthveda <small>admin</small>
        </a>
        <nav aria-label="Admin">
          {(user.mfaRequired ? [] : links).map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={`/admin/${to}`}>
              <Icon size={18} aria-hidden="true" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="adm__me">
          {notifyPerm === 'default' && (
            <button
              type="button"
              className="adm-btn adm-btn--ghost"
              onClick={() => Notification.requestPermission().then(setNotifyPerm)}
            >
              <Bell size={16} aria-hidden="true" /> Enable order alerts
            </button>
          )}
          <NavLink to="/admin/account" className="adm__user">
            {user.name}
            <small>{user.email}</small>
          </NavLink>
          <button type="button" className="adm-btn adm-btn--ghost" onClick={onLogout}>
            <LogOut size={16} aria-hidden="true" /> Sign out
          </button>
        </div>
      </aside>
      <main className="adm__main">
        {user.mfaRequired ? (
          <Account />
        ) : (
          <Routes>
            <Route index element={<Navigate to="orders" replace />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/:orderNumber" element={<OrderDetail />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="jobs" element={owner ? <Jobs /> : <Navigate to="/admin" />} />
            <Route path="products" element={<Products />} />
            <Route path="products/new" element={<ProductForm />} />
            <Route path="products/:id" element={<ProductForm />} />
            <Route path="content" element={<Content />} />
            <Route path="subscribers" element={<Subscribers />} />
            <Route path="withdrawals" element={<Withdrawals />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings" element={owner ? <SettingsPage /> : <Navigate to="/admin" />} />
            <Route path="team" element={owner ? <Team /> : <Navigate to="/admin" />} />
            <Route path="account" element={<Account />} />
            <Route path="*" element={<Navigate to="/admin/orders" replace />} />
          </Routes>
        )}
      </main>
      <div className="adm-alerts" role="status" aria-live="assertive">
        {alerts.map((o) => (
          <div key={o.orderNumber} className="adm-alert">
            <Bell size={18} aria-hidden="true" />
            <button
              type="button"
              onClick={() => {
                dismiss(o.orderNumber);
                navigate(`/admin/orders/${o.orderNumber}`);
              }}
            >
              <strong>New paid order {o.orderNumber}</strong>
              <span>
                {o.name} · {formatEuro(o.total)} · {o.country}
              </span>
            </button>
            <button
              type="button"
              className="adm-alert__x"
              onClick={() => dismiss(o.orderNumber)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminApp() {
  const [state, setState] = useState({ loading: true, user: null });

  useEffect(() => {
    document.documentElement.lang = 'en';
    document.title = 'Earthveda Admin';
    adminApi
      .me()
      .then(({ user }) => setState({ loading: false, user }))
      .catch(() => setState({ loading: false, user: null }));
  }, []);

  const onLogout = useCallback(async () => {
    await adminApi.logout().catch(() => {});
    setState({ loading: false, user: null });
  }, []);

  const onUnauthorized = useCallback(() => setState({ loading: false, user: null }), []);

  if (state.loading) return <div className="adm-loading">Loading…</div>;
  if (!state.user) return <Login onLogin={(user) => setState({ loading: false, user })} />;
  return (
    <AdminContext.Provider value={{ user: state.user, onUnauthorized }}>
      <Shell user={state.user} onLogout={onLogout} />
    </AdminContext.Provider>
  );
}
