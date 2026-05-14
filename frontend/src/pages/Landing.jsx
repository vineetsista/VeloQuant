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
@keyframes float {
  0%, 100% { transform: translateY(0px) }
  50% { transform: translateY(-10px) }
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1) }
  50% { opacity: 0.35; transform: scale(0.75) }
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
  from { opacity: 0; transform: translateY(28px) }
  to { opacity: 1; transform: translateY(0) }
}
@keyframes fade-up-delay {
  0%, 15% { opacity: 0; transform: translateY(28px) }
  100% { opacity: 1; transform: translateY(0) }
}
@keyframes glow-cta {
  0%, 100% { box-shadow: 0 0 24px rgba(79,124,246,0.3) }
  50% { box-shadow: 0 0 44px rgba(79,124,246,0.55) }
}
@keyframes preview-in {
  from { opacity: 0; transform: translateY(10px) }
  to { opacity: 1; transform: translateY(0) }
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
  transition: opacity 0.6s cubic-bezier(0.16,1,0.3,1), transform 0.6s cubic-bezier(0.16,1,0.3,1);
}
.vq-child.vq-revealed { opacity: 1; transform: translateY(0); }
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

const PREVIEW_LINES = [
  { ticker: 'AAPL', text: 'Services revenue beat by $400M; management raised FY guidance citing AI feature adoption across 2.2B active devices. Analyst consensus: 38 Buy, 6 Hold.' },
  { ticker: 'MSFT', text: 'Azure growth reaccelerated to 31% YoY vs. 29% estimate. Copilot enterprise seats crossed 500K, up 3x in 90 days. No open SEC inquiries.' },
  { ticker: 'JPM', text: 'Net interest income flat at $23.1B; credit provisions up $600M. Short volume 58% — elevated. Watch Q2 earnings July 12 for NII guidance revision.' },
  { ticker: 'BRK.B', text: 'Berkshire disclosed 3 new equity positions in latest 13-F. Energy sector weighting increased to 18% of disclosed portfolio. No material 8-K activity.' },
]

const FEATURES = [
  { icon: '≋', title: 'AI Morning Briefing', desc: 'Claude AI synthesizes overnight moves, SEC filings, analyst data, and insider transactions into a sharp, specific briefing for your exact holdings. Delivered at 7:30am ET.' },
  { icon: '◎', title: 'SEC Filing Intelligence', desc: 'Real-time monitoring of EDGAR filings across your entire book. Material 8-Ks, 10-Qs, and insider Form 4 transactions surfaced the moment they post.' },
  { icon: '✦', title: 'Client Email Drafts', desc: 'AI-drafted emails for every significant event — earnings, filings, price moves. Your voice, your clients, ready to review and send in seconds.' },
  { icon: '◉', title: 'Portfolio Analytics', desc: 'Allocation donut, sector breakdown, concentration risk, 30-day sparklines, benchmark comparison, and TLH candidates — all updated daily.' },
  { icon: '⬡', title: 'Analyst Consensus', desc: 'Real buy/hold/sell counts and price targets from Finnhub across your holdings — no hallucinated ratings, only verified live data.' },
  { icon: '◈', title: 'FINRA Short Volume', desc: 'Daily short sale pressure data for every holding. Know when short volume spikes above 65% before the market reacts.' },
]

const STEPS = [
  { n: '01', title: 'Add your holdings', desc: 'Enter the tickers your clients hold. Takes 60 seconds. No client data required — tickers only.' },
  { n: '02', title: 'We monitor everything', desc: 'Overnight: SEC filings, analyst upgrades, insider transactions, short volume, earnings — all pulled and analyzed automatically.' },
  { n: '03', title: 'Briefing in your inbox', desc: 'By 7:30am ET every weekday, a personalized briefing lands before you open Bloomberg.' },
]

