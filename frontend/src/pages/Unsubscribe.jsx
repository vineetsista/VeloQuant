import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'

export default function Unsubscribe() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('loading') // loading | done | error | no-token
  const [name, setName] = useState('')
  const navigate = useNavigate()
  const token = searchParams.get('token') || window.location.pathname.split('/unsubscribe/')[1]

  useEffect(() => {
    if (!token) { setStatus('no-token'); return }
    fetch(`/api/unsubscribe/${token}`, { method: 'POST' })
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setName(d.name || '')
        setStatus('done')
      })
      .catch(() => setStatus('error'))
  }, [token])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ width: '100%', maxWidth: 440, textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, background: 'linear-gradient(135deg, var(--accent), var(--accent-b))', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#fff', fontWeight: 900, margin: '0 auto 20px', boxShadow: '0 0 40px rgba(79,124,246,0.3)' }}>◆</div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 16 }}>RIA Intelligence</div>

        {status === 'loading' && (
          <>
            <div className="spin" style={{ margin: '0 auto 16px', width: 28, height: 28 }} />
            <div style={{ fontSize: 16, color: 'var(--text-2)' }}>Unsubscribing...</div>
          </>
        )}

        {status === 'done' && (
          <div className="card card-glow" style={{ padding: 36 }}>
            <div style={{ fontSize: 36, marginBottom: 12, color: 'var(--success)' }}>✓</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 10, letterSpacing: '-0.02em' }}>
              You're unsubscribed{name ? `, ${name.split(' ')[0]}` : ''}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 24 }}>
              You'll no longer receive daily morning briefing emails. Your account and data are untouched — you can still access the platform and generate briefings manually.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn btn-primary" onClick={() => navigate('/signin')} style={{ width: '100%', justifyContent: 'center' }}>
                Sign In to Re-enable Emails →
              </button>
              <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
                To re-enable: sign in → Settings → Notifications → turn on Daily Briefing Email.
              </div>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="card card-glow" style={{ padding: 36 }}>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 10, color: 'var(--danger)' }}>Link not recognized</div>
            <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 24 }}>
              This unsubscribe link is invalid or has already been used. To manage your email preferences, sign in to your account.
            </div>
            <button className="btn btn-outline" onClick={() => navigate('/signin')} style={{ width: '100%', justifyContent: 'center' }}>
              Sign In
            </button>
          </div>
        )}

        {status === 'no-token' && (
          <div className="card card-glow" style={{ padding: 36 }}>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>Invalid link</div>
            <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 24 }}>
              Use the unsubscribe link from your briefing email, or manage email preferences from Settings.
            </div>
            <button className="btn btn-outline" onClick={() => navigate('/signin')} style={{ width: '100%', justifyContent: 'center' }}>
              Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
