import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { api } from '../api'

export default function VerifyEmailChange() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('verifying') // verifying | success | error
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setStatus('error')
      setMessage('Invalid link — no verification token found.')
      return
    }
    api.verifyEmailChange(token)
      .then(() => setStatus('success'))
      .catch(e => { setStatus('error'); setMessage(e.message) })
  }, [])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: 24,
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
        padding: '48px 40px', maxWidth: 440, width: '100%', textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>
          {status === 'verifying' ? '⟳' : status === 'success' ? '✓' : '✕'}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 10, letterSpacing: '-0.02em' }}>
          {status === 'verifying' && 'Verifying…'}
          {status === 'success' && 'Email updated'}
          {status === 'error' && 'Link invalid'}
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 28 }}>
          {status === 'verifying' && 'Confirming your new email address…'}
          {status === 'success' && 'Your email address has been updated. Sign in again to continue.'}
          {status === 'error' && (message || 'This link has expired or already been used.')}
        </div>
        <Link
          to="/signin"
          style={{
            display: 'inline-block', padding: '10px 28px', borderRadius: 8,
            background: 'linear-gradient(135deg, var(--accent), var(--accent-b))',
            color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 14,
          }}
        >
          Go to Sign In
        </Link>
      </div>
    </div>
  )
}
