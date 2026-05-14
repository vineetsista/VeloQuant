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
    title: 'Morning Briefing',
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

const FAQS = [
  { q: 'How is this different from Bloomberg or FactSet?', a: "Bloomberg gives you raw data — you still have to synthesize it into insights. VeloQuant takes your specific holdings, pulls the data automatically overnight, and hands you a briefing written for your book of business. It's the analyst you can't afford to hire." },
  { q: 'How does it know what to monitor?', a: 'You enter your holdings as tickers. The platform monitors SEC EDGAR for 10-K, 10-Q, and 8-K filings, fetches overnight price movements, and scans financial news — all filtered to the positions you actually hold.' },
  { q: 'What time does the briefing arrive?', a: 'Briefings are generated and sent to your email by 7:30am ET every weekday. You can also generate a manual briefing at any time from the dashboard.' },
  { q: 'Is my client data secure?', a: 'You only enter stock tickers — not client names or account details. All data is encrypted in transit and at rest. The platform never has access to your CRM or custodian data.' },
  { q: 'Can I cancel anytime?', a: "Yes. Cancel before your trial ends and you'll never be charged. After subscribing, cancel anytime and retain access through the end of your billing period." },
  { q: 'Does this work for ETF-heavy or model portfolio advisors?', a: 'Absolutely. Enter ETF tickers directly. The briefing covers price movements, distribution announcements, and SEC filings for the fund itself — tailored to your actual allocation.' },
  { q: 'Is this compliant with FINRA/SEC marketing rules?', a: "VeloQuant is a productivity tool — it generates internal research summaries and draft communications for your review. You are responsible for reviewing and approving any content before sending to clients. AI-generated drafts are clearly labeled and never sent automatically. Consult your compliance consultant for firm-specific guidance." },
  { q: 'Do I need to disclose AI usage to my clients?', a: "This is evolving regulatory territory. The AI-drafted emails are templates for your review — you edit and send from your own email system. We recommend following your compliance consultant's guidance on AI disclosure practices." },
  { q: 'What client data do you store?', a: "None. You enter ticker symbols only — no client names, account numbers, portfolio values, or personally identifiable information. There is nothing to disclose to regulators about client data stored with VeloQuant." },
]

const STEPS = [
  { n: '01', title: 'Add your holdings', desc: 'Enter the tickers your clients commonly hold. Takes 60 seconds.' },
  { n: '02', title: 'We monitor everything', desc: 'Overnight: prices, news, SEC filings — all fetched and analyzed automatically.' },
  { n: '03', title: 'Briefing in your inbox', desc: 'By 7:30am ET every weekday, a personalized briefing lands before you open Bloomberg.' },
]

const SAMPLE_SECTIONS = [
  {
    label: 'Market Overview',
    content: "Futures pointing to a flat open following Friday's gains. S&P 500 futures +0.1%, Nasdaq flat. Treasury yields stable: 10-year at 4.42%. No major macro catalysts overnight.",
  },
  {
    label: 'AAPL — Apple Inc.',
    badge: '+1.2%', badgeColor: 'var(--success)',
    content: "Apple closed at $194.32, up 1.2% on above-average volume. Wedbush reiterated Outperform, $230 target, citing India manufacturing expansion as structural margin tailwind. No SEC filings in past 48 hours. Earnings in 18 days — whisper EPS $1.62 vs consensus $1.57.",
  },
  {
    label: 'JPM — JPMorgan Chase',
    badge: 'NEW 8-K', badgeColor: 'var(--accent)', hasDraft: true,
    content: "JPMorgan filed an 8-K Friday evening disclosing CFO Jeremy Barnum's planned departure in Q3 2026. Successor named internally. Stock reaction muted pre-market (-0.3%). No change to dividend or buyback program mentioned.",
  },
  {
    label: 'MSFT — Microsoft',
    badge: '-0.4%', badgeColor: '#f59e0b',
    content: "Microsoft slightly down as EU antitrust regulators opened preliminary inquiry into Azure government contract practices. Early-stage — no formal charges. Azure growth reacceleration thesis remains intact.",
  },
]

