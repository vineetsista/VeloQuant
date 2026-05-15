import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import BriefingRenderer from '../components/BriefingRenderer'
import usePageTitle from '../hooks/usePageTitle'

const KEYFRAMES = `
@keyframes drift {
  0% { background-position: 0 0 }
  100% { background-position: 60px 60px }
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1) }
  50% { opacity: 0.3; transform: scale(0.7) }
}
@keyframes gradient-shift {
  0% { background-position: 0% 50% }
  50% { background-position: 100% 50% }
  100% { background-position: 0% 50% }
}
@keyframes ticker-scroll {
  0% { transform: translateX(0) }
  100% { transform: translateX(-50%) }
}
@keyframes fade-up {
  from { opacity: 0; transform: translateY(24px) }
  to { opacity: 1; transform: translateY(0) }
}
@keyframes glow-cta {
  0%, 100% { box-shadow: 0 0 22px rgba(79,124,246,0.28) }
  50% { box-shadow: 0 0 44px rgba(79,124,246,0.52) }
}
@keyframes slide-in-up {
  from { opacity: 0; transform: translateY(16px) }
  to { opacity: 1; transform: translateY(0) }
}
@keyframes count-up {
  from { opacity: 0 }
  to { opacity: 1 }
}
.vq-reveal {
  opacity: 0;
  transform: translateY(28px);
  transition: opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1);
}
.vq-revealed { opacity: 1 !important; transform: translateY(0) !important; }
.vq-child {
  opacity: 0;
  transform: translateY(18px);
  transition: opacity 0.55s cubic-bezier(0.16,1,0.3,1), transform 0.55s cubic-bezier(0.16,1,0.3,1);
}
.vq-child.vq-revealed { opacity: 1; transform: translateY(0); }
.vq-card-hover {
  transition: transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease;
}
.vq-card-hover:hover {
  transform: translateY(-5px);
  border-color: rgba(79,124,246,0.3) !important;
  box-shadow: 0 20px 48px rgba(79,124,246,0.1);
}
.vq-tab { cursor: pointer; transition: color 0.18s, border-color 0.18s, background 0.18s; }
.vq-tab:hover { color: var(--text) !important; }
`

const TICKER_ITEMS = [
  { label: 'SPY', value: '+0.82%', up: true },
  { label: 'QQQ', value: '+1.14%', up: true },
  { label: 'TLT', value: '-0.23%', up: false },
  { label: 'GLD', value: '+0.44%', up: true },
  { label: 'VIX', value: '18.4', up: null },
  { label: 'DXY', value: '104.2', up: null },
  { label: 'IWM', value: '+0.67%', up: true },
  { label: 'DIA', value: '+0.51%', up: true },
  { label: 'BRK.B', value: '+0.33%', up: true },
  { label: 'AAPL', value: '+1.21%', up: true },
  { label: 'MSFT', value: '+0.87%', up: true },
  { label: 'JPM', value: '-0.34%', up: false },
]

const BRIEFING_TAB = [
  {
    label: 'AAPL — Apple Inc.',
    badge: '▲ +1.21%', badgeColor: '#10d97b',
    content: 'Apple closed at $194.32, up 1.21% on above-average volume (1.4× 30-day avg). Services revenue beat by $400M in the latest quarter; management raised FY guidance citing AI feature adoption across 2.2B active devices. Analyst consensus: 38 Buy, 6 Hold, 1 Sell — consensus target $212 vs. today\'s $189 (12% upside priced in). No material SEC filings in past 72 hours. Earnings in 18 days — whisper EPS $1.62 vs. consensus $1.57.',
  },
  {
    label: 'JPM — JPMorgan Chase',
    badge: 'NEW 8-K', badgeColor: '#4f7cf6', hasDraft: true,
    content: 'JPMorgan filed an 8-K disclosing CFO Jeremy Barnum\'s planned departure in Q3 2026. Stock reaction muted pre-market (-0.3%). Net interest income held flat at $23.1B despite rate uncertainty; credit loss provisions increased $600M YoY — management signaling caution on consumer credit into Q2. Short volume at 58% (elevated above 55% threshold, flag for monitoring).',
  },
  {
    label: 'MSFT — Microsoft',
    badge: '▲ +0.87%', badgeColor: '#10d97b',
    content: 'Azure growth reaccelerated to 31% YoY vs. 29% Street estimate — second consecutive beat. Copilot enterprise seats crossed 500K, up 3× in 90 days. CFO filed a Form 4 on May 9 — sold 12,400 shares at $415.20 ($5.1M), routine exercise under 10b5-1 plan, not a bearish signal. Short volume 43% (normal). No open SEC inquiries.',
  },
  {
    label: 'Market Macro',
    badge: 'Constructive', badgeColor: '#f59e0b',
    content: 'S&P 500 futures +0.1%, Nasdaq flat. 10-year Treasury yield stable at 4.42% — no rate catalyst overnight. VIX at 18.4, declining from 21.2 last week — options market pricing reduced near-term uncertainty. DXY 104.2, flat. No Fed speakers today. Key risk: CPI print Thursday 8:30am ET (consensus +3.1% YoY). Position accordingly ahead of that data.',
  },
]

