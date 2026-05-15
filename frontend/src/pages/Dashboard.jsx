import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import BriefingRenderer from '../components/BriefingRenderer'
import { useToast } from '../components/Toast'
import usePageTitle from '../hooks/usePageTitle'

const GENERATING_MESSAGES = [
  'Fetching overnight price movements...',
  'Scanning SEC EDGAR for recent filings...',
  'Pulling financial news for your holdings...',
  'Analyzing filing impact on your positions...',
  'Drafting your personalized briefing...',
]

const CHART_COLORS = ['#4f7cf6','#06b6d4','#10d97b','#f59e0b','#8b5cf6','#ec4899','#f97316','#ef4444']

const SECTOR_MAP = {
  AAPL:'Technology', MSFT:'Technology', NVDA:'Technology', AVGO:'Technology',
  ORCL:'Technology', CRM:'Technology', AMD:'Technology', INTC:'Technology',
  QCOM:'Technology', NOW:'Technology', ADBE:'Technology', CSCO:'Technology',
  IBM:'Technology', TXN:'Technology', AMAT:'Technology', MU:'Technology',
  PANW:'Technology', SNOW:'Technology', ACN:'Technology', INTU:'Technology',
  KLAC:'Technology', LRCX:'Technology', PLTR:'Technology', SHOP:'Technology',
  GOOGL:'Comm. Services', GOOG:'Comm. Services', META:'Comm. Services',
  NFLX:'Comm. Services', DIS:'Comm. Services', T:'Comm. Services',
  VZ:'Comm. Services', TMUS:'Comm. Services', CHTR:'Comm. Services', EA:'Comm. Services',
  AMZN:'Consumer Disc.', TSLA:'Consumer Disc.', HD:'Consumer Disc.',
  MCD:'Consumer Disc.', NKE:'Consumer Disc.', LOW:'Consumer Disc.',
  SBUX:'Consumer Disc.', TGT:'Consumer Disc.', BKNG:'Consumer Disc.',
  CMG:'Consumer Disc.', GM:'Consumer Disc.', F:'Consumer Disc.',
  PG:'Consumer Staples', KO:'Consumer Staples', PEP:'Consumer Staples',
  WMT:'Consumer Staples', COST:'Consumer Staples', MDLZ:'Consumer Staples',
  CL:'Consumer Staples', GIS:'Consumer Staples', KHC:'Consumer Staples', MNST:'Consumer Staples',
  UNH:'Healthcare', LLY:'Healthcare', JNJ:'Healthcare', PFE:'Healthcare',
  ABBV:'Healthcare', MRK:'Healthcare', TMO:'Healthcare', ABT:'Healthcare',
  DHR:'Healthcare', BMY:'Healthcare', MDT:'Healthcare', ISRG:'Healthcare',
  CVS:'Healthcare', REGN:'Healthcare', VRTX:'Healthcare', GILD:'Healthcare', ZTS:'Healthcare', SYK:'Healthcare',
  JPM:'Financials', BAC:'Financials', WFC:'Financials', GS:'Financials',
  MS:'Financials', BLK:'Financials', C:'Financials', AXP:'Financials',
  V:'Financials', MA:'Financials', PYPL:'Financials', COF:'Financials',
  USB:'Financials', TFC:'Financials', PNC:'Financials', SCHW:'Financials',
  CB:'Financials', MET:'Financials', PRU:'Financials',
  CAT:'Industrials', BA:'Industrials', HON:'Industrials', RTX:'Industrials',
  UPS:'Industrials', GE:'Industrials', DE:'Industrials', LMT:'Industrials',
  NOC:'Industrials', MMM:'Industrials', FDX:'Industrials', EMR:'Industrials',
  PH:'Industrials', ETN:'Industrials', NSC:'Industrials', CSX:'Industrials',
  UNP:'Industrials', CARR:'Industrials', CTAS:'Industrials',
  XOM:'Energy', CVX:'Energy', COP:'Energy', SLB:'Energy', EOG:'Energy',
  OXY:'Energy', MPC:'Energy', PSX:'Energy', VLO:'Energy', HAL:'Energy',
  DVN:'Energy', WMB:'Energy', KMI:'Energy',
  NEE:'Utilities', DUK:'Utilities', SO:'Utilities', AEP:'Utilities',
  D:'Utilities', EXC:'Utilities', XEL:'Utilities', ED:'Utilities', PPL:'Utilities',
  AMT:'Real Estate', PLD:'Real Estate', CCI:'Real Estate', EQIX:'Real Estate',
  SPG:'Real Estate', O:'Real Estate', WELL:'Real Estate', PSA:'Real Estate',
  LIN:'Materials', SHW:'Materials', FCX:'Materials', NEM:'Materials',
  APD:'Materials', ECL:'Materials', DD:'Materials', NUE:'Materials',
  SPY:'ETF', IVV:'ETF', VTI:'ETF', VOO:'ETF', DIA:'ETF', IWM:'ETF', QQQ:'ETF',
  VNQ:'ETF', GLD:'ETF', SLV:'ETF', TLT:'ETF', BND:'ETF', AGG:'ETF', EFA:'ETF', EEM:'ETF',
  XLK:'Technology', XLF:'Financials', XLE:'Energy', XLV:'Healthcare',
  XLI:'Industrials', XLC:'Comm. Services', XLY:'Consumer Disc.',
  XLP:'Consumer Staples', XLU:'Utilities', XLB:'Materials', XLRE:'Real Estate',
}