const FAQS = [
  { q: 'Does this store any client data?', a: 'No. You enter stock tickers only — never client names, account numbers, or portfolio values. There is nothing to disclose to your compliance department.' },
  { q: 'How is this different from Bloomberg?', a: 'Bloomberg gives you everything and filters nothing. VeloQuant gives you only what matters for your specific book, synthesized into a readable briefing, at 1/20th the cost.' },
  { q: 'What data sources power the briefings?', a: 'SEC EDGAR (real-time filings), Polygon.io (market data), Finnhub (100+ news sources, earnings calendar, analyst consensus), FINRA daily short volume, and SEC Form 4 insider transactions. All verified, no hallucinated data.' },
  { q: 'What if the AI gets something wrong?', a: "Every factual claim cites a source — price, filing, or analyst data. VeloQuant is a research starting point. You verify, you decide. That's why our disclaimer is prominent." },
  { q: 'Can I cancel anytime?', a: "Yes. Cancel before your 14-day trial ends and you'll never be charged. After subscribing, cancel anytime and retain access through the end of your billing period." },
  { q: 'Is this compliant with FINRA/SEC marketing rules?', a: 'VeloQuant generates internal research summaries and draft communications for your review. You approve everything before it reaches clients. Consult your compliance consultant for firm-specific guidance.' },
]

