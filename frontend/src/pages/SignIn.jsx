import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, setAdvisorId, setApiKey } from '../api'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  async function handleSignIn(e) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    try {
      const advisor = await api.getAdvisorByEmail(email.trim().toLowerCase(), password)
      setAdvisorId(advisor.id)
      if (advisor.api_key) setApiKey(advisor.api_key)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 20px', position: 'relative',
    }}>
      <div style={{ position: 'fixed', top: '-150px', right: '-150px', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(79,124,246,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '-150px', left: '-150px', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 1 }}>

        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 48, height: 48,
            background: 'linear-gradient(135deg, var(--accent), var(--accent-b))',
            borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, color: 'white', fontWeight: 900,
            margin: '0 auto 14px',
            boxShadow: '0 0 40px rgba(79,124,246,0.35)',
          }}>◆</div>
          <div style={{
            fontSize: 12, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
            background: 'linear-gradient(120deg, var(--text) 0%, var(--accent-b) 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>VeloQuant</div>
        </div>

        <div className="card card-glow" style={{ padding: 36 }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>
              Welcome back
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>
              Sign in to your VeloQuant account.
            </div>
          </div>

          {error && <div className="error-bar">{error}</div>}

          <form onSubmit={handleSignIn}>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Email Address</label>
              <input
                className="form-input"
                type="email"
                placeholder="you@yourfirm.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                style={{ width: '100%' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 28 }}>
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ width: '100%', paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-2)', fontSize: 13, padding: 4, fontFamily: 'inherit',
                  }}
                >{showPassword ? 'Hide' : 'Show'}</button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6 }}>
                If your account was created before passwords were added, leave this blank.
              </div>
            </div>

            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading || !email.trim()}
              style={{ width: '100%', justifyContent: 'center', padding: '12px 18px', fontSize: 14 }}
            >
              {loading ? <><div className="spin spin-sm" />Signing in...</> : 'Sign In →'}
            </button>
          </form>

          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <span onClick={() => navigate('/forgot-password')} style={{ fontSize: 13, color: 'var(--text-2)', cursor: 'pointer' }}>
              Forgot your password?
            </span>
          </div>
          <div style={{ marginTop: 12, textAlign: 'center', fontSize: 13, color: 'var(--text-2)' }}>
            Don't have an account?{' '}
            <span onClick={() => navigate('/onboarding')} style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>
              Start your free trial
            </span>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <span onClick={() => navigate('/')} style={{ fontSize: 13, color: 'var(--text-2)', cursor: 'pointer' }}>
            ← Back to home
          </span>
        </div>
      </div>
    </div>
  )
}