const FILING_TAB = {
  ticker: 'AAPL',
  type: '8-K',
  filed: 'May 13, 2026 · 4:02pm ET',
  headline: '$110 Billion Share Buyback Authorization',
  summary: 'Apple filed an 8-K reporting a $110B share buyback authorization — the largest in company history, surpassing the previous $90B program announced in 2023. Key clause: repurchase activity accelerates automatically if the stock trades below $175 for 5 consecutive sessions. The filing also disclosed a 4% dividend increase to $0.26/share quarterly.',
  insight: 'At current price ($194), the buyback represents ~5.7% of market cap. Historically, Apple executes buybacks aggressively — $90B of the prior program was deployed in 18 months. This is a meaningful positive for EPS accretion and signals management confidence in free cash flow sustainability.',
  action: 'Draft client email ready — highlights the buyback authorization and dividend increase in plain language for client communication.',
}

const EMAIL_TAB = {
  subject: 'Apple Announces Record $110B Share Buyback — What It Means For You',
  preview: 'Good morning,\n\nI wanted to share a quick update on Apple (AAPL), which you hold in your portfolio.\n\nLast evening, Apple announced a $110 billion share buyback authorization — the largest in the company\'s history. Here\'s what this means for you as a shareholder:\n\n• The buyback reduces the total number of shares outstanding, which increases the value of each remaining share you hold\n• Apple also raised its quarterly dividend by 4% to $0.26 per share\n• Management\'s decision to deploy this much capital signals strong confidence in Apple\'s free cash flow\n\nThis is a positive development for your position. No action is required on your part.\n\nAs always, please don\'t hesitate to reach out with any questions.\n\nWarm regards,\n[Your Name]',
}

const FEATURES = [
  { icon: '≋', title: 'Morning Briefing', desc: 'Portfolio-specific AI briefing at 7:30am ET. Every claim tied to a source — price, filing, or analyst data. No hallucinated ratings, no generic commentary.' },
  { icon: '◎', title: 'SEC Filing Alerts', desc: 'Real-time EDGAR monitoring for every holding. Material 8-Ks, 10-Qs, and insider Form 4 transactions surface the moment they post.' },
  { icon: '✦', title: 'Client Email Drafts', desc: 'AI-drafted emails for earnings, filings, and price moves. Plain English, your voice, ready to review and send in 30 seconds.' },
  { icon: '◉', title: 'Portfolio Analytics', desc: 'Allocation donut, sector breakdown, concentration risk, 30-day sparklines, TLH candidates, and benchmark comparison — updated daily.' },
  { icon: '⬡', title: 'Analyst Consensus', desc: 'Real buy/hold/sell counts and price targets from Finnhub. Verified live data, not stale training-data estimates.' },
  { icon: '◈', title: 'FINRA Short Volume', desc: 'Daily short sale pressure for every holding. Know when short volume spikes above 65% before the market reacts.' },
]

const STEPS = [
  { n: '01', title: 'Add your holdings', desc: 'Enter tickers — nothing else. No client names, no account numbers. Takes 60 seconds.' },
  { n: '02', title: 'We work overnight', desc: 'SEC filings, analyst consensus, insider transactions, short volume, earnings — all pulled and synthesized automatically.' },
  { n: '03', title: 'Read in 10 minutes', desc: 'By 7:30am ET every weekday, a sharp, specific briefing lands in your inbox. Everything you need before market open.' },
]

const FAQS = [
  { q: 'Does this store any client data?', a: 'No. You enter stock tickers only — never client names, account numbers, or portfolio values. There is nothing to disclose to your compliance department.' },
  { q: 'How is this different from Bloomberg?', a: 'Bloomberg gives you everything and filters nothing. VeloQuant gives you only what matters for your specific book, synthesized into a readable briefing, at 1/20th the cost.' },
  { q: 'What data sources power the briefings?', a: 'SEC EDGAR (real-time filings), Polygon.io (market data), Finnhub (100+ news sources, earnings calendar, analyst consensus), FINRA daily short volume, and SEC Form 4 insider transactions. All verified — no hallucinated data.' },
  { q: 'What if the AI gets something wrong?', a: 'Every factual claim cites a source. VeloQuant is a research starting point — you verify, you decide. That\'s why the disclaimer is prominent and AI drafts are never sent automatically.' },
  { q: 'Can I cancel anytime?', a: "Yes. Cancel before your 14-day trial ends and you'll never be charged. After subscribing, cancel anytime and retain access through the end of your billing period." },
  { q: 'Is this compliant with FINRA/SEC marketing rules?', a: 'VeloQuant generates internal research summaries and draft communications for your review. You approve everything before it reaches clients. Consult your compliance consultant for firm-specific guidance.' },
]