const SAMPLE_SECTIONS = [
  {
    label: 'AAPL — Apple Inc.',
    badge: '▲ +1.21%', badgeColor: 'var(--success)',
    content: "Apple closed at $194.32, up 1.21% on above-average volume. Services revenue beat by $400M; management raised FY guidance citing AI feature adoption. Analyst consensus: 38 Buy, 6 Hold, 1 Sell — target $212 vs. today's $189. No material SEC filings in past 72 hours. Earnings in 18 days — whisper EPS $1.62 vs. consensus $1.57.",
  },
  {
    label: 'JPM — JPMorgan Chase',
    badge: 'NEW 8-K', badgeColor: 'var(--accent)', hasDraft: true,
    content: "JPMorgan filed an 8-K disclosing CFO Jeremy Barnum's planned departure in Q3 2026. Stock reaction muted pre-market (-0.3%). Net interest income flat at $23.1B; credit provisions up $600M YoY — management signaling caution on consumer credit. Short volume at 58% (elevated above 55% threshold).",
  },
  {
    label: 'MSFT — Microsoft',
    badge: '▲ +0.87%', badgeColor: 'var(--success)',
    content: "Azure growth reaccelerated to 31% YoY vs. 29% estimate. Copilot enterprise seats crossed 500K, up 3x in 90 days. CFO filed a Form 4 on May 9 — sold 12,400 shares at $415.20 ($5.1M), routine exercise. Short volume: 43% (normal). No open SEC inquiries.",
  },
  {
    label: 'SEC Filing Alert',
    badge: 'ACTION', badgeColor: '#f59e0b', hasDraft: true,
    content: "Apple filed an 8-K reporting a $110B share buyback authorization — largest in company history. Key clause: buybacks accelerate if stock trades below $175 for 5 consecutive sessions. Draft client email ready for your review.",
  },
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
  const [previewIdx, setPreviewIdx] = useState(0)
  const [previewVisible, setPreviewVisible] = useState(true)
  const resultRef = useRef(null)
  const navigate = useNavigate()

  // Inject keyframes
  useEffect(() => {
    const el = document.createElement('style')
    el.textContent = KEYFRAMES
    document.head.appendChild(el)
    return () => document.head.removeChild(el)
  }, [])

  // Scroll reveal
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

  // Rotating preview
  useEffect(() => {
    const t = setInterval(() => {
      setPreviewVisible(false)
      setTimeout(() => {
        setPreviewIdx(i => (i + 1) % PREVIEW_LINES.length)
        setPreviewVisible(true)
      }, 350)
    }, 3800)
    return () => clearInterval(t)
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
  const preview = PREVIEW_LINES[previewIdx]

  const gradientText = {
    background: 'linear-gradient(120deg, var(--accent), var(--accent-b), var(--accent))',
    backgroundSize: '200% auto',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    animation: 'gradient-shift 4s ease infinite',
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Inter, sans-serif', overflowX: 'hidden' }}>

      {/* Animated dot grid */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'radial-gradient(circle, rgba(79,124,246,0.10) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
        animation: 'drift 28s linear infinite',
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* ── Ticker Tape ── */}
        <div style={{ background: 'rgba(79,124,246,0.05)', borderBottom: '1px solid var(--border)', height: 34, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', animation: 'ticker-scroll 35s linear infinite', whiteSpace: 'nowrap', willChange: 'transform' }}>
            {[...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 22px', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', fontFamily: 'monospace', borderRight: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-2)', opacity: 0.7 }}>{item.label}</span>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'linear-gradient(135deg, var(--accent), var(--accent-b))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: '#fff', fontWeight: 900,
              boxShadow: '0 0 18px rgba(79,124,246,0.45)',
            }}>◆</div>
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.02em' }}>VeloQuant</span>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button onClick={() => navigate('/signin')} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', padding: '8px 12px' }}>Sign In</button>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/onboarding')}
              style={{ fontSize: 13, padding: '8px 18px', animation: 'glow-cta 3s ease-in-out infinite' }}
            >
              Start Free Trial →
            </button>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section style={{ padding: '72px 40px 80px', position: 'relative', overflow: 'hidden', minHeight: '88vh', display: 'flex', alignItems: 'center' }}>
          {/* Background glow blobs */}
          <div style={{ position: 'absolute', top: -300, left: -200, width: 900, height: 900, background: 'radial-gradient(circle, rgba(79,124,246,0.07) 0%, transparent 65%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -200, right: -100, width: 700, height: 700, background: 'radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 65%)', pointerEvents: 'none' }} />

          <div style={{ maxWidth: 1180, margin: '0 auto', width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'center' }}>

            {/* Left: Copy */}
            <div style={{ animation: 'fade-up 0.9s cubic-bezier(0.16,1,0.3,1) both' }}>
              {/* Live badge */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(79,124,246,0.1)', border: '1px solid rgba(79,124,246,0.22)', borderRadius: 20, padding: '5px 14px', marginBottom: 28 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', animation: 'pulse-dot 2s ease-in-out infinite' }} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)' }}>For Independent Financial Advisors</span>
              </div>

              <h1 style={{ fontSize: 'clamp(36px, 4.2vw, 60px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.07, margin: '0 0 26px' }}>
                Goldman Sachs Has<br />a Team of Analysts.{' '}
                <span style={gradientText}>Now So Do You.</span>
              </h1>

              <p style={{ fontSize: 17, color: 'var(--text-2)', maxWidth: 500, lineHeight: 1.78, marginBottom: 40 }}>
                Every weekday at 7:30am, VeloQuant delivers a personalized AI briefing covering your exact holdings — overnight moves, SEC filings, analyst data, insider transactions, and client talking points. In 10 minutes, not 2 hours.
              </p>

              <form onSubmit={handleGenerate} style={{ maxWidth: 520, marginBottom: 14 }}>
                <div style={{
                  display: 'flex', background: 'var(--surface-2)',
                  border: '1px solid rgba(79,124,246,0.22)', borderRadius: 12, overflow: 'hidden',
                  boxShadow: '0 0 40px rgba(79,124,246,0.08)',
                }}>
                  <input
                    value={tickers} onChange={e => setTickers(e.target.value)}
                    placeholder="AAPL, MSFT, JPM, BRK.B, UNH"
                    disabled={loading}
                    style={{ flex: 1, background: 'none', border: 'none', outline: 'none', padding: '14px 18px', fontSize: 15, color: 'var(--text)', fontFamily: 'inherit' }}
                  />
                  <button type="submit" disabled={loading || !tickers.trim()} className="btn btn-primary" style={{ borderRadius: 0, padding: '14px 22px', fontSize: 14, fontWeight: 700, border: 'none', flexShrink: 0 }}>
                    {loading ? <><div className="spin spin-sm" />Analyzing...</> : 'Generate →'}
                  </button>
                </div>
              </form>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 52 }}>Enter up to 10 tickers · No account required · ~60 seconds</div>

              {/* Stats */}
              <div style={{ display: 'flex', gap: 44, flexWrap: 'wrap' }}>
                {[
                  { val: '7:30am ET', label: 'Delivered daily' },
                  { val: '100+', label: 'News sources' },
                  { val: '6 data layers', label: 'Per briefing' },
                ].map(({ val, label }) => (
                  <div key={label}>
                    <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.03em', ...gradientText }}>{val}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Floating briefing card */}
            <div style={{ animation: 'fade-up 0.9s cubic-bezier(0.16,1,0.3,1) 0.18s both' }}>
              <div style={{
                background: 'rgba(13,24,41,0.88)', backdropFilter: 'blur(24px)',
                border: '1px solid rgba(79,124,246,0.18)', borderRadius: 20,
                overflow: 'hidden',
                boxShadow: '0 40px 80px rgba(0,0,0,0.45), 0 0 60px rgba(79,124,246,0.07)',
                animation: 'float 7s ease-in-out infinite',
              }}>
                {/* Card header */}
                <div style={{ background: 'linear-gradient(135deg, rgba(79,124,246,0.14), rgba(6,182,212,0.07))', borderBottom: '1px solid var(--border)', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 3 }}>Morning Briefing</div>
                    <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em' }}>{date}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(16,217,123,0.1)', border: '1px solid rgba(16,217,123,0.22)', borderRadius: 20, padding: '4px 10px' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', animation: 'pulse-dot 2s ease-in-out infinite' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--success)', letterSpacing: '0.1em' }}>LIVE</span>
                  </div>
                </div>

                {/* Rotating preview line */}
                <div style={{ padding: '20px 24px', minHeight: 124, position: 'relative' }}>
                  <div style={{
                    opacity: previewVisible ? 1 : 0,
                    transform: previewVisible ? 'translateY(0)' : 'translateY(8px)',
                    transition: 'opacity 0.35s ease, transform 0.35s ease',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ background: 'rgba(79,124,246,0.14)', border: '1px solid rgba(79,124,246,0.28)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.05em' }}>{preview.ticker}</span>
                      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.78, margin: 0 }}>{preview.text}</p>
                  </div>
                </div>

                {/* Preview rows */}
                {SAMPLE_SECTIONS.slice(0, 2).map((s, i) => (
                  <div key={i} style={{ padding: '13px 24px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{s.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.content}</div>
                    </div>
                    {s.badge && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${s.badgeColor}22`, color: s.badgeColor, border: `1px solid ${s.badgeColor}40`, flexShrink: 0 }}>{s.badge}</span>
                    )}
                  </div>
                ))}

                <div style={{ borderTop: '1px solid var(--border)', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-2)' }}>Generated 7:28am ET · Claude AI</div>
                  <button className="btn btn-primary" onClick={() => navigate('/onboarding')} style={{ fontSize: 11, padding: '6px 14px' }}>Get This Daily →</button>
                </div>
              </div>
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
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 12 }}>Pulling SEC filings, overnight prices, analyst data, and news simultaneously</div>
            </div>
          </section>
        )}
        {error && !loading && (
          <section style={{ padding: '0 24px 40px', maxWidth: 720, margin: '0 auto' }}>
            <div className="error-bar">{error}</div>
          </section>
        )}
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
              <div style={{ padding: '32px' }}><BriefingRenderer content={result.briefing} /></div>
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

        {/* ── Trust Bar ── */}
        <div className="vq-reveal" style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '20px 40px', background: 'rgba(255,255,255,0.012)' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-2)', opacity: 0.5, marginRight: 28, flexShrink: 0 }}>Powered by</span>
            {[
              { name: 'Claude AI', sub: 'by Anthropic', icon: '◈' },
              { name: 'SEC EDGAR', sub: 'Filing database', icon: '⬡' },
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
                <div
                  key={item.time}
                  className="vq-child"
                  style={{ background: 'var(--surface)', border: '1px solid rgba(239,68,68,0.12)', borderRadius: 14, padding: '24px 20px', transition: 'border-color 0.2s, transform 0.2s', cursor: 'default' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; e.currentTarget.style.transform = 'translateY(-4px)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.12)'; e.currentTarget.style.transform = 'translateY(0)' }}
                >
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

        {/* ── Sample Briefing ── */}
        <section className="vq-reveal" style={{ padding: '80px 24px', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
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
                    {s.badge && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', padding: '2px 8px', borderRadius: 20, background: `${s.badgeColor}20`, color: s.badgeColor, border: `1px solid ${s.badgeColor}35` }}>{s.badge}</span>}
                    {s.hasDraft && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', padding: '2px 8px', borderRadius: 20, background: 'rgba(79,124,246,0.1)', color: 'var(--accent)', border: '1px solid rgba(79,124,246,0.25)' }}>✦ Draft email ready</span>}
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
        <section className="vq-reveal" style={{ padding: '100px 24px', maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>What You Get</div>
            <h2 style={{ fontSize: 'clamp(24px, 3vw, 38px)', fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>Everything you need before market open</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="vq-child card"
                style={{ padding: '32px 28px', transition: 'transform 0.22s, border-color 0.22s, box-shadow 0.22s', cursor: 'default' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.borderColor = 'rgba(79,124,246,0.28)'; e.currentTarget.style.boxShadow = '0 20px 48px rgba(79,124,246,0.1)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = '' }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, rgba(79,124,246,0.15), rgba(6,182,212,0.08))', border: '1px solid rgba(79,124,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'var(--accent)', marginBottom: 20 }}>{f.icon}</div>
                <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12, letterSpacing: '-0.02em' }}>{f.title}</div>
                <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── How It Works ── */}
        <section className="vq-reveal" style={{ padding: '80px 24px', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 52 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>How It Works</div>
              <h2 style={{ fontSize: 'clamp(24px, 3vw, 38px)', fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>Set up once. Intelligence delivered daily.</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 40 }}>
              {STEPS.map(s => (
                <div key={s.n} className="vq-child">
                  <div style={{ fontSize: 54, fontWeight: 900, letterSpacing: '-0.04em', color: 'rgba(79,124,246,0.13)', lineHeight: 1, marginBottom: 16 }}>{s.n}</div>
                  <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', marginBottom: 10 }}>{s.title}</div>
                  <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Comparison ── */}
        <section className="vq-reveal" style={{ padding: '100px 24px' }}>
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
                    <tr
                      key={i}
                      style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '13px 20px', fontSize: 13.5, color: 'var(--text-2)' }}>{row[0]}</td>
                      {[row[1], row[2], row[3]].map((cell, ci) => (
                        <td key={ci} style={{ padding: '13px 20px', textAlign: 'center', background: ci === 0 ? 'rgba(79,124,246,0.04)' : 'transparent', fontSize: 13 }}>
                          {cell === true ? <span style={{ color: 'var(--success)', fontSize: 17 }}>✓</span>
                            : cell === false ? <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 17 }}>—</span>
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
        <section className="vq-reveal" style={{ padding: '80px 24px', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ maxWidth: 960, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 52 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>Built For</div>
              <h2 style={{ fontSize: 'clamp(24px, 3vw, 38px)', fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>Designed for independent advisors.<br />Not everyone.</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginBottom: 24 }}>
              {[
                { icon: '◆', title: 'Solo RIAs', range: '$20M – $150M AUM', desc: 'You wear every hat. VeloQuant gives you analyst-level prep without the analyst salary.' },
                { icon: '◈', title: 'Ensemble Practices', range: '$150M – $500M AUM', desc: 'A unified briefing your whole team can act on — consistent talking points across advisors.' },
                { icon: '◇', title: 'Financial Planners', range: 'Fee-only · Investment-integrated', desc: 'Keep clients informed on holdings without spending your planning hours on market research.' },
              ].map(item => (
                <div
                  key={item.title}
                  className="vq-child card"
                  style={{ padding: '28px 24px', transition: 'transform 0.2s, border-color 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'rgba(79,124,246,0.25)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = '' }}
                >
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

        {/* ── Security ── */}
        <section className="vq-reveal" style={{ padding: '100px 24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 80% 50%, rgba(16,185,129,0.04) 0%, transparent 60%)', pointerEvents: 'none' }} />
          <div style={{ maxWidth: 920, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 52 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--success)', marginBottom: 12 }}>Security & Compliance</div>
              <h2 style={{ fontSize: 'clamp(24px, 3vw, 42px)', fontWeight: 900, letterSpacing: '-0.04em', margin: 0 }}>Zero client data. Ever.</h2>
              <p style={{ color: 'var(--text-2)', fontSize: 15, maxWidth: 480, margin: '16px auto 0', lineHeight: 1.7 }}>Designed to never touch your clients' information — by architecture, not policy.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
              {[
                { icon: '⊘', title: 'Tickers only', desc: 'You enter stock symbols — never client names, account numbers, or portfolio values. Nothing to disclose or protect.' },
                { icon: '⊕', title: 'Encrypted everywhere', desc: 'All data encrypted in transit (TLS 1.3) and at rest (AES-256). No plaintext storage of any user data.' },
                { icon: '⊙', title: 'No CRM access', desc: 'Completely siloed from your custodian, CRM, and compliance systems. No integrations that could expose client data.' },
                { icon: '⊛', title: 'You control the emails', desc: 'AI-drafted client emails are templates for your review. Nothing sent automatically. You send from your own system.' },
              ].map(item => (
                <div
                  key={item.title}
                  className="vq-child card"
                  style={{ padding: '26px 24px', borderColor: 'rgba(16,185,129,0.12)', transition: 'transform 0.2s, border-color 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'rgba(16,185,129,0.3)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(16,185,129,0.12)' }}
                >
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
                <div
                  key={i}
                  className="vq-child card"
                  style={{ padding: '28px 24px', transition: 'transform 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div style={{ fontSize: 36, color: 'var(--accent)', opacity: 0.2, lineHeight: 1, marginBottom: 14, fontFamily: 'Georgia, serif' }}>"</div>
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
        <section className="vq-reveal" style={{ padding: '100px 24px', maxWidth: 540, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>Pricing</div>
          <h2 style={{ fontSize: 'clamp(24px, 3vw, 38px)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 40 }}>Simple, transparent pricing</h2>
          <div style={{
            background: 'var(--surface)', border: '1px solid rgba(79,124,246,0.22)', borderRadius: 20,
            padding: '40px 36px', textAlign: 'left',
            boxShadow: '0 0 60px rgba(79,124,246,0.08), 0 0 120px rgba(79,124,246,0.04)',
            animation: 'glow-cta 4s ease-in-out infinite',
          }}>
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
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ color: 'var(--success)', fontSize: 14, flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 14, color: 'var(--text-2)' }}>{f}</span>
                </div>
              ))}
            </div>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/onboarding')}
              style={{ width: '100%', justifyContent: 'center', padding: '14px 18px', fontSize: 15, boxShadow: '0 0 28px rgba(79,124,246,0.28)' }}
            >
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
              <div
                key={i}
                style={{
                  background: 'var(--surface)',
                  border: `1px solid ${openFaq === i ? 'rgba(79,124,246,0.3)' : 'var(--border)'}`,
                  borderRadius: 12, overflow: 'hidden', transition: 'border-color 0.2s',
                }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{ width: '100%', background: 'none', border: 'none', padding: '18px 22px', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, fontFamily: 'inherit' }}
                >
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
            <button
              className="btn btn-primary"
              onClick={() => navigate('/onboarding')}
              style={{ fontSize: 16, padding: '16px 44px', boxShadow: '0 0 40px rgba(79,124,246,0.35)', animation: 'glow-cta 3s ease-in-out infinite' }}
            >
              Start Your Free Trial →
            </button>
            <div style={{ marginTop: 16, fontSize: 13, color: 'var(--text-2)' }}>14-day free trial · Cancel before it ends and pay nothing</div>
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
