import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Dashboard from './pages/Dashboard'
import Holdings from './pages/Holdings'
import Briefing from './pages/Briefing'
import FilingAlerts from './pages/FilingAlerts'
import ClientEmails from './pages/ClientEmails'
import Settings from './pages/Settings'
import Admin from './pages/Admin'
import Onboarding from './pages/Onboarding'
import Landing from './pages/Landing'
import SignIn from './pages/SignIn'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsOfService from './pages/TermsOfService'
import Disclaimer from './pages/Disclaimer'
import MarketBar from './components/MarketBar'
import { getAdvisorId, clearAdvisorId, api } from './api'

const NAV = [
  { to: '/',              end: true,  icon: '⬡', label: 'Dashboard'    },
  { to: '/holdings',      end: false, icon: '◈', label: 'Holdings'      },
  { to: '/briefing',      end: false, icon: '≋', label: 'Briefings'     },
  { to: '/filing-alerts', end: false, icon: '◎', label: 'Filing Alerts' },
  { to: '/client-emails', end: false, icon: '✦', label: 'Client Emails' },
  { to: '/settings',      end: false, icon: '⚙', label: 'Settings'      },
]

function AppLayout() {
  const location = useLocation()
  const [advisor, setAdvisor] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (getAdvisorId()) {
      api.getAdvisor().then(setAdvisor).catch(() => {})
    }
  }, [])

  // Handle checkout return
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('checkout') === 'success') {
      window.history.replaceState({}, '', '/')
      // Reload advisor data after short delay to let webhook process
      setTimeout(() => {
        api.getAdvisor().then(setAdvisor).catch(() => {})
      }, 2000)
    }
  }, [location.search])

  // Public routes — always accessible
  if (location.pathname === '/onboarding') {
    return <Routes><Route path="/onboarding" element={<Onboarding />} /></Routes>
  }
  if (location.pathname === '/signin') {
    return <Routes><Route path="/signin" element={<SignIn />} /></Routes>
  }
  if (location.pathname === '/verify-email') {
    return <Routes><Route path="/verify-email" element={<VerifyEmail />} /></Routes>
  }
  if (location.pathname === '/forgot-password') {
    return <Routes><Route path="/forgot-password" element={<ForgotPassword />} /></Routes>
  }
  if (location.pathname === '/reset-password') {
    return <Routes><Route path="/reset-password" element={<ResetPassword />} /></Routes>
  }
  if (location.pathname === '/privacy') {
    return <Routes><Route path="/privacy" element={<PrivacyPolicy />} /></Routes>
  }
  if (location.pathname === '/terms') {
    return <Routes><Route path="/terms" element={<TermsOfService />} /></Routes>
  }
  if (location.pathname === '/disclaimer') {
    return <Routes><Route path="/disclaimer" element={<Disclaimer />} /></Routes>
  }

  // Landing page for logged-out visitors
  if (!getAdvisorId()) {
    return (
      <Routes>
        <Route path="*" element={<Landing />} />
      </Routes>
    )
  }

  // Full app for logged-in advisors
  return (
    <div className="layout">
      {/* Mobile overlay — closes sidebar when tapping outside */}
      {sidebarOpen && (
        <div className="mobile-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`sidebar${sidebarOpen ? ' mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-logo">◆</div>
          <div className="brand-text">
            <div className="brand-name">RIA Intelligence</div>
            <div className="brand-sub">Morning Platform</div>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-label">Navigation</div>
          <nav>
            {NAV.map(({ to, end, icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="nav-icon">{icon}</span>
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div style={{ flex: 1 }} />

        {/* Admin console — only visible to the platform owner */}
        {advisor?.is_admin && (
          <div style={{ padding: '0 12px 8px' }}>
            <NavLink
              to="/admin"
              className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
              style={{ color: 'rgba(239,68,68,0.8)', borderRadius: 8 }}
            >
              <span className="nav-icon">⬡</span>
              Admin Console
            </NavLink>
          </div>
        )}

        {/* Subscription status */}
        {advisor && !advisor.is_legacy && (
          <div style={{ padding: '0 12px 12px' }}>
            {advisor.subscription_status === 'trialing' && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(79,124,246,0.12), rgba(6,182,212,0.08))',
                border: '1px solid rgba(79,124,246,0.25)',
                borderRadius: 10, padding: '10px 12px',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Free Trial
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>
                  {advisor.trial_days_remaining != null
                    ? `${advisor.trial_days_remaining} day${advisor.trial_days_remaining !== 1 ? 's' : ''} remaining`
                    : '14-day trial active'}
                </div>
                <button
                  onClick={async () => {
                    try { const { url } = await api.createPortal(advisor.id); window.location.href = url } catch (_) {}
                  }}
                  style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                >
                  Manage billing →
                </button>
              </div>
            )}
            {(advisor.subscription_status === 'past_due' || advisor.subscription_status === 'unpaid') && (
              <div style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 10, padding: '10px 12px',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)', marginBottom: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Payment Failed
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>
                  Update your payment method to keep access.
                </div>
                <button
                  onClick={async () => {
                    try { const { url } = await api.createPortal(advisor.id); window.location.href = url } catch (_) {}
                  }}
                  style={{ fontSize: 11, fontWeight: 600, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                >
                  Fix billing →
                </button>
              </div>
            )}
            {advisor.subscription_status === 'canceled' && (
              <div style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 10, padding: '10px 12px',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)', marginBottom: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Subscription Ended
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>
                  Resubscribe to regain full access.
                </div>
                <button
                  onClick={async () => {
                    try { const { url } = await api.createCheckout(advisor.id); window.location.href = url } catch (_) {}
                  }}
                  style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                >
                  Resubscribe →
                </button>
              </div>
            )}
          </div>
        )}

        <div className="sidebar-footer">
          <button
            onClick={() => { clearAdvisorId(); window.location.href = '/' }}
            style={{
              background: 'none', border: 'none',
              color: 'var(--text-2)', cursor: 'pointer',
              fontSize: 12, fontFamily: 'inherit',
              padding: 0,
            }}
          >
            ← Switch account
          </button>
        </div>
      </aside>

      <main className="main-content" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
        <MarketBar onMenuClick={() => setSidebarOpen(v => !v)} />
        <div style={{ padding: '24px 28px', flex: 1 }}>
          <Routes>
            <Route path="/"              element={<Dashboard />} />
            <Route path="/holdings"      element={<Holdings />} />
            <Route path="/briefing"      element={<Briefing />} />
            <Route path="/filing-alerts" element={<FilingAlerts />} />
            <Route path="/client-emails" element={<ClientEmails />} />
            <Route path="/settings"      element={<Settings />} />
            <Route path="/admin"         element={<Admin />} />
            <Route path="*"             element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  )
}
