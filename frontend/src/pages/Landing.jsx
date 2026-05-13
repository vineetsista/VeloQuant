import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import BriefingRenderer from '../components/BriefingRenderer'

const PROGRESS_MESSAGES = [
  'Connecting to market data feeds...',
  'Fetching overnight price movements...',
  'Scanning SEC EDGAR for recent filings...',
  'Analyzing filings for portfolio impact...',
  'Generating your personalized briefing...',
]

const FEATURES = [
  {
    icon: '≋',
    title: 'Morning Intelligence Briefing',
    desc: 'A buy-side analyst quality briefing generated specifically for your holdings. Every item tied to a specific position with the exact investment thesis implication — not generic market commentary.',
  },
  {
    icon: '◎',
    title: 'SEC Filing Intelligence',
    desc: 'Automated monitoring of 10-K, 10-Q, and 8-K filings for every holding. AI extracts the detail that matters buried on page 12 — before your clients see the headlines.',
  },
  {
    icon: '✦',
    title: 'Client Communication Drafts',
    desc: 'One-click draft client emails tied to specific filing events. Plain English explanations your clients can understand, with your name and firm — ready to send in 30 seconds.',
  },
]

const STEPS = [
  { n: '01', title: 'Add your holdings', desc: 'Enter the tickers your clients commonly hold. Takes 60 seconds.' },
  { n: '02', title: 'We monitor everything', desc: 'Overnight: prices, news, SEC filings — all fetched and analyzed automatically.' },
  { n: '03', title: 'Briefing in your inbox', desc: 'By 7:30am ET every weekday, a personalized briefing lands before you open Bloomberg.' },
]

