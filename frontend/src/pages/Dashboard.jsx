import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import BriefingRenderer from '../components/BriefingRenderer'
import { useToast } from '../components/Toast'

const CHART_COLORS = ['#4f7cf6','#06b6d4','#10d97b','#f59e0b','#8b5cf6','#ec4899','#f97316','#ef4444']

function AllocationChart({ holdings }) {
  const total = holdings.reduce((s, h) => s + parseFloat(h.position_size || 0), 0)
  if (!total || holdings.length === 0) return null

  const SIZE = 120, CX = 60, CY = 60, R = 52, IR = 33
  const toRad = d => (d * Math.PI) / 180
  let cum = -90

  const slices = holdings.map((h, i) => {
    const pct = parseFloat(h.position_size || 0) / total
    const sweep = pct * 360
    const color = CHART_COLORS[i % CHART_COLORS.length]
    if (holdings.length === 1) return { type: 'circle', color, ticker: h.ticker, pct }
    const start = cum; cum += sweep; const end = cum
    const la = sweep > 180 ? 1 : 0
    const [x1,y1] = [CX+R*Math.cos(toRad(start)), CY+R*Math.sin(toRad(start))]
    const [x2,y2] = [CX+R*Math.cos(toRad(end)),   CY+R*Math.sin(toRad(end))]
    const [ix1,iy1] = [CX+IR*Math.cos(toRad(start)), CY+IR*Math.sin(toRad(start))]
    const [ix2,iy2] = [CX+IR*Math.cos(toRad(end)),   CY+IR*Math.sin(toRad(end))]
    return { type:'path', color, ticker:h.ticker, pct,
      d:`M${x1.toFixed(1)},${y1.toFixed(1)} A${R},${R} 0 ${la},1 ${x2.toFixed(1)},${y2.toFixed(1)} L${ix2.toFixed(1)},${iy2.toFixed(1)} A${IR},${IR} 0 ${la},0 ${ix1.toFixed(1)},${iy1.toFixed(1)}Z` }
  })

  return (
    <div style={{ display:'flex', alignItems:'center', gap:20, paddingBottom:18, marginBottom:12, borderBottom:'1px solid var(--border)' }}>
      <svg width={SIZE} height={SIZE} style={{ flexShrink:0 }}>
        {slices.map((s,i) => s.type==='circle'
          ? <circle key={i} cx={CX} cy={CY} r={(R+IR)/2} fill="none" stroke={s.color} strokeWidth={R-IR} />
          : <path key={i} d={s.d} fill={s.color} />
        )}
      </svg>
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6 }}>
        {slices.map((s,i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:8, height:8, borderRadius:2, background:s.color, flexShrink:0 }} />
            <span style={{ fontSize:11, fontWeight:800, color:'var(--text)', letterSpacing:'0.05em', minWidth:38 }}>{s.ticker}</span>
            <div style={{ flex:1, height:2, background:'var(--border)', borderRadius:1, overflow:'hidden' }}>
              <div style={{ width:`${(s.pct*100).toFixed(1)}%`, height:'100%', background:s.color }} />
            </div>
            <span style={{ fontSize:11, color:'var(--text-2)', fontVariantNumeric:'tabular-nums', fontWeight:600, minWidth:28, textAlign:'right' }}>
              {(s.pct*100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BriefingActions({ briefing }) {
  const [copied, setCopied] = useState(false)
  const [emailing, setEmailing] = useState(false)
  const [emailSent, setEmailSent] = useState(briefing?.delivered || false)
  const toast = useToast()

  function copyToClipboard() {
    navigator.clipboard.writeText(briefing.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function sendEmail() {
    setEmailing(true)
    try {
      await api.sendBriefing(briefing.id)
      setEmailSent(true)
      toast.success('Briefing emailed successfully.')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setEmailing(false)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <button
        onClick={copyToClipboard}
        style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: copied ? 'var(--success)' : 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, transition: 'all 0.15s' }}
      >
        {copied ? '✓ Copied' : '⎘ Copy'}
      </button>
      <button
        onClick={sendEmail}
        disabled={emailing || emailSent}
        style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: emailSent ? 'var(--success)' : 'var(--text-2)', cursor: emailSent ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 600, transition: 'all 0.15s', opacity: emailing ? 0.6 : 1 }}
      >
        {emailSent ? '✓ Emailed' : emailing ? 'Sending...' : '✉ Email me'}
      </button>
      <span style={{ color: 'var(--border)', fontSize: 12 }}>·</span>
      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
        {new Date(briefing.generated_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
      </span>
    </div>
  )
}

export default function Dashboard() {
  const [advisor, setAdvisor] = useState(null)
  const [briefing, setBriefing] = useState(null)
  const [holdings, setHoldings] = useState([])
  const [marketData, setMarketData] = useState({})
  const [alerts, setAlerts] = useState([])
  const [emails, setEmails] = useState([])
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [adv, h, a, e] = await Promise.all([
        api.getAdvisor(), api.getHoldings(), api.getFilingAlerts(), api.getClientEmails(),
      ])
      setAdvisor(adv); setHoldings(h); setAlerts(a); setEmails(e)
      if (h.length > 0) {
        try { setMarketData(await api.getMarketData()) } catch (_) {}
        try { setBriefing(await api.getLatestBriefing()) } catch (_) {}
      }
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleGenerate() {
    setGenerating(true); setError(null)
    try { setBriefing(await api.generateBriefing()) }
    catch (e) { setError(e.message) }
    finally { setGenerating(false) }
  }

  if (loading) return <div className="loading"><div className="spin" /><span>Loading your dashboard...</span></div>

  const unread  = alerts.filter(a => !a.read).length
  const pending = emails.filter(e => !e.sent).length
  const date    = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const totalCostBasis = holdings.reduce((s, h) => s + parseFloat(h.position_size), 0)
  const totalPortfolio = holdings.reduce((s, h) => {
    const close = marketData[h.ticker]?.price?.close
    return s + (h.shares && close ? h.shares * close : parseFloat(h.position_size))
  }, 0)
  const portfolioGainLoss = Object.keys(marketData).length > 0 ? totalPortfolio - totalCostBasis : null
  const portfolioGainLossPct = portfolioGainLoss !== null && totalCostBasis > 0 ? portfolioGainLoss / totalCostBasis * 100 : null

  const showVerifyBanner = advisor && advisor.email_verified === false && !advisor.is_legacy

  const todayStr = new Date().toDateString()
  const briefingIsToday = briefing && new Date(briefing.generated_at).toDateString() === todayStr

  // First-time empty state
  if (holdings.length === 0) {
    return (
      <div>
        <div className="page-header">
          <div className="page-title">{advisor?.name ? `Welcome, ${advisor.name.split(' ')[0]}` : 'Welcome'}</div>
          <div className="page-subtitle">{advisor?.firm_name} · {date}</div>
        </div>
        {showVerifyBanner && (
          <div style={{ background: 'linear-gradient(90deg, rgba(79,124,246,0.15), rgba(6,182,212,0.10))', border: '1px solid rgba(79,124,246,0.3)', borderRadius: 10, padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>✉ Check your inbox to verify your email address</span>
            <button className="btn btn-outline" style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => api.resendVerification(advisor.email).catch(() => {})}>Resend</button>
          </div>
        )}
        <div className="card card-glow" style={{ padding: '40px 48px', maxWidth: 640 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>Getting Started</div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>
            Set up your morning briefings
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 32 }}>
            Your platform is ready. Complete these three steps to start receiving personalized intelligence every morning.
          </div>
          {[
            { n: '1', title: 'Add your holdings', desc: 'Enter the tickers your clients hold. Takes 60 seconds.', cta: 'Add Holdings →', path: '/holdings', done: false },
            { n: '2', title: 'Generate your first briefing', desc: 'See exactly what you\'ll receive every morning — AI analysis of your specific portfolio.', cta: null, done: false },
            { n: '3', title: 'Briefings arrive at 7:30am ET', desc: 'Every weekday, your briefing lands before market open. No action needed after setup.', cta: null, done: false },
          ].map((step, i) => (
            <div key={step.n} style={{ display: 'flex', gap: 20, marginBottom: i < 2 ? 24 : 0, paddingBottom: i < 2 ? 24 : 0, borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: i === 0 ? 'linear-gradient(135deg, var(--accent), var(--accent-b))' : 'var(--surface-2)', border: i === 0 ? 'none' : '1px solid var(--border)', color: i === 0 ? '#fff' : 'var(--text-2)', fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{step.n}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: i === 0 ? 'var(--text)' : 'var(--text-2)' }}>{step.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: step.cta ? 12 : 0 }}>{step.desc}</div>
                {step.cta && (
                  <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => navigate(step.path)}>{step.cta}</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {showVerifyBanner && (
        <div style={{
          background: 'linear-gradient(90deg, rgba(79,124,246,0.15), rgba(6,182,212,0.10))',
          border: '1px solid rgba(79,124,246,0.3)',
          borderRadius: 10, padding: '12px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16, gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>✉</span>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Verify your email address</span>
              <span style={{ fontSize: 13, color: 'var(--text-2)', marginLeft: 8 }}>
                Check your inbox for a verification link to secure your account.
              </span>
            </div>
          </div>
          <button
            className="btn btn-outline"
            style={{ fontSize: 12, padding: '6px 14px', whiteSpace: 'nowrap' }}
            onClick={() => api.resendVerification(advisor.email).catch(() => {})}
          >
            Resend email
          </button>
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div className="page-title">{advisor?.name}</div>
            <div className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span>{advisor?.firm_name} · {date}</span>
              {briefingIsToday ? (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 10, background: 'rgba(16,185,129,0.15)', color: 'var(--success)', letterSpacing: '0.04em' }}>
                  ◆ Briefing ready · {new Date(briefing.generated_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
              ) : (
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 10, background: 'rgba(79,124,246,0.1)', color: 'var(--accent)', letterSpacing: '0.04em' }}>
                  ⏰ Next briefing at 7:30am ET
                </span>
              )}
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={generating || holdings.length === 0}
            style={{ marginTop: 4 }}
          >
            {generating
              ? <><div className="spin spin-sm" />Generating...</>
              : <>◆ Generate Briefing</>}
          </button>
        </div>
      </div>

      {error && <div className="error-bar">{error}</div>}

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Portfolio Value</div>
          <div className="stat-value" style={{ fontSize: totalPortfolio >= 1e6 ? 26 : 32 }}>
            {totalPortfolio > 0 ? `$${(totalPortfolio / 1000).toFixed(0)}K` : holdings.length}
          </div>
          <div className="stat-sub" style={{ color: portfolioGainLoss > 0 ? 'var(--success)' : portfolioGainLoss < 0 ? 'var(--danger)' : undefined }}>
            {portfolioGainLoss !== null
              ? `${portfolioGainLoss >= 0 ? '+' : '−'}$${Math.abs(portfolioGainLoss).toLocaleString(undefined, { maximumFractionDigits: 0 })} (${portfolioGainLossPct >= 0 ? '+' : ''}${portfolioGainLossPct.toFixed(2)}%)`
              : `${holdings.length} position${holdings.length !== 1 ? 's' : ''}`}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Filing Alerts</div>
          <div className="stat-value" style={{ color: unread > 0 ? 'var(--warning)' : undefined }}>
            {unread}
          </div>
          <div className="stat-sub">{unread > 0 ? `${unread} unread · action needed` : 'All caught up'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Client Emails</div>
          <div className="stat-value" style={{ color: pending > 0 ? 'var(--accent)' : undefined }}>
            {pending}
          </div>
          <div className="stat-sub">{pending > 0 ? `${pending} draft${pending !== 1 ? 's' : ''} ready to send` : 'No pending drafts'}</div>
        </div>
      </div>

      {/* Morning Briefing */}
      <div className="card card-glow">
        <div className="card-header">
          <div className="card-title">Morning Intelligence Briefing</div>
          {briefing && <BriefingActions briefing={briefing} advisorEmail={advisor?.email} />}
        </div>

        {generating ? (
          <div className="generating-box">
            <div className="spin" />
            <div className="generating-title">Analyzing your portfolio...</div>
            <div className="generating-sub">
              Pulling overnight prices, SEC filings, and news for {holdings.length} holdings.<br />
              This takes about 30–60 seconds.
            </div>
          </div>
        ) : briefing ? (
          <BriefingRenderer content={briefing.content} />
        ) : (
          <div className="empty">
            <strong>No briefing yet</strong>
            Click "Generate Briefing" to get your first morning intelligence report.
          </div>
        )}
      </div>

      <div className="grid-2">
        {/* Portfolio */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Portfolio</div>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/holdings')}>Manage →</button>
          </div>
          {holdings.length === 0 ? (
            <div className="empty" style={{ padding: '24px 0' }}>No holdings yet.</div>
          ) : (
            <>
            <AllocationChart holdings={holdings} />
            {holdings.map(h => {
              const md = marketData[h.ticker]?.price
              const pct = md?.pct_change
              const close = md?.close
              return (
                <div key={h.id} className="holding-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="chip">{h.ticker}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      ${parseFloat(h.position_size).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 10 }}>
                    {close && (
                      <span style={{ fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>
                        ${Number(close).toFixed(2)}
                      </span>
                    )}
                    {pct != null && (
                      pct > 0
                        ? <span className="price-up" style={{ fontSize: 11 }}>▲ {Math.abs(pct).toFixed(2)}%</span>
                        : pct < 0
                          ? <span className="price-down" style={{ fontSize: 11 }}>▼ {Math.abs(pct).toFixed(2)}%</span>
                          : <span className="price-flat" style={{ fontSize: 11 }}>— 0.00%</span>
                    )}
                  </div>
                </div>
              )
            })}
            </>
          )}
        </div>

        {/* Filing Alerts */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Recent Filing Alerts</div>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/filing-alerts')}>View All →</button>
          </div>
          {alerts.length === 0 ? (
            <div className="empty" style={{ padding: '24px 0' }}>No alerts yet.</div>
          ) : (
            alerts.slice(0, 3).map(a => (
              <div key={a.id} className="alert-row">
                <div className="alert-meta">
                  <span className="chip">{a.ticker}</span>
                  <span className="badge badge-blue">{a.filing_type}</span>
                  {!a.read && <span className="badge badge-yellow">New</span>}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.65 }}>
                  {a.key_insight.slice(0, 160)}{a.key_insight.length > 160 ? '…' : ''}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