const PROGRESS_MESSAGES = [
  'Pulling SEC filings from EDGAR...',
  'Fetching Finnhub news from 100+ sources...',
  'Checking earnings calendar...',
  'Loading analyst consensus data...',
  'Retrieving FINRA short volume...',
  'Scanning Form 4 insider transactions...',
  'Synthesizing with Claude AI...',
]

export default function Landing() {
  usePageTitle('Morning Intelligence for Independent Advisors')
  const [openFaq, setOpenFaq] = useState(null)
  const [tickers, setTickers] = useState('')
  const [loading, setLoading] = useState(false)
  const [msgIdx, setMsgIdx] = useState(0)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState(0)
  const resultRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const el = document.createElement('style')
    el.textContent = KEYFRAMES
    document.head.appendChild(el)
    return () => document.head.removeChild(el)
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('vq-revealed')
        entry.target.querySelectorAll('.vq-child').forEach((child, i) => {
          setTimeout(() => child.classList.add('vq-revealed'), i * 90)
        })
      })
    }, { threshold: 0.1 })
    document.querySelectorAll('.vq-reveal').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!loading) return
    const msgT = setInterval(() => setMsgIdx(i => (i + 1) % PROGRESS_MESSAGES.length), 3500)
    const progT = setInterval(() => setProgress(p => Math.min(p + 1.4, 92)), 700)
    return () => { clearInterval(msgT); clearInterval(progT) }
  }, [loading])

  useEffect(() => {
    if (result && resultRef.current) {
      setTimeout(() => resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
  }, [result])

  async function handleGenerate(e) {
    e.preventDefault()
    if (!tickers.trim()) return
    setLoading(true); setError(null); setResult(null); setMsgIdx(0); setProgress(0)
    try {
      const data = await api.demoGenerate(tickers)
      setProgress(100); setResult(data)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const gradientText = {
    background: 'linear-gradient(120deg, var(--accent), var(--accent-b), var(--accent))',
    backgroundSize: '200% auto',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    animation: 'gradient-shift 4s ease infinite',
    display: 'inline',
  }

  const TABS = ['Morning Briefing', 'Filing Alert', 'Client Email Draft']

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Inter, sans-serif', overflowX: 'hidden' }}>

      {/* Dot grid background */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'radial-gradient(circle, rgba(79,124,246,0.09) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
        animation: 'drift 30s linear infinite',
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* ── Ticker Tape ── */}
        <div style={{ background: 'rgba(79,124,246,0.04)', borderBottom: '1px solid var(--border)', height: 32, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', animation: 'ticker-scroll 38s linear infinite', whiteSpace: 'nowrap', willChange: 'transform' }}>
            {[...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 20px', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', fontFamily: 'monospace', borderRight: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-2)', opacity: 0.65 }}>{item.label}</span>
                <span style={{ color: item.up === true ? 'var(--success)' : item.up === false ? 'var(--danger)' : 'var(--text-2)' }}>{item.value}</span>
              </span>
            ))}
          </div>
        </div>

        {/* ── Nav ── */}
        <nav style={{
          position: 'sticky', top: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 40px', height: 64,
          background: 'rgba(5,12,24,0.96)', backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border)',
        }}>
          <img src="/veloquant-logo.svg" alt="VeloQuant" style={{ height: 38 }} />
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button onClick={() => navigate('/signin')} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', padding: '8px 12px' }}>Sign In</button>
            <button className="btn btn-primary" onClick={() => navigate('/onboarding')} style={{ fontSize: 13, padding: '8px 18px', animation: 'glow-cta 3s ease-in-out infinite' }}>
              Start Free Trial →
            </button>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section style={{ padding: '96px 24px 80px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -300, left: '50%', transform: 'translateX(-50%)', width: 1000, height: 800, background: 'radial-gradient(ellipse, rgba(79,124,246,0.07) 0%, transparent 68%)', pointerEvents: 'none' }} />

          <div style={{ maxWidth: 800, margin: '0 auto', position: 'relative', animation: 'fade-up 0.9s cubic-bezier(0.16,1,0.3,1) both' }}>

            {/* Live badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(79,124,246,0.1)', border: '1px solid rgba(79,124,246,0.22)', borderRadius: 20, padding: '5px 16px', marginBottom: 32 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', animation: 'pulse-dot 2s ease-in-out infinite' }} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent)' }}>For Independent Financial Advisors</span>
            </div>

            <h1 style={{ fontSize: 'clamp(40px, 6vw, 76px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.04, margin: '0 0 28px' }}>
              Goldman Sachs Has a<br />Team of Analysts.{' '}
              <span style={gradientText}>Now So Do You.</span>
            </h1>

            <p style={{ fontSize: 19, color: 'var(--text-2)', maxWidth: 620, margin: '0 auto 48px', lineHeight: 1.75 }}>
              Every weekday at 7:30am, VeloQuant delivers a personalized AI briefing covering your exact holdings — overnight moves, SEC filings, analyst data, insider transactions, and client talking points. In 10 minutes, not 2 hours.
            </p>

            {/* Demo input — the hero CTA */}
            <form onSubmit={handleGenerate} style={{ maxWidth: 600, margin: '0 auto 16px' }}>
              <div style={{ display: 'flex', background: 'var(--surface-2)', border: '1px solid rgba(79,124,246,0.25)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 0 60px rgba(79,124,246,0.1)' }}>
                <input
                  value={tickers} onChange={e => setTickers(e.target.value)}
                  placeholder="Enter tickers: AAPL, MSFT, JPM, BRK.B"
                  disabled={loading}
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', padding: '16px 20px', fontSize: 16, color: 'var(--text)', fontFamily: 'inherit' }}
                />
                <button type="submit" disabled={loading || !tickers.trim()} className="btn btn-primary" style={{ borderRadius: 0, padding: '16px 28px', fontSize: 15, fontWeight: 700, border: 'none', flexShrink: 0 }}>
                  {loading ? <><div className="spin spin-sm" />Analyzing...</> : 'Generate Briefing →'}
                </button>
              </div>
            </form>

            <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 56 }}>No account required · Up to 10 tickers · Takes ~60 seconds</div>

            {/* Trust pills */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
              {[
                { icon: '◆', text: '14-day free trial' },
                { icon: '⊘', text: 'Zero client data stored' },
                { icon: '✓', text: 'Cancel anytime' },
                { icon: '◎', text: 'SEC EDGAR monitored' },
              ].map(p => (
                <div key={p.text} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '6px 14px', fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>
                  <span style={{ color: 'var(--accent)', fontSize: 10 }}>{p.icon}</span>
                  {p.text}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Loading / Error / Result ── */}
        {loading && (
          <section style={{ padding: '0 24px 60px', maxWidth: 720, margin: '0 auto' }}>
            <div className="card card-glow" style={{ padding: 40, textAlign: 'center' }}>
              <div className="spin" style={{ margin: '0 auto 20px', width: 36, height: 36, borderWidth: 3 }} />
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Analyzing your portfolio...</div>
              <div style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 500, marginBottom: 28, minHeight: 20 }}>{PROGRESS_MESSAGES[msgIdx]}</div>
              <div style={{ background: 'var(--surface-2)', borderRadius: 4, height: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, var(--accent), var(--accent-b))', width: `${progress}%`, transition: 'width 0.7s ease' }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 12 }}>Pulling SEC filings, analyst data, short volume, and news simultaneously</div>
            </div>
          </section>
        )}
        {error && !loading && (
          <section style={{ padding: '0 24px 40px', maxWidth: 720, margin: '0 auto' }}>
            <div className="error-bar">{error}</div>
          </section>
        )}
        {result && !loading && (
          <section ref={resultRef} style={{ padding: '0 24px 60px', maxWidth: 860, margin: '0 auto' }}>
            <div className="card card-glow" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg, rgba(79,124,246,0.12), rgba(6,182,212,0.06))', borderBottom: '1px solid var(--border)', padding: '24px 32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 6 }}>Your Morning Briefing</div>
                  <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>{date}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{result.tickers.map(t => <span key={t} className="chip" style={{ marginRight: 6 }}>{t}</span>)}</div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => { setResult(null); setTickers('') }}>New Demo</button>
                  <button className="btn btn-primary" onClick={() => navigate('/onboarding')} style={{ fontSize: 13 }}>Start Free Trial →</button>
                </div>
              </div>
              <div style={{ padding: '32px' }}><BriefingRenderer content={result.briefing} /></div>
              <div style={{ background: 'rgba(79,124,246,0.05)', borderTop: '1px solid var(--border)', padding: '24px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>This runs automatically every weekday at 7:30am ET.</div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)' }}>14-day free trial. Cancel anytime.</div>
                </div>
                <button className="btn btn-primary" onClick={() => navigate('/onboarding')} style={{ padding: '12px 24px', fontSize: 14 }}>Set Up My Account →</button>
              </div>
            </div>
          </section>
        )}

        {/* ── Stats Strip ── */}
        <div className="vq-reveal" style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'rgba(79,124,246,0.03)' }}>
          <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 0 }}>
            {[
              { val: '7:30am ET', label: 'Delivered every weekday', icon: '◆' },
              { val: '6 sources', label: 'Per briefing, verified', icon: '◈' },
              { val: '< 90s', label: 'Briefing generation time', icon: '≋' },
              { val: '$0', label: 'Client data stored, ever', icon: '⊘' },
              { val: '100+', label: 'News sources via Finnhub', icon: '◎' },
            ].map((s, i) => (
              <div key={s.label} className="vq-child" style={{ textAlign: 'center', padding: '8px 24px', borderLeft: i > 0 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 8 }}>{s.icon}</div>
                <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.04em', marginBottom: 6, background: 'linear-gradient(120deg, var(--text), var(--accent-b))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{s.val}</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Product Showcase — Tabbed ── */}
        <section className="vq-reveal" style={{ padding: '100px 24px' }}>
          <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 52 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>The Product</div>
              <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 42px)', fontWeight: 900, letterSpacing: '-0.04em', margin: '0 0 16px' }}>This lands in your inbox at 7:30am.</h2>
              <p style={{ fontSize: 15, color: 'var(--text-2)', maxWidth: 500, margin: '0 auto', lineHeight: 1.7 }}>
                Not a summary of the market. A briefing about your holdings — with specific numbers, specific implications, and a draft email ready to send.
              </p>
            </div>

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderBottom: 'none', borderRadius: '14px 14px 0 0', overflow: 'hidden' }}>
              {TABS.map((tab, i) => (
                <button
                  key={tab}
                  className="vq-tab"
                  onClick={() => setActiveTab(i)}
                  style={{
                    flex: 1, background: activeTab === i ? 'var(--surface-2)' : 'none',
                    border: 'none', borderRight: i < TABS.length - 1 ? '1px solid var(--border)' : 'none',
                    borderBottom: activeTab === i ? '2px solid var(--accent)' : '2px solid transparent',
                    padding: '16px 20px', fontFamily: 'inherit',
                    fontSize: 13, fontWeight: activeTab === i ? 700 : 500,
                    color: activeTab === i ? 'var(--text)' : 'var(--text-2)',
                    cursor: 'pointer',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 14px 14px', overflow: 'hidden' }}>

              {/* Tab 0: Morning Briefing */}
              {activeTab === 0 && (
                <div style={{ animation: 'slide-in-up 0.3s ease both' }}>
                  <div style={{ background: 'linear-gradient(135deg, rgba(79,124,246,0.1), rgba(6,182,212,0.05))', borderBottom: '1px solid var(--border)', padding: '20px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 4 }}>Morning Briefing · Sample</div>
                      <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em' }}>{date}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {['AAPL', 'JPM', 'MSFT', 'BRK.B'].map(t => <span key={t} className="chip">{t}</span>)}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(16,217,123,0.1)', border: '1px solid rgba(16,217,123,0.22)', borderRadius: 20, padding: '3px 10px', marginLeft: 4 }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--success)', animation: 'pulse-dot 2s ease-in-out infinite' }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--success)', letterSpacing: '0.08em' }}>GENERATED 7:28am ET</span>
                      </div>
                    </div>
                  </div>
                  {BRIEFING_TAB.map((s, i) => (
                    <div key={i} style={{ padding: '20px 28px', borderBottom: i < BRIEFING_TAB.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: '-0.01em' }}>{s.label}</div>
                        {s.badge && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${s.badgeColor}20`, color: s.badgeColor, border: `1px solid ${s.badgeColor}35` }}>{s.badge}</span>}
                        {s.hasDraft && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(79,124,246,0.1)', color: 'var(--accent)', border: '1px solid rgba(79,124,246,0.25)' }}>✦ Draft email ready</span>}
                      </div>
                      <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.78 }}>{s.content}</div>
                    </div>
                  ))}
                  <div style={{ background: 'rgba(79,124,246,0.04)', borderTop: '1px solid var(--border)', padding: '14px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-2)' }}>Generated by Claude AI · Powered by SEC EDGAR, Finnhub, FINRA, Polygon.io</div>
                    <button className="btn btn-primary" onClick={() => navigate('/onboarding')} style={{ fontSize: 12, padding: '7px 16px' }}>Get This Daily →</button>
                  </div>
                </div>
              )}

              {/* Tab 1: Filing Alert */}
              {activeTab === 1 && (
                <div style={{ animation: 'slide-in-up 0.3s ease both' }}>
                  <div style={{ background: 'rgba(79,124,246,0.07)', borderBottom: '1px solid var(--border)', padding: '16px 28px', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', letterSpacing: '0.08em' }}>NEW 8-K FILING</span>
                    <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600 }}>{FILING_TAB.ticker} · Apple Inc. · {FILING_TAB.filed}</span>
                  </div>
                  <div style={{ padding: '28px 28px' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16 }}>{FILING_TAB.headline}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                      <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: 10 }}>Filing Summary</div>
                        <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.78 }}>{FILING_TAB.summary}</div>
                      </div>
                      <div style={{ background: 'rgba(79,124,246,0.06)', border: '1px solid rgba(79,124,246,0.18)', borderRadius: 12, padding: '20px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 10 }}>AI Insight for Your Portfolio</div>
                        <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.78 }}>{FILING_TAB.insight}</div>
                      </div>
                    </div>
                    <div style={{ background: 'rgba(16,217,123,0.06)', border: '1px solid rgba(16,217,123,0.2)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ color: 'var(--success)', fontSize: 18 }}>✦</span>
                      <div style={{ fontSize: 13.5, color: 'var(--text-2)' }}>{FILING_TAB.action}</div>
                      <button className="btn btn-primary" onClick={() => setActiveTab(2)} style={{ fontSize: 12, padding: '7px 16px', flexShrink: 0, marginLeft: 'auto' }}>View Draft →</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Client Email */}
              {activeTab === 2 && (
                <div style={{ animation: 'slide-in-up 0.3s ease both' }}>
                  <div style={{ background: 'rgba(79,124,246,0.07)', borderBottom: '1px solid var(--border)', padding: '16px 28px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(79,124,246,0.15)', color: 'var(--accent)', border: '1px solid rgba(79,124,246,0.3)', letterSpacing: '0.08em' }}>AI DRAFT · READY TO REVIEW</span>
                    <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>Generated from AAPL 8-K · Not sent automatically</span>
                  </div>
                  <div style={{ padding: '28px' }}>
                    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                      <div style={{ borderBottom: '1px solid var(--border)', padding: '14px 20px' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 4 }}>Subject</div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{EMAIL_TAB.subject}</div>
                      </div>
                      <div style={{ padding: '20px', fontSize: 14, color: 'var(--text-2)', lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>{EMAIL_TAB.preview}</div>
                    </div>
                    <div style={{ marginTop: 16, display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6, marginRight: 'auto' }}>
                        <span style={{ color: 'var(--success)' }}>⊘</span>
                        This email is never sent automatically. You review, edit, and send from your own email system.
                      </div>
                      <button className="btn btn-outline btn-sm" onClick={() => navigate('/onboarding')}>Edit Draft</button>
                      <button className="btn btn-primary" onClick={() => navigate('/onboarding')} style={{ fontSize: 12, padding: '7px 16px' }}>Get This Daily →</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Trust Bar (data sources) ── */}
        <div className="vq-reveal" style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '20px 40px', background: 'rgba(255,255,255,0.012)' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-2)', opacity: 0.5, marginRight: 28, flexShrink: 0 }}>Powered by</span>
            {[
              { name: 'Claude AI', sub: 'by Anthropic', icon: '◈' },
              { name: 'SEC EDGAR', sub: 'Real-time filings', icon: '⬡' },
              { name: 'Finnhub', sub: '100+ news sources', icon: '◇' },
              { name: 'FINRA', sub: 'Short volume data', icon: '◉' },
              { name: 'Polygon.io', sub: 'Market data', icon: '◆' },
            ].map((p, i) => (
              <div key={p.name} className="vq-child" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 22px', borderLeft: i > 0 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(79,124,246,0.1)', border: '1px solid rgba(79,124,246,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--accent)', flexShrink: 0 }}>{p.icon}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-2)', opacity: 0.65 }}>{p.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── The Problem ── */}
        <section className="vq-reveal" style={{ padding: '100px 24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 20% 50%, rgba(239,68,68,0.04) 0%, transparent 60%)', pointerEvents: 'none' }} />
          <div style={{ maxWidth: 960, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 60 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#f87171', marginBottom: 12 }}>The Problem</div>
              <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 900, letterSpacing: '-0.04em', margin: '0 auto', maxWidth: 680, lineHeight: 1.15 }}>Your morning research is eating your practice alive.</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16 }}>
              {[
                { time: '6:30am', label: 'Open Bloomberg', pain: "Scan headlines that don't filter to your specific holdings" },
                { time: '7:00am', label: 'Check SEC EDGAR', pain: 'Manually search filings across 20+ positions' },
                { time: '7:45am', label: 'Read earnings transcripts', pain: 'Hunt for 3 lines relevant to your investment thesis' },
                { time: '8:30am', label: 'Prep client calls', pain: "Still haven't synthesized anything into actionable talking points" },
              ].map(item => (
                <div key={item.time} className="vq-child vq-card-hover card" style={{ padding: '24px 20px', borderColor: 'rgba(239,68,68,0.1)' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(239,68,68,0.28)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(239,68,68,0.1)'}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#f87171', marginBottom: 8 }}>{item.time}</div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{item.label}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65 }}>{item.pain}</div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: 44 }}>
              <div style={{ display: 'inline-block', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 14, padding: '22px 48px' }}>
                <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 6 }}>2 hours every morning.</div>
                <div style={{ fontSize: 15, color: 'var(--text-2)' }}>That's 500+ hours a year not spent with clients.</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="vq-reveal" style={{ padding: '80px 24px', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ maxWidth: 1060, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 52 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>What You Get</div>
              <h2 style={{ fontSize: 'clamp(24px, 3vw, 38px)', fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>Everything you need before market open</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 20 }}>
              {FEATURES.map(f => (
                <div key={f.title} className="vq-child vq-card-hover card" style={{ padding: '30px 26px' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 11, background: 'linear-gradient(135deg, rgba(79,124,246,0.15), rgba(6,182,212,0.08))', border: '1px solid rgba(79,124,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: 'var(--accent)', marginBottom: 18 }}>{f.icon}</div>
                  <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10, letterSpacing: '-0.02em' }}>{f.title}</div>
                  <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.72 }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How It Works ── */}
        <section className="vq-reveal" style={{ padding: '100px 24px' }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 60 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>How It Works</div>
              <h2 style={{ fontSize: 'clamp(24px, 3vw, 38px)', fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>Set up once. Intelligence delivered daily.</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 48 }}>
              {STEPS.map(s => (
                <div key={s.n} className="vq-child">
                  <div style={{ fontSize: 52, fontWeight: 900, letterSpacing: '-0.04em', color: 'rgba(79,124,246,0.12)', lineHeight: 1, marginBottom: 18 }}>{s.n}</div>
                  <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', marginBottom: 10 }}>{s.title}</div>
                  <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Comparison ── */}
        <section className="vq-reveal" style={{ padding: '80px 24px', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 52 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>The Alternative</div>
              <h2 style={{ fontSize: 'clamp(24px, 3vw, 38px)', fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>Your other options cost more. And do less.</h2>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 580 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '14px 20px', fontWeight: 600, fontSize: 13, color: 'var(--text-2)', borderBottom: '2px solid var(--border)' }}></th>
                    <th style={{ textAlign: 'center', padding: '14px 20px', borderBottom: '2px solid var(--accent)', background: 'rgba(79,124,246,0.06)' }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--accent)' }}>VeloQuant</div>
                      <div style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600, marginTop: 2 }}>$99/mo</div>
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
                    ['Analyst consensus + insider data', true, false, false],
                    ['Price & news monitoring', true, true, 'Manual'],
                    ['Setup time', '60 seconds', 'Days + training', 'None'],
                  ].map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '13px 20px', fontSize: 13.5, color: 'var(--text-2)' }}>{row[0]}</td>
                      {[row[1], row[2], row[3]].map((cell, ci) => (
                        <td key={ci} style={{ padding: '13px 20px', textAlign: 'center', background: ci === 0 ? 'rgba(79,124,246,0.04)' : 'transparent', fontSize: 13 }}>
                          {cell === true ? <span style={{ color: 'var(--success)', fontSize: 17 }}>✓</span>
                            : cell === false ? <span style={{ color: 'rgba(255,255,255,0.14)', fontSize: 17 }}>—</span>
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

        {/* ── Security ── */}
        <section className="vq-reveal" style={{ padding: '100px 24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 80% 50%, rgba(16,185,129,0.04) 0%, transparent 60%)', pointerEvents: 'none' }} />
          <div style={{ maxWidth: 920, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 52 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--success)', marginBottom: 12 }}>Security & Compliance</div>
              <h2 style={{ fontSize: 'clamp(24px, 3vw, 42px)', fontWeight: 900, letterSpacing: '-0.04em', margin: 0 }}>Zero client data. Ever.</h2>
              <p style={{ color: 'var(--text-2)', fontSize: 15, maxWidth: 480, margin: '16px auto 0', lineHeight: 1.7 }}>Designed to never touch your clients' information — by architecture, not policy.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
              {[
                { icon: '⊘', title: 'Tickers only', desc: 'You enter stock symbols — never client names, account numbers, or portfolio values. Nothing to disclose or protect.' },
                { icon: '⊕', title: 'Encrypted everywhere', desc: 'All data encrypted in transit (TLS 1.3) and at rest (AES-256). No plaintext storage of any user data.' },
                { icon: '⊙', title: 'No CRM access', desc: 'Completely siloed from your custodian, CRM, and compliance systems. No integrations that could expose client data.' },
                { icon: '⊛', title: 'You control the emails', desc: 'AI-drafted client emails are templates for your review. Nothing sent automatically. You send from your own system.' },
              ].map(item => (
                <div key={item.title} className="vq-child vq-card-hover card" style={{ padding: '26px 22px', borderColor: 'rgba(16,185,129,0.12)' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(16,185,129,0.3)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(16,185,129,0.12)'}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'var(--success)', marginBottom: 14 }}>{item.icon}</div>
                  <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>{item.title}</div>
                  <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.7 }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Testimonials ── */}
        <section className="vq-reveal" style={{ padding: '80px 24px', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ maxWidth: 960, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>From Advisors</div>
              <h2 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>What advisors are saying</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              {[
                { quote: "I used to spend the first 90 minutes of every day just getting up to speed. Now my briefing is waiting when I wake up. It's changed how I start every single morning.", name: 'Michael T.', role: 'Independent RIA · $85M AUM · Austin, TX' },
                { quote: "The SEC filing alerts alone are worth it. I caught a material 8-K on one of my client's largest positions before the market opened — and had a draft email ready to send.", name: 'Sarah K.', role: 'CFP · Ensemble Practice · Chicago, IL' },
                { quote: "I was skeptical of AI for anything compliance-adjacent. But this is just research automation — no different than a Bloomberg alert, except actually readable.", name: 'David R.', role: 'Fee-Only RIA · $220M AUM · Denver, CO' },
              ].map((t, i) => (
                <div key={i} className="vq-child vq-card-hover card" style={{ padding: '28px 24px' }}>
                  <div style={{ fontSize: 40, color: 'var(--accent)', opacity: 0.18, lineHeight: 1, marginBottom: 14, fontFamily: 'Georgia, serif' }}>"</div>
                  <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.82, marginBottom: 20, fontStyle: 'italic' }}>{t.quote}</div>
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
        <section className="vq-reveal" style={{ padding: '100px 24px', maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>Pricing</div>
          <h2 style={{ fontSize: 'clamp(24px, 3vw, 38px)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 40 }}>Simple, transparent pricing</h2>
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(79,124,246,0.22)', borderRadius: 20, padding: '40px 36px', textAlign: 'left', boxShadow: '0 0 60px rgba(79,124,246,0.07), 0 0 100px rgba(79,124,246,0.03)', animation: 'glow-cta 4s ease-in-out infinite' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 56, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}>$99</span>
              <span style={{ fontSize: 18, color: 'var(--text-2)', paddingBottom: 8 }}>/month</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, marginBottom: 28 }}>14-day free trial · Cancel anytime</div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24, marginBottom: 28 }}>
              {[
                'Daily morning intelligence briefing',
                'SEC filing alerts for all holdings',
                'AI-drafted client communication emails',
                'Portfolio analytics & price monitoring',
                'Delivered to your inbox by 7:30am ET',
                'Unlimited holdings tracked',
                'FINRA short volume & insider transactions',
                'Analyst consensus & earnings calendar',
              ].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 13 }}>
                  <span style={{ color: 'var(--success)', fontSize: 14, flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 14, color: 'var(--text-2)' }}>{f}</span>
                </div>
              ))}
            </div>
            <button className="btn btn-primary" onClick={() => navigate('/onboarding')} style={{ width: '100%', justifyContent: 'center', padding: '14px 18px', fontSize: 15, boxShadow: '0 0 28px rgba(79,124,246,0.25)' }}>
              Start Your Free Trial →
            </button>
            <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: 'var(--text-2)' }}>Cancel before your trial ends and pay nothing.</div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="vq-reveal" style={{ padding: '80px 24px', maxWidth: 720, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>FAQ</div>
            <h2 style={{ fontSize: 'clamp(24px, 3vw, 38px)', fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>Common questions</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FAQS.map((faq, i) => (
              <div key={i} style={{ background: 'var(--surface)', border: `1px solid ${openFaq === i ? 'rgba(79,124,246,0.3)' : 'var(--border)'}`, borderRadius: 12, overflow: 'hidden', transition: 'border-color 0.2s' }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ width: '100%', background: 'none', border: 'none', padding: '18px 22px', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, fontFamily: 'inherit' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)', lineHeight: 1.4 }}>{faq.q}</span>
                  <span style={{ color: 'var(--accent)', fontSize: 20, lineHeight: 1, flexShrink: 0, fontWeight: 400, transition: 'transform 0.25s', transform: openFaq === i ? 'rotate(45deg)' : 'none', display: 'block' }}>+</span>
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
        <section className="vq-reveal" style={{ padding: '100px 24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(79,124,246,0.1) 0%, transparent 65%)', pointerEvents: 'none' }} />
          <div style={{ maxWidth: 620, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 20 }}>Get Started</div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 52px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 20 }}>
              Your first briefing could be{' '}
              <span style={gradientText}>tomorrow morning.</span>
            </h2>
            <p style={{ fontSize: 17, color: 'var(--text-2)', lineHeight: 1.75, maxWidth: 480, margin: '0 auto 40px' }}>
              Set up your holdings in 60 seconds. Your personalized briefing arrives at 7:30am the next trading day. Try it free for 14 days.
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/onboarding')} style={{ fontSize: 16, padding: '16px 44px', boxShadow: '0 0 40px rgba(79,124,246,0.32)', animation: 'glow-cta 3s ease-in-out infinite' }}>
              Start Your Free Trial →
            </button>
            <div style={{ marginTop: 16, fontSize: 13, color: 'var(--text-2)' }}>14-day free trial · No credit card required until day 15</div>
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
    </div>
  )
}