const SECTOR_COLORS = {
  'Technology':'#4f7cf6', 'Comm. Services':'#06b6d4', 'Consumer Disc.':'#8b5cf6',
  'Consumer Staples':'#10d97b', 'Healthcare':'#f59e0b', 'Financials':'#ec4899',
  'Industrials':'#f97316', 'Energy':'#ef4444', 'Utilities':'#84cc16',
  'Real Estate':'#14b8a6', 'Materials':'#a78bfa', 'ETF':'#94a3b8', 'Other':'#475569',
}

function AllocationChart({ holdings, marketData }) {
  const getValue = (h) => {
    const close = marketData?.[h.ticker?.toUpperCase()]?.price?.close
    return (h.shares && close) ? h.shares * close : parseFloat(h.position_size || 0)
  }
  const total = holdings.reduce((s, h) => s + getValue(h), 0)
  if (!total || holdings.length === 0) return null

  const SIZE = 120, CX = 60, CY = 60, R = 52, IR = 33
  const toRad = d => (d * Math.PI) / 180
  let cum = -90

  const slices = holdings.map((h, i) => {
    const pct = getValue(h) / total
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

function Sparkline({ data, width = 140, height = 30 }) {
  if (!data || data.length < 2) return null
  const vals = data.map(d => d.total_value)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const range = max - min || 1
  const pts = vals.map((v, i) => [
    (i / (vals.length - 1)) * width,
    height - ((v - min) / range) * (height - 4) - 2,
  ])
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const trend = vals[vals.length - 1] >= vals[0]
  const color = trend ? 'var(--success)' : 'var(--danger)'
  const last = pts[pts.length - 1]
  return (
    <svg width={width} height={height} style={{ display: 'block', flexShrink: 0 }}>
      <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r={2.5} fill={color} />
    </svg>
  )
}

function SectorBreakdown({ holdings, marketData }) {
  const getValue = (h) => {
    const close = marketData?.[h.ticker?.toUpperCase()]?.price?.close
    return (h.shares && close) ? h.shares * close : parseFloat(h.position_size || 0)
  }
  const sectors = {}
  holdings.forEach(h => {
    const sector = SECTOR_MAP[h.ticker?.toUpperCase()] || 'Other'
    sectors[sector] = (sectors[sector] || 0) + getValue(h)
  })
  const total = Object.values(sectors).reduce((s, v) => s + v, 0)
  if (!total || Object.keys(sectors).length <= 1) return null
  const sorted = Object.entries(sectors).sort((a, b) => b[1] - a[1])
  return (
    <div style={{ marginBottom: 12, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: 6 }}>Sector Allocation</div>
      <div style={{ height: 6, borderRadius: 3, display: 'flex', overflow: 'hidden', gap: 1, marginBottom: 8 }}>
        {sorted.map(([s, v]) => (
          <div key={s} style={{ flex: v / total, background: SECTOR_COLORS[s] || '#475569', minWidth: 2 }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 10px' }}>
        {sorted.map(([s, v]) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
            <div style={{ width: 5, height: 5, borderRadius: 1, background: SECTOR_COLORS[s] || '#475569', flexShrink: 0 }} />
            <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>{s}</span>
            <span style={{ color: 'var(--text-2)' }}>{(v / total * 100).toFixed(0)}%</span>
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
        {new Date(briefing.generated_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })} ET
      </span>
    </div>
  )
}

export default function Dashboard() {
  usePageTitle('Dashboard')
  const toast = useToast()
  const [advisor, setAdvisor] = useState(null)
  const [briefing, setBriefing] = useState(null)
  const [holdings, setHoldings] = useState([])
  const [marketData, setMarketData] = useState({})
  const [alerts, setAlerts] = useState([])
  const [emails, setEmails] = useState([])
  const [priceAlerts, setPriceAlerts] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [generating, setGenerating] = useState(false)
  const [genMsgIdx, setGenMsgIdx] = useState(0)
  const [genProgress, setGenProgress] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const genTimers = useRef([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [adv, h, a, e, pa] = await Promise.all([
        api.getAdvisor(), api.getHoldings(), api.getFilingAlerts(), api.getClientEmails(), api.getPriceAlerts(),
      ])
      setAdvisor(adv); setHoldings(h); setAlerts(a); setEmails(e); setPriceAlerts(pa)
      if (h.length > 0) {
        try { setMarketData(await api.getMarketData()) } catch (_) {}
        try { setBriefing(await api.getLatestBriefing()) } catch (_) {}
        api.getPortfolioSnapshots(30).then(s => setSnapshots(s)).catch(() => {})
      }
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (!generating) {
      genTimers.current.forEach(clearInterval)
      genTimers.current = []
      setGenMsgIdx(0)
      setGenProgress(0)
      return
    }
    const t1 = setInterval(() => setGenMsgIdx(i => (i + 1) % GENERATING_MESSAGES.length), 4000)
    const t2 = setInterval(() => setGenProgress(p => Math.min(p + 1.2, 90)), 600)
    genTimers.current = [t1, t2]
    return () => { clearInterval(t1); clearInterval(t2) }
  }, [generating])

  async function handleGenerate() {
    setGenerating(true); setError(null); setGenProgress(0); setGenMsgIdx(0)
    try {
      const b = await api.generateBriefing()
      setGenProgress(100)
      setBriefing(b)
      // Refresh snapshots after generating so sparkline updates
      api.getPortfolioSnapshots(30).then(s => setSnapshots(s)).catch(() => {})
    } catch (e) {
      if (e.code === 'subscription_required') {
        setError('Your free trial has ended. Subscribe to continue generating briefings.')
      } else {
        setError(e.message)
      }
    } finally {
      setGenerating(false)
    }
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

  const toETDateStr = d => new Date(d).toLocaleDateString('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })
  const todayStr = toETDateStr(new Date())
  const briefingIsToday = briefing && toETDateStr(briefing.generated_at) === todayStr
  const triggeredAlerts = priceAlerts.filter(a => !a.active && !a.read)

  const portfolioTone = briefing?.content
    ? (briefing.content.match(/overall portfolio tone:\s*(constructive|cautious|mixed)/i)?.[1] || null)
    : null
  const toneColor = portfolioTone?.toUpperCase() === 'CONSTRUCTIVE' ? 'var(--success)'
    : portfolioTone?.toUpperCase() === 'CAUTIOUS' ? 'var(--warning)'
    : 'var(--accent)'

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
            <button className="btn btn-outline" style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => api.resendVerification(advisor.email).then(() => toast.success('Verification email sent')).catch(() => toast.error('Failed to resend — try again'))}>Resend</button>
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
            onClick={() => api.resendVerification(advisor.email).then(() => toast.success('Verification email sent')).catch(() => toast.error('Failed to resend — try again'))}
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
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 10, background: portfolioTone ? `${toneColor}18` : 'rgba(16,185,129,0.15)', color: portfolioTone ? toneColor : 'var(--success)', letterSpacing: '0.04em', border: portfolioTone ? `1px solid ${toneColor}30` : 'none' }}>
                  ◆ {portfolioTone ? portfolioTone.charAt(0).toUpperCase() + portfolioTone.slice(1).toLowerCase() : 'Briefing ready'} · {new Date(briefing.generated_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })} ET
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
            {totalPortfolio >= 1e6
              ? `$${(totalPortfolio / 1e6).toFixed(2)}M`
              : totalPortfolio >= 1000
                ? `$${Math.round(totalPortfolio / 1000)}K`
                : totalPortfolio > 0
                  ? `$${Math.round(totalPortfolio).toLocaleString()}`
                  : `${holdings.length} pos`}
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
        <div className="stat-card" onClick={() => navigate('/watchlist')} style={{ cursor: triggeredAlerts.length > 0 ? 'pointer' : undefined }}>
          <div className="stat-label">Price Alerts</div>
          <div className="stat-value" style={{ color: triggeredAlerts.length > 0 ? 'var(--warning)' : undefined }}>
            {triggeredAlerts.length}
          </div>
          <div className="stat-sub">{triggeredAlerts.length > 0 ? `${triggeredAlerts.length} triggered · tap to review` : `${priceAlerts.filter(a => a.active).length} active`}</div>
        </div>
      </div>

      {snapshots.length >= 2 && (() => {
        const first = snapshots[0].total_value
        const last = snapshots[snapshots.length - 1].total_value
        const trendPct = first > 0 ? ((last - first) / first) * 100 : 0
        const trendUp = last >= first
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-2)', flexShrink: 0 }}>30d Trend</span>
            <Sparkline data={snapshots} width={140} height={30} />
            <span style={{ fontSize: 13, fontWeight: 700, color: trendUp ? 'var(--success)' : 'var(--danger)', fontVariantNumeric: 'tabular-nums' }}>
              {trendUp ? '+' : ''}{trendPct.toFixed(1)}%
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
              ${(first / 1000).toFixed(0)}K → ${(last / 1000).toFixed(0)}K
            </span>
          </div>
        )
      })()}

      {/* Today's Movers */}
      {holdings.length > 0 && Object.keys(marketData).length > 0 && (() => {
        const movers = holdings
          .map(h => ({ ticker: h.ticker, pct: marketData[h.ticker]?.price?.pct_change }))
          .filter(m => m.pct != null)
          .sort((a, b) => b.pct - a.pct)
        if (!movers.length) return null
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-2)', flexShrink: 0 }}>Today</span>
            {movers.map(m => (
              <span key={m.ticker} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                background: m.pct > 0 ? 'rgba(16,185,129,0.12)' : m.pct < 0 ? 'rgba(239,68,68,0.12)' : 'var(--surface-2)',
                color: m.pct > 0 ? 'var(--success)' : m.pct < 0 ? 'var(--danger)' : 'var(--text-2)',
                border: `1px solid ${m.pct > 0 ? 'rgba(16,185,129,0.25)' : m.pct < 0 ? 'rgba(239,68,68,0.25)' : 'var(--border)'}`,
              }}>
                <span style={{ fontSize: 10, opacity: 0.8 }}>{m.ticker}</span>
                {m.pct > 0 ? '▲' : m.pct < 0 ? '▼' : '—'} {Math.abs(m.pct).toFixed(2)}%
              </span>
            ))}
          </div>
        )
      })()}

      {/* Morning Briefing */}
      <div className="card card-glow">
        <div className="card-header">
          <div className="card-title">Morning Briefing</div>
          {briefing && <BriefingActions briefing={briefing} advisorEmail={advisor?.email} />}
        </div>

        {generating ? (
          <div className="generating-box">
            <div className="spin" />
            <div className="generating-title">Analyzing your portfolio...</div>
            <div className="generating-sub" style={{ marginBottom: 20 }}>
              {GENERATING_MESSAGES[genMsgIdx]}
            </div>
            <div style={{ background: 'var(--surface-2)', borderRadius: 4, height: 3, overflow: 'hidden', maxWidth: 320, margin: '0 auto' }}>
              <div style={{ height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, var(--accent), var(--accent-b))', width: `${genProgress}%`, transition: 'width 0.6s ease' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 10 }}>
              Analyzing {holdings.length} holding{holdings.length !== 1 ? 's' : ''} · ~30–60 seconds
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

      {/* Triggered price alerts */}
      {triggeredAlerts.length > 0 && (
        <div className="card" style={{ padding: '14px 20px', marginBottom: 20, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--warning)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              🔔 {triggeredAlerts.length} Price Alert{triggeredAlerts.length !== 1 ? 's' : ''} Triggered
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/watchlist')} style={{ fontSize: 11 }}>
              View Watchlist →
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {triggeredAlerts.slice(0, 6).map(a => {
              const label = a.alert_type === 'above'
                ? `${a.ticker} rose above $${Number(a.threshold).toFixed(2)}`
                : a.alert_type === 'below'
                  ? `${a.ticker} fell below $${Number(a.threshold).toFixed(2)}`
                  : `${a.ticker} moved ±${Number(a.threshold).toFixed(1)}%`
              return (
                <span key={a.id} style={{
                  fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20,
                  background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
                  color: 'var(--warning)',
                }}>
                  {label}
                </span>
              )
            })}
            {triggeredAlerts.length > 6 && (
              <span style={{ fontSize: 12, color: 'var(--text-2)', padding: '4px 0' }}>+{triggeredAlerts.length - 6} more</span>
            )}
          </div>
        </div>
      )}

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
            <AllocationChart holdings={holdings} marketData={marketData} />
            <SectorBreakdown holdings={holdings} marketData={marketData} />
            {(() => {
              const risk = holdings.filter(h => {
                const close = marketData[h.ticker]?.price?.close
                const val = (h.shares && close) ? h.shares * close : parseFloat(h.position_size || 0)
                return totalPortfolio > 0 && val / totalPortfolio >= 0.25
              })
              if (!risk.length) return null
              return (
                <div style={{ padding: '7px 12px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, marginBottom: 12, fontSize: 11, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span>⚠</span>
                  {risk.map(h => {
                    const close = marketData[h.ticker]?.price?.close
                    const val = (h.shares && close) ? h.shares * close : parseFloat(h.position_size || 0)
                    return <span key={h.ticker}><strong>{h.ticker}</strong> {(val / totalPortfolio * 100).toFixed(0)}%</span>
                  })}
                  <span style={{ color: 'var(--text-2)' }}>· High concentration</span>
                </div>
              )
            })()}
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
