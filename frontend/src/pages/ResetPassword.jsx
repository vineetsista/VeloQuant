import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const token = searchParams.get('token')

  function strength(pw) {
    if (!pw) return { score: 0, label: '', color: 'transparent' }
    let s = 0
    if (pw.length >= 8) s++
    if (pw.length >= 12) s++
    if (/[A-Z]/.test(pw)) s++
    if (/[0-9]/.test(pw)) s++
    if (/[^A-Za-z0-9]/.test(pw)) s++
    if (s <= 1) return { score: s, label: 'Weak', color: 'var(--danger)' }
    if (s <= 3) return { score: s, label: 'Fair', color: 'var(--warning)' }
    return { score: s, label: 'Strong', color: 'var(--success)' }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (!token) { setError('Invalid reset link'); return }
    setLoading(true); setError(null)
    try {
      await api.resetPassword(token, password)
      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const s = strength(password)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ position: 'fixed', top: '-150px', right: '-150px', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(79,124,246,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ width: 48, height: 48, background: 'linear-gradient(135deg, var(--accent), var(--accent-b))', borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: 'white', fontWeight: 900, margin: '0 auto 14px', boxShadow: '0 0 40px rgba(79,124,246,0.35)' }}>◆</div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', background: 'linear-gradient(120deg, var(--text) 0%, var(--accent-b) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>VeloQuant</div>
        </div>

        <div className="card card-glow" style={{ padding: 36 }}>
          {done ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 10 }}>Password updated</div>
              <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 28 }}>
                Your new password is set. Sign in to access your dashboard.
              </div>
              <button className="btn btn-primary" onClick={() => navigate('/signin')} style={{ width: '100%', justifyContent: 'center' }}>
                Sign In →
              </button>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>Set a new password</div>
                <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>Choose something strong you'll remember.</div>
              </div>

              {error && <div className="error-bar">{error}</div>}

              <form onSubmit={handleSubmit}>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">New Password</label>
                  <div style={{ position: 'relative' }}>
                    <input className="form-input" type={showPassword ? 'text' : 'password'} placeholder="Min. 8 characters" value={password} onChange={e => setPassword(e.target.value)} required autoFocus style={{ width: '100%', paddingRight: 44 }} />
                    <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', fontSize: 13, padding: 4, fontFamily: 'inherit' }}>
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {password && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                        {[1,2,3,4].map(n => <div key={n} style={{ flex: 1, height: 3, borderRadius: 2, background: n <= s.score ? s.color : 'var(--border)' }} />)}
                      </div>
                      <div style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{s.label}</div>
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: 28 }}>
                  <label className="form-label">Confirm Password</label>
                  <input className="form-input" type={showPassword ? 'text' : 'password'} placeholder="Re-enter your password" value={confirm} onChange={e => setConfirm(e.target.value)} required style={{ width: '100%', borderColor: confirm && confirm !== password ? 'var(--danger)' : undefined }} />
                  {confirm && confirm !== password && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>Passwords do not match</div>}
                </div>

                <button className="btn btn-primary" type="submit" disabled={loading || !password || !confirm} style={{ width: '100%', justifyContent: 'center', padding: '12px 18px', fontSize: 14 }}>
                  {loading ? <><div className="spin spin-sm" />Updating...</> : 'Set New Password →'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
