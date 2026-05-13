import { useState, useEffect } from 'react'
import { api } from '../api'

const TYPE_COLOR = { '10-K': 'var(--accent)', '10-Q': 'var(--accent-b)', '8-K': 'var(--warning)', 'DEF 14A': 'var(--success)' }

export default function FilingAlerts() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState(null)
  const [scanDays, setScanDays] = useState(7)
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState(null)
  const [markingAll, setMarkingAll] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { setAlerts(await api.getFilingAlerts()) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleScan() {
    setScanning(true); setError(null)
    try {
      const result = await api.analyzeFilings(scanDays)
      if (result.new_alerts > 0) {
        const fresh = await api.getFilingAlerts()
        setAlerts(fresh)
      } else {
        setError(`Scan complete — no new filings found in the last ${scanDays} day${scanDays !== 1 ? 's' : ''}.`)
      }
    } catch (e) { setError(e.message) }
    finally { setScanning(false) }
  }

  async function handleMarkRead(id) {
    try {
      const updated = await api.markAlertRead(id)
      setAlerts(prev => prev.map(a => a.id === id ? updated : a))
    } catch (e) { setError(e.message) }
  }

  async function handleMarkAllRead() {
    setMarkingAll(true)
    try {
      const unread = alerts.filter(a => !a.read)
      await Promise.all(unread.map(a => api.markAlertRead(a.id)))
      setAlerts(prev => prev.map(a => ({ ...a, read: true })))
    } catch (e) { setError(e.message) }
    finally { setMarkingAll(false) }
  }

  if (loading) return <div className="loading"><div className="spin" /><span>Loading filing alerts...</span></div>

  const unread = alerts.filter(a => !a.read).length
  const types = ['all', ...new Set(alerts.map(a => a.filing_type))]

  const filtered = alerts.filter(a => {
    if (filter === 'unread') return !a.read
    if (filter !== 'all') return a.filing_type === filter
    return true
  })

  // Group by ticker
  const grouped = {}
  filtered.forEach(a => {
    if (!grouped[a.ticker]) grouped[a.ticker] = []
    grouped[a.ticker].push(a)
  })

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="page-title">Filing Alerts</div>
            <div className="page-subtitle">{alerts.length} alert{alerts.length !== 1 ? 's' : ''} · {unread} unread</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {unread > 0 && (
              <button className="btn btn-outline" onClick={handleMarkAllRead} disabled={markingAll} style={{ fontSize: 12 }}>
                {markingAll ? 'Marking...' : `Mark All Read (${unread})`}
              </button>
            )}
            <select value={scanDays} onChange={e => setScanDays(Number(e.target.value))} className="form-input" style={{ width: 140 }}>
              <option value={1}>Last 24 hours</option>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
            </select>
            <button className="btn btn-primary" onClick={handleScan} disabled={scanning}>
              {scanning ? <><div className="spin spin-sm" />Scanning...</> : '◎ Scan Filings'}
            </button>
          </div>
        </div>
      </div>

      {scanning && (
        <div className="card card-glow" style={{ marginBottom: 20 }}>
          <div className="generating-box">
            <div className="spin" />
            <div className="generating-title">Reading SEC filings...</div>
            <div className="generating-sub">
              Fetching and analyzing 10-K, 10-Q, and 8-K filings for all holdings.<br />
              Extracting what actually matters. This may take a minute.
            </div>
          </div>
        </div>
      )}

      {error && <div className="error-bar" onClick={() => setError(null)} style={{ cursor: 'pointer' }}>{error} ✕</div>}

      {/* Filter tabs */}
      {alerts.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {['all', 'unread', ...new Set(alerts.map(a => a.filing_type))].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                border: `1px solid ${filter === f ? 'var(--accent)' : 'var(--border)'}`,
                background: filter === f ? 'rgba(79,124,246,0.12)' : 'transparent',
                color: filter === f ? 'var(--accent)' : 'var(--text-2)',
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              }}
            >
              {f === 'all' ? `All (${alerts.length})` : f === 'unread' ? `Unread (${unread})` : f}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty">
            <strong>{filter === 'unread' ? 'All caught up!' : 'No filing alerts'}</strong>
            {filter === 'unread' ? 'No unread alerts.' : 'Run a scan to analyze recent SEC filings for your holdings.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Object.entries(grouped).map(([ticker, tickerAlerts]) => (
            <div key={ticker} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Ticker header */}
              <div style={{
                padding: '12px 20px',
                background: 'var(--surface)',
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span className="chip">{ticker}</span>
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  {tickerAlerts.length} filing{tickerAlerts.length !== 1 ? 's' : ''}
                </span>
                {tickerAlerts.some(a => !a.read) && (
                  <span className="badge badge-yellow">{tickerAlerts.filter(a => !a.read).length} new</span>
                )}
              </div>

              {/* Alerts for this ticker */}
              {tickerAlerts.sort((a, b) => new Date(b.filing_date) - new Date(a.filing_date)).map((a, i) => (
                <div
                  key={a.id}
                  style={{
                    padding: '16px 20px',
                    borderBottom: i < tickerAlerts.length - 1 ? '1px solid var(--border)' : 'none',
                    opacity: a.read ? 0.6 : 1,
                    transition: 'opacity 0.2s',
                    cursor: 'pointer',
                  }}
                  onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                          color: TYPE_COLOR[a.filing_type] || 'var(--text-2)',
                          background: `${TYPE_COLOR[a.filing_type] || 'var(--text-2)'}18`,
                        }}>{a.filing_type}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-2)' }}>
                          {new Date(a.filing_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        {!a.read && <span className="badge badge-yellow">New</span>}
                      </div>
                      <div style={{
                        fontSize: 13, color: 'var(--text)', lineHeight: 1.7,
                        overflow: expanded === a.id ? 'visible' : 'hidden',
                        display: expanded === a.id ? 'block' : '-webkit-box',
                        WebkitLineClamp: expanded === a.id ? undefined : 3,
                        WebkitBoxOrient: 'vertical',
                      }}>
                        {a.key_insight}
                      </div>
                      {a.key_insight.length > 200 && (
                        <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 4, fontWeight: 600 }}>
                          {expanded === a.id ? 'Show less ▲' : 'Read more ▼'}
                        </div>
                      )}
                    </div>
                    {!a.read && (
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ flexShrink: 0 }}
                        onClick={ev => { ev.stopPropagation(); handleMarkRead(a.id) }}
                      >
                        Mark Read
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