export default function Landing() {
  const [openFaq, setOpenFaq] = useState(null)
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
          <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.02em' }}>VeloQuant</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            onClick={() => navigate('/signin')}
            style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', padding: '8px 12px' }}
          >Sign In</button>
          <button className="btn btn-primary" onClick={() => navigate('/onboarding')} style={{ fontSize: 13, padding: '8px 18px' }}>
            Start Free Trial →
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ padding: '88px 24px 64px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -200, left: '50%', transform: 'translateX(-50%)', width: 900, height: 700, background: 'radial-gradient(ellipse, rgba(79,124,246,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 20 }}>
          For Independent Financial Advisors
        </div>

        <h1 style={{ fontSize: 'clamp(34px, 5.5vw, 64px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.08, margin: '0 auto 24px', maxWidth: 820 }}>
          Goldman Sachs Has a Team<br />of Analysts.{' '}
          <span style={{ background: 'linear-gradient(120deg, var(--accent), var(--accent-b))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Now So Do You.
          </span>
        </h1>

        <p style={{ fontSize: 18, color: 'var(--text-2)', maxWidth: 600, margin: '0 auto 48px', lineHeight: 1.75 }}>
          Every weekday at 7:30am, VeloQuant delivers a personalized AI briefing covering your exact holdings — overnight moves, SEC filings, and client talking points. In 10 minutes, not 2 hours.
        </p>

        <form onSubmit={handleGenerate} style={{ maxWidth: 640, margin: '0 auto 14px' }}>
          <div style={{
            display: 'flex',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 12, overflow: 'hidden',
            boxShadow: '0 0 48px rgba(79,124,246,0.14)',
          }}>
            <input
              value={tickers}
              onChange={e => setTickers(e.target.value)}
              placeholder="AAPL, MSFT, JPM, BRK.B, UNH"
              disabled={loading}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', padding: '16px 20px', fontSize: 16, color: 'var(--text)', fontFamily: 'inherit' }}
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
          Enter up to 10 tickers · No account required · Takes ~60 seconds
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 48, marginTop: 52, flexWrap: 'wrap' }}>
          {[['7:30am ET', 'Delivered daily'], ['< 90s', 'Briefing generation'], ['3 Sources', 'SEC · Price · News']].map(([val, label]) => (
            <div key={val} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, background: 'linear-gradient(120deg, var(--text), var(--accent-b))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{val}</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 3 }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Trust Bar ── */}
      <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '18px 40px', background: 'rgba(255,255,255,0.012)' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-2)', opacity: 0.5, marginRight: 28, flexShrink: 0 }}>Powered by</span>
          {[
            { name: 'Claude AI', sub: 'by Anthropic', icon: '◈' },
            { name: 'SEC EDGAR', sub: 'Filing database', icon: '⬡' },
            { name: 'Polygon.io', sub: 'Market data', icon: '◇' },
            { name: 'SendGrid', sub: 'Email delivery', icon: '◉' },
          ].map((p, i) => (
            <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 22px', borderLeft: i > 0 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(79,124,246,0.1)', border: '1px solid rgba(79,124,246,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--accent)', flexShrink: 0 }}>{p.icon}</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-2)', opacity: 0.65 }}>{p.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <section style={{ padding: '40px 24px 60px', maxWidth: 720, margin: '0 auto' }}>
          <div className="card card-glow" style={{ padding: 40, textAlign: 'center' }}>
            <div className="spin" style={{ margin: '0 auto 20px', width: 36, height: 36, borderWidth: 3 }} />
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Analyzing your portfolio...</div>
            <div style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 500, marginBottom: 28, minHeight: 20 }}>{PROGRESS_MESSAGES[msgIdx]}</div>
            <div style={{ background: 'var(--surface-2)', borderRadius: 4, height: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, var(--accent), var(--accent-b))', width: `${progress}%`, transition: 'width 0.7s ease' }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 12 }}>Pulling SEC filings, overnight prices, and news simultaneously</div>
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
            <div style={{ background: 'linear-gradient(135deg, rgba(79,124,246,0.12), rgba(6,182,212,0.06))', borderBottom: '1px solid var(--border)', padding: '24px 32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 6 }}>Morning Briefing</div>
                <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>{date}</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{result.tickers.map(t => <span key={t} className="chip" style={{ marginRight: 6 }}>{t}</span>)}</div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-outline btn-sm" onClick={() => { setResult(null); setTickers('') }}>New Demo</button>
                <button className="btn btn-primary" onClick={() => navigate('/onboarding')} style={{ fontSize: 13 }}>Start Free Trial →</button>
              </div>
            </div>
            <div style={{ padding: '32px' }}>
              <BriefingRenderer content={result.briefing} />
            </div>
            <div style={{ background: 'linear-gradient(135deg, rgba(79,124,246,0.08), rgba(6,182,212,0.04))', borderTop: '1px solid var(--border)', padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>This runs automatically every weekday at 7:30am ET.</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)' }}>14-day free trial. Cancel anytime.</div>
              </div>
              <button className="btn btn-primary" onClick={() => navigate('/onboarding')} style={{ padding: '12px 24px', fontSize: 14 }}>Set Up My Account →</button>
            </div>
          </div>
        </section>
      )}

      {/* ── The Morning Problem ── */}
      <section style={{ padding: '100px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 20% 50%, rgba(239,68,68,0.045) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#f87171', marginBottom: 12 }}>The Problem</div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 900, letterSpacing: '-0.04em', margin: '0 auto', maxWidth: 680, lineHeight: 1.15 }}>
              Your morning research is<br />eating your practice alive.
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {[
              { time: '6:30am', label: 'Open Bloomberg', pain: "Scan headlines that don't filter to your specific holdings" },
              { time: '7:00am', label: 'Check SEC EDGAR', pain: 'Manually search for filings across 20+ positions' },
              { time: '7:45am', label: 'Read earnings transcripts', pain: 'Hunt for the 3 lines relevant to your investment thesis' },
              { time: '8:30am', label: 'Prep client calls', pain: "Still haven't synthesized anything into actionable talking points" },
            ].map(item => (
              <div key={item.time} style={{ background: 'var(--surface)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 12, padding: '22px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#f87171', marginBottom: 8 }}>{item.time}</div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{item.label}</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65 }}>{item.pain}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 44 }}>
            <div style={{ display: 'inline-block', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 14, padding: '22px 48px' }}>
              <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 6 }}>2 hours every morning.</div>
              <div style={{ fontSize: 15, color: 'var(--text-2)' }}>That's 500+ hours a year not spent with clients.</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Sample Briefing Preview ── */}
      <section style={{ padding: '80px 24px', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>What You'll Receive</div>
            <h2 style={{ fontSize: 'clamp(24px, 3vw, 38px)', fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>A real analyst briefing. Every morning.</h2>
            <p style={{ color: 'var(--text-2)', fontSize: 15, marginTop: 12, maxWidth: 520, margin: '12px auto 0', lineHeight: 1.7 }}>
              Here's what lands in your inbox at 7:30am — specific to your holdings, not generic market news.
            </p>
          </div>

          <div className="card card-glow" style={{ padding: 0, overflow: 'hidden', maxWidth: 780, margin: '0 auto' }}>
            <div style={{ background: 'linear-gradient(135deg, rgba(79,124,246,0.15), rgba(6,182,212,0.08))', borderBottom: '1px solid var(--border)', padding: '20px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 4 }}>Morning Briefing · Sample</div>
                <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em' }}>Monday, May 13, 2026</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['AAPL', 'MSFT', 'JPM', 'BRK.B'].map(t => <span key={t} className="chip">{t}</span>)}
              </div>
            </div>

            {SAMPLE_SECTIONS.map((s, i) => (
              <div key={i} style={{ padding: '18px 28px', borderBottom: i < SAMPLE_SECTIONS.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{s.label}</div>
                  {s.badge && (
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', padding: '2px 8px', borderRadius: 20, background: `${s.badgeColor}20`, color: s.badgeColor, border: `1px solid ${s.badgeColor}35` }}>{s.badge}</span>
                  )}
                  {s.hasDraft && (
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', padding: '2px 8px', borderRadius: 20, background: 'rgba(79,124,246,0.1)', color: 'var(--accent)', border: '1px solid rgba(79,124,246,0.25)' }}>✦ Draft email ready</span>
                  )}
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.75 }}>{s.content}</div>
              </div>
            ))}

            <div style={{ background: 'rgba(79,124,246,0.04)', borderTop: '1px solid var(--border)', padding: '14px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>Generated 7:28am ET · Powered by Claude AI</div>
              <button className="btn btn-primary" onClick={() => navigate('/onboarding')} style={{ fontSize: 12, padding: '7px 16px' }}>Get This Daily →</button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: '80px 24px', maxWidth: 1080, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>What You Get</div>
          <h2 style={{ fontSize: 'clamp(24px, 3vw, 38px)', fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>Everything you need before market open</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {FEATURES.map(f => (
            <div key={f.title} className="card" style={{ padding: '32px 28px' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, rgba(79,124,246,0.15), rgba(6,182,212,0.08))', border: '1px solid rgba(79,124,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'var(--accent)', marginBottom: 20 }}>{f.icon}</div>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12, letterSpacing: '-0.02em' }}>{f.title}</div>
              <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section style={{ padding: '80px 24px', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>How It Works</div>
            <h2 style={{ fontSize: 'clamp(24px, 3vw, 38px)', fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>Set up once. Intelligence delivered daily.</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 32 }}>
            {STEPS.map(s => (
              <div key={s.n}>
                <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: '-0.04em', color: 'rgba(79,124,246,0.15)', lineHeight: 1, marginBottom: 16 }}>{s.n}</div>
                <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', marginBottom: 10 }}>{s.title}</div>
                <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comparison Table ── */}
      <section style={{ padding: '100px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>The Alternative</div>
            <h2 style={{ fontSize: 'clamp(24px, 3vw, 38px)', fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>Your other options cost more.<br />And do less.</h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 580 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '14px 20px', fontWeight: 600, fontSize: 13, color: 'var(--text-2)', borderBottom: '2px solid var(--border)' }}></th>
                  <th style={{ textAlign: 'center', padding: '14px 20px', borderBottom: '2px solid var(--accent)', background: 'rgba(79,124,246,0.06)' }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--accent)' }}>VeloQuant</div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600, marginTop: 2 }}>$299/mo</div>
                  </th>
                  <th style={{ textAlign: 'center', padding: '14px 20px', borderBottom: '2px solid var(--border)' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-2)' }}>Bloomberg Terminal</div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500, marginTop: 2 }}>$2,000+/mo</div>
                  </th>
                  <th style={{ textAlign: 'center', padding: '14px 20px', borderBottom: '2px solid var(--border)' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-2)' }}>Manual Research</div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500, marginTop: 2 }}>2+ hrs/day</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Portfolio-specific briefing', true, false, false],
                  ['SEC filing monitoring', true, 'Manual', 'Manual'],
                  ['AI-generated insights', true, false, false],
                  ['Client email drafts', true, false, false],
                  ['Delivered to your inbox', true, false, false],
                  ['Price & news monitoring', true, true, 'Manual'],
                  ['No learning curve', true, false, true],
                  ['Setup time', '60 seconds', 'Days + training', 'None'],
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '13px 20px', fontSize: 13.5, color: 'var(--text-2)' }}>{row[0]}</td>
                    {[row[1], row[2], row[3]].map((cell, ci) => (
                      <td key={ci} style={{ padding: '13px 20px', textAlign: 'center', background: ci === 0 ? 'rgba(79,124,246,0.04)' : 'transparent', fontSize: 13 }}>
                        {cell === true ? <span style={{ color: 'var(--success)', fontSize: 17 }}>✓</span>
                          : cell === false ? <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: 17 }}>—</span>
                          : <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{cell}</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Built For ── */}
      <section style={{ padding: '80px 24px', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>Built For</div>
            <h2 style={{ fontSize: 'clamp(24px, 3vw, 38px)', fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>Designed for independent advisors.<br />Not everyone.</h2>
            <p style={{ color: 'var(--text-2)', fontSize: 15, maxWidth: 540, margin: '16px auto 0', lineHeight: 1.7 }}>
              Purpose-built for the RIA who manages real money without a team of analysts behind them.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginBottom: 24 }}>
            {[
              { icon: '◆', title: 'Solo RIAs', range: '$20M – $150M AUM', desc: 'You wear every hat. VeloQuant gives you analyst-level prep without the analyst salary.' },
              { icon: '◈', title: 'Ensemble Practices', range: '$150M – $500M AUM', desc: 'A unified briefing your whole team can act on — consistent talking points across advisors.' },
              { icon: '◇', title: 'Financial Planners', range: 'Fee-only · Investment-integrated', desc: 'Keep clients informed on holdings without spending your planning hours on market research.' },
            ].map(item => (
              <div key={item.title} className="card" style={{ padding: '28px 24px' }}>
                <div style={{ fontSize: 20, color: 'var(--accent)', marginBottom: 14 }}>{item.icon}</div>
                <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em', marginBottom: 4 }}>{item.title}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.06em', marginBottom: 12 }}>{item.range}</div>
                <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.7 }}>{item.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 24px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>⚠</div>
            <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.65 }}>
              <strong style={{ color: 'var(--text)' }}>Not designed for:</strong> Hedge funds, wirehouses, retail investors, or anyone needing real-time execution data. VeloQuant is a morning prep tool — not a trading platform.
            </div>
          </div>
        </div>
      </section>

      {/* ── Security & Compliance ── */}
      <section style={{ padding: '100px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 80% 50%, rgba(16,185,129,0.04) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--success)', marginBottom: 12 }}>Security & Compliance</div>
            <h2 style={{ fontSize: 'clamp(24px, 3vw, 42px)', fontWeight: 900, letterSpacing: '-0.04em', margin: 0 }}>Zero client data. Ever.</h2>
            <p style={{ color: 'var(--text-2)', fontSize: 15, maxWidth: 480, margin: '16px auto 0', lineHeight: 1.7 }}>
              Designed to never touch your clients' information — by architecture, not policy.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            {[
              { icon: '⊘', title: 'Tickers only', desc: 'You enter stock symbols — never client names, account numbers, or portfolio values. Nothing to disclose or protect.' },
              { icon: '⊕', title: 'Encrypted everywhere', desc: 'All data encrypted in transit (TLS 1.3) and at rest (AES-256). No plaintext storage of any user data.' },
              { icon: '⊙', title: 'No CRM access', desc: 'Completely siloed from your custodian, CRM, and compliance systems. No integrations that could expose client data.' },
              { icon: '⊛', title: 'You control the emails', desc: 'AI-drafted client emails are templates for your review. Nothing sent automatically. You send from your own system.' },
            ].map(item => (
              <div key={item.title} className="card" style={{ padding: '26px 24px', borderColor: 'rgba(16,185,129,0.15)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'var(--success)', marginBottom: 14 }}>{item.icon}</div>
                <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>{item.title}</div>
                <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.7 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section style={{ padding: '80px 24px', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>From Advisors</div>
            <h2 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>What advisors are saying</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            {[
              { quote: "I used to spend the first 90 minutes of every day just getting up to speed. Now my briefing is waiting when I wake up. It's changed how I start every single morning.", name: 'Michael T.', role: 'Independent RIA · $85M AUM · Austin, TX' },
              { quote: "The SEC filing alerts alone are worth it. I caught a material 8-K on one of my client's largest positions before the market opened — and had a draft email ready to send.", name: 'Sarah K.', role: 'CFP · Ensemble Practice · Chicago, IL' },
              { quote: "I was skeptical of AI for anything compliance-adjacent. But this is just research automation — no different than a Bloomberg alert, except actually readable.", name: 'David R.', role: 'Fee-Only RIA · $220M AUM · Denver, CO' },
            ].map((t, i) => (
              <div key={i} className="card" style={{ padding: '28px 24px' }}>
                <div style={{ fontSize: 36, color: 'var(--accent)', opacity: 0.25, lineHeight: 1, marginBottom: 14, fontFamily: 'Georgia, serif' }}>"</div>
                <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.8, marginBottom: 20, fontStyle: 'italic' }}>{t.quote}</div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section style={{ padding: '100px 24px', maxWidth: 540, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>Pricing</div>
        <h2 style={{ fontSize: 'clamp(24px, 3vw, 38px)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 40 }}>Simple, transparent pricing</h2>
        <div className="card card-glow" style={{ padding: '40px 36px', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 52, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}>$299</span>
            <span style={{ fontSize: 18, color: 'var(--text-2)', paddingBottom: 6 }}>/month</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, marginBottom: 28 }}>14-day free trial · Cancel anytime</div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24, marginBottom: 28 }}>
            {['Daily morning intelligence briefing', 'SEC filing alerts for all holdings', 'AI-drafted client communication emails', 'Portfolio price monitoring overnight', 'Delivered to your inbox by 7:30am ET', 'Unlimited holdings tracked'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ color: 'var(--success)', fontSize: 14, flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: 14, color: 'var(--text-2)' }}>{f}</span>
              </div>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/onboarding')} style={{ width: '100%', justifyContent: 'center', padding: '14px 18px', fontSize: 15 }}>
            Start Your Free Trial →
          </button>
          <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: 'var(--text-2)' }}>
            Cancel before your trial ends and pay nothing.
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ padding: '80px 24px', maxWidth: 720, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>FAQ</div>
          <h2 style={{ fontSize: 'clamp(24px, 3vw, 38px)', fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>Common questions</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FAQS.map((faq, i) => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{ width: '100%', background: 'none', border: 'none', padding: '18px 22px', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, fontFamily: 'inherit' }}
              >
                <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)', lineHeight: 1.4 }}>{faq.q}</span>
                <span style={{ color: 'var(--accent)', fontSize: 22, lineHeight: 1, flexShrink: 0, fontWeight: 300 }}>{openFaq === i ? '−' : '+'}</span>
              </button>
              {openFaq === i && (
                <div style={{ padding: '0 22px 20px', fontSize: 14, color: 'var(--text-2)', lineHeight: 1.8, borderTop: '1px solid var(--border)' }}>
                  <div style={{ paddingTop: 16 }}>{faq.a}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section style={{ padding: '100px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(79,124,246,0.1) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 620, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 20 }}>Get Started</div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 50px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.12, marginBottom: 20 }}>
            Your first briefing could be{' '}
            <span style={{ background: 'linear-gradient(120deg, var(--accent), var(--accent-b))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              tomorrow morning.
            </span>
          </h2>
          <p style={{ fontSize: 17, color: 'var(--text-2)', lineHeight: 1.75, maxWidth: 480, margin: '0 auto 40px' }}>
            Set up your holdings in 60 seconds. Your personalized briefing arrives at 7:30am the next trading day. Try it free for 14 days.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/onboarding')} style={{ fontSize: 16, padding: '16px 40px' }}>
            Start Your Free Trial →
          </button>
          <div style={{ marginTop: 16, fontSize: 13, color: 'var(--text-2)' }}>
            14-day free trial · Cancel before it ends and pay nothing
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto', padding: '48px 40px 32px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 40, marginBottom: 48 }}>
            <div style={{ gridColumn: 'span 1', minWidth: 180 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 27, height: 27, borderRadius: 7, background: 'linear-gradient(135deg, var(--accent), var(--accent-b))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', fontWeight: 900 }}>◆</div>
                <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: '-0.02em' }}>VeloQuant</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 }}>Morning intelligence for independent financial advisors.</div>
            </div>

            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-2)', opacity: 0.55, marginBottom: 16 }}>Product</div>
              {[{ label: 'Start Free Trial', path: '/onboarding' }, { label: 'Sign In', path: '/signin' }].map(item => (
                <div key={item.label} style={{ marginBottom: 10 }}>
                  <button onClick={() => navigate(item.path)} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: 13, padding: 0, fontFamily: 'inherit', textAlign: 'left' }}>{item.label}</button>
                </div>
              ))}
            </div>

            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-2)', opacity: 0.55, marginBottom: 16 }}>Legal</div>
              {[{ label: 'Privacy Policy', path: '/privacy' }, { label: 'Terms of Service', path: '/terms' }, { label: 'Disclaimer', path: '/disclaimer' }].map(item => (
                <div key={item.label} style={{ marginBottom: 10 }}>
                  <button onClick={() => navigate(item.path)} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: 13, padding: 0, fontFamily: 'inherit', textAlign: 'left' }}>{item.label}</button>
                </div>
              ))}
            </div>

            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-2)', opacity: 0.55, marginBottom: 16 }}>Contact</div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10 }}>
                <a href="mailto:support@veloquant.net" style={{ color: 'var(--text-2)', textDecoration: 'none' }}>support@veloquant.net</a>
              </div>
              <button onClick={() => navigate('/contact')} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: 13, padding: 0, fontFamily: 'inherit', textAlign: 'left' }}>Contact Form</button>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-2)', opacity: 0.55 }}>© 2026 VeloQuant. All rights reserved.</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', opacity: 0.45 }}>Not investment advice. For informational and productivity purposes only.</div>
          </div>
        </div>
      </footer>

    </div>
  )
}
