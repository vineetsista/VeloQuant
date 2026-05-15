import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, setAdvisorId, setApiKey } from '../api'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('verifying') // verifying | success | error
  const [error, setError] = useState(null)
  const [resendEmail, setResendEmail] = useState('')
  const [resent, setResent] = useState(false)
  const navigate = useNavigate()
  const token = searchParams.get('token')

  useEffect(() => {
    if (token) verify()
    else setStatus('no-token')
  }, [token])

  async function verify() {
    try {
      const data = await api.verifyEmail(token)
      if (data.advisor) {
        setAdvisorId(data.advisor.id)
        if (data.advisor.api_key) setApiKey(data.advisor.api_key)
      }
      setStatus('success')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  async function handleResend(e) {
    e.preventDefault()
    await api.resendVerification(resendEmail)
    setResent(true)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ width: '100%', maxWidth: 480, textAlign: 'center' }}>

        <img src="/veloquant-icon.svg" alt="VeloQuant" style={{ width: 52, height: 52, borderRadius: 14, margin: '0 auto 20px', display: 'block', boxShadow: '0 0 40px rgba(79,124,246,0.4)' }} />

        {status === 'verifying' && (
          <>
            <div className="spin" style={{ margin: '0 auto 16px', width: 32, height: 32 }} />
            <div style={{ fontSize: 18, fontWeight: 700 }}>Verifying your email...</div>
          </>
        )}

        {status === 'success' && (
          <div className="card card-glow" style={{ padding: 40 }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 12, letterSpacing: '-0.03em' }}>Email verified!</div>
            <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 28 }}>
              Your account is now active. Your first morning briefing will arrive tomorrow at 7:30am ET.
            </div>
            <button className="btn btn-primary" onClick={() => navigate('/')} style={{ width: '100%', justifyContent: 'center', padding: '12px 18px' }}>
              Go to My Dashboard →
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="card card-glow" style={{ padding: 40 }}>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 12, color: 'var(--danger)' }}>Link expired</div>
            <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 24 }}>
              {error || 'This verification link is invalid or has expired.'} Enter your email to get a new one.
            </div>
            {resent ? (
              <div style={{ color: 'var(--success)', fontWeight: 600, fontSize: 14 }}>✓ New verification email sent — check your inbox.</div>
            ) : (
              <form onSubmit={handleResend}>
                <input className="form-input" type="email" placeholder="your@email.com" value={resendEmail} onChange={e => setResendEmail(e.target.value)} required style={{ width: '100%', marginBottom: 12 }} />
                <button className="btn btn-primary" type="submit" style={{ width: '100%', justifyContent: 'center' }}>Resend Verification Email</button>
              </form>
            )}
          </div>
        )}

        {status === 'no-token' && (
          <div className="card card-glow" style={{ padding: 40 }}>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>Check your inbox</div>
            <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 24 }}>
              We sent a verification link to your email when you signed up. Click that link to activate your account.
            </div>
            <button className="btn btn-outline" onClick={() => navigate('/signin')} style={{ width: '100%', justifyContent: 'center' }}>Back to Sign In</button>
          </div>
        )}
      </div>
    </div>
  )
}