export default function Landing() {
  const [tickers, setTickers] = useState('')
  const [loading, setLoading] = useState(false)
  const [msgIdx, setMsgIdx] = useState(0)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const resultRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading) return
    const msgTimer = setInterval(() => setMsgIdx(i => (i + 1) % PROGRESS_MESSAGES.length), 3500)
    const progTimer = setInterval(() => setProgress(p => Math.min(p + 1.4, 92)), 700)
    return () => { clearInterval(msgTimer); clearInterval(progTimer) }
  }, [loading])

  useEffect(() => {
    if (result && resultRef.current) {
      setTimeout(() => resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
  }, [result])

  async function handleGenerate(e) {
    e.preventDefault()
    if (!tickers.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    setMsgIdx(0)
    setProgress(0)
    try {
      const data = await api.demoGenerate(tickers)
      setProgress(100)
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>

      {/* ── Nav ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px', height: 64,
        background: 'rgba(5,12,24,0.92)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'linear-gradient(135deg, var(--accent), var(--accent-b))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color: '#fff', fontWeight: 900,
          }}>◆</div>
          <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.02em' }}>RIA Intelligence</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            onClick={() => navigate('/signin')}
            style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', padding: '8px 12px' }}
          >Sign In</button>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/onboarding')}
            style={{ fontSize: 13, padding: '8px 18px' }}
          >Start Free Trial →</button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ padding: '80px 24px 60px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* Background glow */}
        <div style={{ position: 'absolute', top: -200, left: '50%', transform: 'translateX(-50%)', width: 800, height: 600, background: 'radial-gradient(ellipse, rgba(79,124,246,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 20 }}>
          For Independent Financial Advisors
        </div>

        <h1 style={{
          fontSize: 'clamp(32px, 5vw, 60px)', fontWeight: 900,
          letterSpacing: '-0.04em', lineHeight: 1.1,
          margin: '0 auto 24px', maxWidth: 800,
        }}>
          Goldman Sachs-Level Research{' '}
          <span style={{ background: 'linear-gradient(120deg, var(--accent), var(--accent-b))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Intelligence.
          </span>
          <br />Built for Independent Advisors.
        </h1>

        <p style={{ fontSize: 18, color: 'var(--text-2)', maxWidth: 600, margin: '0 auto 48px', lineHeight: 1.7 }}>
          Stop spending 2 hours every morning synthesizing market data. Get a personalized AI briefing
          filtered to your specific holdings — delivered before market open.
        </p>

        {/* Demo input */}
        <form onSubmit={handleGenerate} style={{ maxWidth: 640, margin: '0 auto 16px' }}>
          <div style={{
            display: 'flex', gap: 0,
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 12, overflow: 'hidden',
            boxShadow: '0 0 40px rgba(79,124,246,0.12)',
            transition: 'box-shadow 0.2s',
          }}>
            <input
              value={tickers}
              onChange={e => setTickers(e.target.value)}
              placeholder="AAPL, MSFT, JPM, BRK.B, UNH"
              disabled={loading}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                padding: '16px 20px', fontSize: 16, color: 'var(--text)',
                fontFamily: 'inherit',
              }}
            />
            <button
              type="submit"
              disabled={loading || !tickers.trim()}
              className="btn btn-primary"
              style={{ borderRadius: 0, padding: '16px 28px', fontSize: 15, fontWeight: 700, border: 'none', flexShrink: 0 }}
            >
              {loading ? <><div className="spin spin-sm" />Analyzing...</> : 'Generate My Briefing →'}
            </button>
          </div>
        </form>

        <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
          Enter up to 10 tickers, comma-separated · No account required · Takes ~60 seconds
        </div>

        {/* Social proof */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginTop: 48, flexWrap: 'wrap' }}>
          {[['7:30am', 'Delivered daily'], ['< 90s', 'Briefing generation'], ['SEC + Price + News', 'Data sources']].map(([val, label]) => (
            <div key={val} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, background: 'linear-gradient(120deg, var(--text), var(--accent-b))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{val}</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Loading state ── */}
      {loading && (
        <section style={{ padding: '0 24px 60px', maxWidth: 720, margin: '0 auto' }}>
          <div className="card card-glow" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ marginBottom: 28 }}>
              <div className="spin" style={{ margin: '0 auto 20px', width: 36, height: 36, borderWidth: 3 }} />
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Analyzing your portfolio...</div>
              <div style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 500, minHeight: 20 }}>
                {PROGRESS_MESSAGES[msgIdx]}
              </div>
            </div>
            <div style={{ background: 'var(--surface-2)', borderRadius: 4, height: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4,
                background: 'linear-gradient(90deg, var(--accent), var(--accent-b))',
                width: `${progress}%`,
                transition: 'width 0.7s ease',
              }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 12 }}>
              Pulling SEC filings, overnight prices, and news simultaneously
            </div>
          </div>
        </section>
      )}

      {/* ── Error ── */}
      {error && !loading && (
        <section style={{ padding: '0 24px 40px', maxWidth: 720, margin: '0 auto' }}>
          <div className="error-bar">{error}</div>
        </section>
      )}

      {/* ── Demo Result ── */}
      {result && !loading && (
        <section ref={resultRef} style={{ padding: '0 24px 60px', maxWidth: 800, margin: '0 auto' }}>
          <div className="card card-glow" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Result header */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(79,124,246,0.12), rgba(6,182,212,0.06))',
              borderBottom: '1px solid var(--border)',
              padding: '24px 32px',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
            }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 6 }}>
                  Morning Intelligence Briefing
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>
                  {date}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                  {result.tickers.map(t => (
                    <span key={t} className="chip" style={{ marginRight: 6 }}>{t}</span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => { setResult(null); setTickers('') }}
                >New Demo</button>
                <button
                  className="btn btn-primary"
                  onClick={() => navigate('/onboarding')}
                  style={{ fontSize: 13 }}
                >Start Free Trial →</button>
              </div>
            </div>

            {/* Briefing content */}
            <div style={{ padding: '32px' }}>
              <BriefingRenderer content={result.briefing} />
            </div>

            {/* CTA inside result */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(79,124,246,0.08), rgba(6,182,212,0.04))',
              borderTop: '1px solid var(--border)',
              padding: '28px 32px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>This runs automatically every weekday at 7:30am ET.</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)' }}>14-day free trial. No credit card required. Cancel anytime.</div>
              </div>
              <button className="btn btn-primary" onClick={() => navigate('/onboarding')} style={{ padding: '12px 24px', fontSize: 14 }}>
                Set Up My Account →
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── Features ── */}
      <section style={{ padding: '80px 24px', maxWidth: 1080, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>What You Get</div>
          <h2 style={{ fontSize: 'clamp(24px, 3vw, 38px)', fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>
            Everything you need before market open
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {FEATURES.map(f => (
            <div key={f.title} className="card" style={{ padding: '32px 28px' }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(79,124,246,0.15), rgba(6,182,212,0.08))',
                border: '1px solid rgba(79,124,246,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, color: 'var(--accent)', marginBottom: 20,
              }}>{f.icon}</div>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12, letterSpacing: '-0.02em' }}>{f.title}</div>
              <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ padding: '80px 24px', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>How It Works</div>
            <h2 style={{ fontSize: 'clamp(24px, 3vw, 38px)', fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>
              Set up once. Intelligence delivered daily.
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 32 }}>
            {STEPS.map((s, i) => (
              <div key={s.n} style={{ position: 'relative' }}>
                <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: '-0.04em', color: 'rgba(79,124,246,0.15)', lineHeight: 1, marginBottom: 16 }}>{s.n}</div>
                <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', marginBottom: 10 }}>{s.title}</div>
                <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7 }}>{s.desc}</div>
                {i < STEPS.length - 1 && (
                  <div style={{ display: 'none' }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section style={{ padding: '80px 24px', maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>Pricing</div>
        <h2 style={{ fontSize: 'clamp(24px, 3vw, 38px)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 40 }}>
          Simple, transparent pricing
        </h2>
        <div className="card card-glow" style={{ padding: '40px 36px', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 52, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}>$299</span>
            <span style={{ fontSize: 18, color: 'var(--text-2)', paddingBottom: 6 }}>/month</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, marginBottom: 28 }}>
            14-day free trial · No credit card required · Cancel anytime
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24, marginBottom: 28 }}>
            {[
              'Daily morning intelligence briefing',
              'SEC filing alerts for all holdings',
              'AI-drafted client communication emails',
              'Portfolio price monitoring overnight',
              'Delivered to your inbox by 7:30am ET',
              'Unlimited holdings tracked',
            ].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ color: 'var(--success)', fontSize: 14, flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: 14, color: 'var(--text-2)' }}>{f}</span>
              </div>
            ))}
          </div>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/onboarding')}
            style={{ width: '100%', justifyContent: 'center', padding: '14px 18px', fontSize: 15 }}
          >
            Start Your Free Trial →
          </button>
          <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: 'var(--text-2)' }}>
            No commitment. Cancel before your trial ends and pay nothing.
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '32px 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6,
            background: 'linear-gradient(135deg, var(--accent), var(--accent-b))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, color: '#fff', fontWeight: 900,
          }}>◆</div>
          <span style={{ fontSize: 13, fontWeight: 700 }}>RIA Intelligence</span>
          <span style={{ fontSize: 12, color: 'var(--text-2)', marginLeft: 8 }}>© 2026</span>
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          {['Privacy Policy', 'Terms of Service'].map(l => (
            <span key={l} style={{ fontSize: 13, color: 'var(--text-2)', cursor: 'pointer' }}>{l}</span>
          ))}
          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Not investment advice.</span>
        </div>
      </footer>

    </div>
  )
}
