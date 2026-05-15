import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.forgotPassword(email.trim().toLowerCase())
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ position: 'fixed', top: '-150px', right: '-150px', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(79,124,246,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <img src="/veloquant-icon.svg" alt="VeloQuant" style={{ width: 48, height: 48, borderRadius: 13, margin: '0 auto 14px', display: 'block', boxShadow: '0 0 40px rgba(79,124,246,0.35)' }} />
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', background: 'linear-gradient(120deg, var(--text) 0%, var(--accent-b) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>VeloQuant</div>
        </div>

        <div className="card card-glow" style={{ padding: 36 }}>
          {sent ? (
            <>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>✉</div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 10 }}>Check your inbox</div>
                <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7 }}>
                  If <strong>{email}</strong> is registered, we've sent a password reset link. It expires in 1 hour.
                </div>
              </div>
              <button className="btn btn-outline" onClick={() => navigate('/signin')} style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
                Back to Sign In
              </button>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>Forgot your password?</div>
                <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>
                  Enter the email address on your account and we'll send you a reset link.
                </div>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="form-group" style={{ marginBottom: 24 }}>
                  <label className="form-label">Email Address</label>
                  <input className="form-input" type="email" placeholder="you@yourfirm.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus style={{ width: '100%' }} />
                </div>
                <button className="btn btn-primary" type="submit" disabled={loading || !email.trim()} style={{ width: '100%', justifyContent: 'center', padding: '12px 18px', fontSize: 14 }}>
                  {loading ? <><div className="spin spin-sm" />Sending...</> : 'Send Reset Link →'}
                </button>
              </form>
              <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-2)' }}>
                Remember it?{' '}
                <span onClick={() => navigate('/signin')} style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>Sign in</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
