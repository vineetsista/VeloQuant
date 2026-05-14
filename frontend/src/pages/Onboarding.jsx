import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, setAdvisorId, setApiKey, getAdvisorId } from '../api'
import usePageTitle from '../hooks/usePageTitle'

const SUGGESTED = ['AAPL', 'JPM', 'JNJ', 'BRK.B', 'VTI', 'MSFT', 'GOOGL', 'AMZN']

export default function Onboarding() {
  usePageTitle('Get Started')
  const [step, setStep] = useState(1)
  const [advisorId, setLocalAdvisorId] = useState(null)

  // Step 1 state
  const [name, setName] = useState('')
  const [firm, setFirm] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)

  function passwordStrength(pw) {
    if (!pw) return { score: 0, label: '', color: 'transparent' }
    let score = 0
    if (pw.length >= 8) score++
    if (pw.length >= 12) score++
    if (/[A-Z]/.test(pw)) score++
    if (/[0-9]/.test(pw)) score++
    if (/[^A-Za-z0-9]/.test(pw)) score++
    if (score <= 1) return { score, label: 'Weak', color: 'var(--danger)' }
    if (score <= 3) return { score, label: 'Fair', color: 'var(--warning)' }
    return { score, label: 'Strong', color: 'var(--success)' }
  }

  // Step 2 state
  const [holdings, setHoldings] = useState([])
  const [ticker, setTicker] = useState('')
  const [size, setSize] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  const navigate = useNavigate()

  async function handleCreate(e) {
    e.preventDefault()
    if (password.length < 8) { setCreateError('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { setCreateError('Passwords do not match'); return }
    setCreating(true); setCreateError(null)
    try {
      const advisor = await api.createAdvisor(name.trim(), firm.trim(), email.trim(), password)
      setAdvisorId(advisor.id)
      if (advisor.api_key) setApiKey(advisor.api_key)
      setLocalAdvisorId(advisor.id)
      setStep(2)
    } catch (e) {
      setCreateError(e.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleAddHolding(e) {
    e.preventDefault()
    if (!ticker || !size) return
    setAdding(true); setAddError(null)
    try {
      const h = await api.addHolding(ticker.toUpperCase().trim(), parseFloat(size))
      setHoldings(prev => [...prev, h])
      setTicker(''); setSize('')
    } catch (e) {
      setAddError(e.message)
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(id) {
    try {
      await api.deleteHolding(id)
      setHoldings(prev => prev.filter(h => h.id !== id))
    } catch (_) {}
  }

  async function handleLaunch() {
    const aid = advisorId || getAdvisorId()
    setCheckoutLoading(true)
    try {
      const { url } = await api.createCheckout(aid)
      window.location.href = url
    } catch (e) {
      // If Stripe isn't configured yet, fall through to dashboard
      navigate('/')
    } finally {
      setCheckoutLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      position: 'relative',
    }}>
      {/* Background blobs */}
      <div style={{
        position: 'fixed', top: '-150px', right: '-150px',
        width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(79,124,246,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'fixed', bottom: '-150px', left: '-150px',
        width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 520, position: 'relative', zIndex: 1 }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 52, height: 52,
            background: 'linear-gradient(135deg, var(--accent), var(--accent-b))',
            borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, color: 'white', fontWeight: 900,
            margin: '0 auto 16px',
            boxShadow: '0 0 40px rgba(79,124,246,0.4)',
          }}>◆</div>
          <div style={{
            fontSize: 13, fontWeight: 700,
            letterSpacing: '0.15em', textTransform: 'uppercase',
            background: 'linear-gradient(120deg, var(--text) 0%, var(--accent-b) 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>VeloQuant</div>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 36 }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: s === step
                  ? 'linear-gradient(135deg, var(--accent), var(--accent-b))'
                  : s < step ? 'var(--success)' : 'var(--surface-2)',
                border: s === step ? 'none' : `1px solid ${s < step ? 'var(--success)' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800, color: s <= step ? 'white' : 'var(--text-2)',
                boxShadow: s === step ? '0 0 16px rgba(79,124,246,0.5)' : 'none',
                transition: 'all 0.3s',
              }}>
                {s < step ? '✓' : s}
              </div>
              <span style={{
                fontSize: 12, fontWeight: s === step ? 600 : 400,
                color: s === step ? 'var(--text)' : 'var(--text-2)',
              }}>
                {s === 1 ? 'Create Account' : s === 2 ? 'Add Holdings' : 'Start Trial'}
              </span>
              {s < 3 && (
                <div style={{
                  width: 32, height: 1,
                  background: step > s ? 'var(--success)' : 'var(--border)',
                  marginLeft: 4, marginRight: 4,
                  transition: 'background 0.3s',
                }} />
              )}
            </div>
          ))}
        </div>

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <div className="card card-glow" style={{ padding: 36 }}>
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>
                Set up your platform
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>
                Your personal Goldman Sachs research analyst, filtered to your book of business. Let's get started.
              </div>
            </div>

            {createError && <div className="error-bar">{createError}</div>}

            <form onSubmit={handleCreate}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Your Full Name</label>
                <input
                  className="form-input"
                  placeholder="Sarah Chen"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  style={{ width: '100%' }}
                  autoFocus
                />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Firm Name</label>
                <input
                  className="form-input"
                  placeholder="Meridian Wealth Advisors"
                  value={firm}
                  onChange={e => setFirm(e.target.value)}
                  required
                  style={{ width: '100%' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Email Address</label>
                <input
                  className="form-input"
                  type="email"
                  placeholder="sarah@meridianwealth.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  style={{ width: '100%' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="form-input"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    style={{ width: '100%', paddingRight: 44 }}
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', fontSize: 13, padding: 4, fontFamily: 'inherit' }}>
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {password && (() => {
                  const s = passwordStrength(password)
                  return (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                        {[1,2,3,4].map(n => (
                          <div key={n} style={{ flex: 1, height: 3, borderRadius: 2, background: n <= s.score ? s.color : 'var(--border)' }} />
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{s.label}</div>
                    </div>
                  )
                })()}
              </div>
              <div className="form-group" style={{ marginBottom: 28 }}>
                <label className="form-label">Confirm Password</label>
                <input
                  className="form-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  style={{ width: '100%', borderColor: confirmPassword && confirmPassword !== password ? 'var(--danger)' : undefined }}
                />
                {confirmPassword && confirmPassword !== password && (
                  <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>Passwords do not match</div>
                )}
              </div>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={creating}
                style={{ width: '100%', justifyContent: 'center', padding: '12px 18px', fontSize: 14 }}
              >
                {creating ? <><div className="spin spin-sm" />Creating account...</> : 'Continue →'}
              </button>
            </form>
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <div>
            <div className="card card-glow" style={{ padding: 36 }}>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>
                  Add your holdings
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>
                  Enter the tickers you want monitored. The platform will track prices, SEC filings, and news for each one.
                </div>
              </div>

              {addError && <div className="error-bar">{addError}</div>}

              <form onSubmit={handleAddHolding} className="form-row" style={{ marginBottom: 20 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Ticker</label>
                  <input
                    className="form-input"
                    placeholder="AAPL"
                    value={ticker}
                    onChange={e => setTicker(e.target.value.toUpperCase())}
                    style={{ width: '100%' }}
                    required
                  />
                </div>
                <div className="form-group" style={{ flex: 2 }}>
                  <label className="form-label">Position Size ($)</label>
                  <input
                    className="form-input"
                    type="number"
                    placeholder="50,000"
                    value={size}
                    onChange={e => setSize(e.target.value)}
                    style={{ width: '100%' }}
                    required
                    min="1"
                  />
                </div>
                <button className="btn btn-primary" type="submit" disabled={adding} style={{ marginTop: 21 }}>
                  {adding ? <div className="spin spin-sm" /> : '+ Add'}
                </button>
              </form>

              {/* Suggestions */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Quick add
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {SUGGESTED.filter(s => !holdings.find(h => h.ticker === s)).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setTicker(s)}
                      style={{
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-2)',
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        letterSpacing: '0.04em',
                        transition: 'all 0.12s',
                      }}
                      onMouseEnter={e => { e.target.style.borderColor = 'rgba(79,124,246,0.4)'; e.target.style.color = 'var(--text)' }}
                      onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-2)' }}
                    >{s}</button>
                  ))}
                </div>
              </div>

              {/* Added holdings */}
              {holdings.length > 0 && (
                <div style={{
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--rs)',
                  padding: '4px 0',
                  marginBottom: 20,
                }}>
                  {holdings.map(h => (
                    <div key={h.id} style={{
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="chip">{h.ticker}</span>
                        <span style={{ fontSize: 13, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
                          ${parseFloat(h.position_size).toLocaleString()}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemove(h.id)}
                        style={{
                          background: 'none', border: 'none',
                          color: 'var(--text-2)', cursor: 'pointer',
                          fontSize: 16, lineHeight: 1,
                          padding: '2px 6px',
                        }}
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              className="btn btn-primary"
              onClick={handleLaunch}
              disabled={holdings.length === 0 || checkoutLoading}
              style={{
                width: '100%', justifyContent: 'center',
                padding: '13px 18px', fontSize: 15,
                opacity: holdings.length === 0 ? 0.4 : 1,
              }}
            >
              {checkoutLoading
                ? <><div className="spin spin-sm" />Redirecting to checkout...</>
                : holdings.length === 0
                  ? 'Add at least one holding to continue'
                  : 'Start Your 14-Day Free Trial →'}
            </button>
            {holdings.length > 0 && (
              <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: 'var(--text-2)' }}>
                {holdings.length} holding{holdings.length !== 1 ? 's' : ''} added · No charge for 14 days · Cancel anytime
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
