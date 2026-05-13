import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import BriefingRenderer from '../components/BriefingRenderer'

function BriefingActions({ briefing }) {
  const [copied, setCopied] = useState(false)
  const [emailing, setEmailing] = useState(false)
  const [emailSent, setEmailSent] = useState(briefing?.delivered || false)

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
    } catch (e) {
      alert(e.message)
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
  const totalPortfolio = holdings.reduce((s, h) => s + parseFloat(h.position_size), 0)

  const showVerifyBanner = advisor && advisor.email_verified === false && !advisor.is_legacy

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
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div className="page-title">{advisor?.name}</div>
            <div className="page-subtitle">{advisor?.firm_name} · {date}</div>
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
          <div className="stat-sub">
            {totalPortfolio > 0 ? `${holdings.length} position${holdings.length !== 1 ? 's' : ''}` : 'positions tracked'}
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
            holdings.map(h => {
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
            })
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
