import { useState, useEffect } from 'react'
import { api } from '../api'

const TYPE_LABELS = {
  above:   { label: 'Price rises above', unit: '$', prefix: '$' },
  below:   { label: 'Price falls below',  unit: '$', prefix: '$' },
  pct_day: { label: 'Day move exceeds',   unit: '%', prefix: '±' },
}

function alertDescription(a) {
  const t = TYPE_LABELS[a.alert_type]
  if (!t) return ''
  return `${t.label} ${t.prefix}${a.threshold}${t.unit === '%' ? '%' : ''}`
}

export default function Watchlist() {
  const [alerts, setAlerts] = useState([])
  const [prices, setPrices] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ ticker: '', alert_type: 'above', threshold: '' })
  const [adding, setAdding] = useState(false)
  const [tab, setTab] = useState('active')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const a = await api.getPriceAlerts()
      setAlerts(a)
      const activeTickers = [...new Set(a.filter(x => x.active).map(x => x.ticker))]
      if (activeTickers.length > 0) {
        api.getMarketPrices(activeTickers).then(setPrices).catch(() => {})
      }
    }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.ticker || !form.threshold) return
    setAdding(true); setError(null)
    try {
      const a = await api.createPriceAlert(form.ticker.toUpperCase().trim(), form.alert_type, parseFloat(form.threshold))
      setAlerts(prev => [a, ...prev])
      setForm(f => ({ ...f, ticker: '', threshold: '' }))
    } catch (e) { setError(e.message) }
    finally { setAdding(false) }
  }

  async function handleDelete(id) {
    try {
      await api.deletePriceAlert(id)
      setAlerts(prev => prev.filter(a => a.id !== id))
    } catch (e) { setError(e.message) }
  }

  async function handleMarkRead(id) {
    try {
      const updated = await api.markPriceAlertRead(id)
      setAlerts(prev => prev.map(a => a.id === id ? updated : a))
    } catch (e) { setError(e.message) }
  }

  async function handleMarkAllRead() {
    try {
      await api.markAllPriceAlertsRead()
      setAlerts(prev => prev.map(a => a.active ? a : { ...a, read: true }))
    } catch (e) { setError(e.message) }
  }

  async function handleReactivate(id) {
    try {
      const updated = await api.reactivatePriceAlert(id)
      setAlerts(prev => prev.map(a => a.id === id ? updated : a))
    } catch (e) { setError(e.message) }
  }

  if (loading) return <div className="loading"><div className="spin" /><span>Loading watchlist...</span></div>

  const active    = alerts.filter(a => a.active)
  const triggered = alerts.filter(a => !a.active)
  const unread    = triggered.filter(a => !a.read).length

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Watchlist</div>
          <div className="page-subtitle">
            {active.length} active alert{active.length !== 1 ? 's' : ''}
            {unread > 0 && <span style={{ marginLeft: 8, color: 'var(--warning)', fontWeight: 700 }}>· {unread} triggered</span>}
          </div>
        </div>
      </div>

      {error && <div className="error-bar" onClick={() => setError(null)} style={{ cursor: 'pointer' }}>{error} ✕</div>}

      {/* Add alert form */}
      <div className="card card-glow" style={{ marginBottom: 20 }}>
        <div className="card-title" style={{ marginBottom: 16 }}>Set New Alert</div>
        <form onSubmit={handleAdd}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group">
              <label className="form-label">Ticker</label>
              <input
                className="form-input"
                placeholder="AAPL"
                value={form.ticker}
                onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))}
                style={{ width: 90 }}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Condition</label>
              <select
                className="form-input"
                value={form.alert_type}
                onChange={e => setForm(f => ({ ...f, alert_type: e.target.value, threshold: '' }))}
                style={{ width: 200 }}
              >
                <option value="above">Price rises above $___</option>
                <option value="below">Price falls below $___</option>
                <option value="pct_day">Day move exceeds ±___%</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{form.alert_type === 'pct_day' ? 'Threshold (%)' : 'Price ($)'}</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-2)', pointerEvents: 'none' }}>
                  {form.alert_type === 'pct_day' ? '±' : '$'}
                </span>
                <input
                  className="form-input"
                  type="number"
                  step={form.alert_type === 'pct_day' ? '0.1' : '0.01'}
                  min="0"
                  placeholder={form.alert_type === 'pct_day' ? '3.0' : '300.00'}
                  value={form.threshold}
                  onChange={e => setForm(f => ({ ...f, threshold: e.target.value }))}
                  style={{ width: 120, paddingLeft: 26 }}
                  required
                />
              </div>
            </div>
            <button className="btn btn-primary" type="submit" disabled={adding} style={{ marginBottom: 1 }}>
              {adding ? <><div className="spin spin-sm" />Adding...</> : '+ Set Alert'}
            </button>
          </div>
          {form.threshold && (() => {
            const v = parseFloat(form.threshold)
            if (form.alert_type === 'pct_day' && v > 0 && v < 0.5)
              return <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 8 }}>⚠ Tip: A threshold under 0.5% may trigger very frequently for volatile stocks.</div>
            if (form.alert_type === 'pct_day' && v > 25)
              return <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 8 }}>⚠ Tip: A 25%+ single-day move is rare — consider a lower threshold.</div>
            if ((form.alert_type === 'above' || form.alert_type === 'below') && v <= 0)
              return <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 8 }}>Price threshold must be greater than zero.</div>
            return null
          })()}
          <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 8 }}>
            Alerts are checked each morning at 7:30am ET using prior-close prices.
          </div>
        </form>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', borderRadius: 10, padding: 4 }}>
        {[['active', `Active (${active.length})`], ['history', `History (${triggered.length})`]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              background: tab === key ? 'var(--surface-2)' : 'transparent',
              color: tab === key ? 'var(--text)' : 'var(--text-2)',
              transition: 'all 0.15s',
            }}
          >
            {label}
            {key === 'history' && unread > 0 && (
              <span style={{ marginLeft: 6, background: 'var(--warning)', color: '#000', fontSize: 10, fontWeight: 800, borderRadius: 10, padding: '1px 6px' }}>
                {unread}
              </span>
            )}
          </button>
        ))}
      </div>
      {tab === 'history' && unread > 0 && (
        <button
          className="btn btn-outline"
          onClick={handleMarkAllRead}
          style={{ fontSize: 12, padding: '6px 14px' }}
        >
          ✓ Mark all read
        </button>
      )}
      </div>

      {/* Active alerts */}
      {tab === 'active' && (
        active.length === 0 ? (
          <div className="card">
            <div className="empty">
              <strong>No active alerts</strong>
              Set a price or percentage threshold above to get notified when a holding moves.
            </div>
          </div>
        ) : (
          <div className="card holdings-table-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Condition</th>
                  <th>Current</th>
                  <th>Distance</th>
                  <th>Set On</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {active.map(a => {
                  const price = prices[a.ticker.toUpperCase()]
                  const currentPrice = price?.close
                  const threshold = parseFloat(a.threshold)
                  let distancePct = null
                  let distanceLabel = null
                  let distanceColor = 'var(--text-2)'
                  if (currentPrice && a.alert_type !== 'pct_day') {
                    distancePct = ((threshold - currentPrice) / currentPrice * 100)
                    if (a.alert_type === 'above') {
                      distancePct = (threshold - currentPrice) / currentPrice * 100
                      distanceColor = distancePct < 2 ? 'var(--warning)' : 'var(--text-2)'
                      distanceLabel = distancePct >= 0 ? `${distancePct.toFixed(1)}% away` : 'Passed'
                    } else {
                      distancePct = (currentPrice - threshold) / currentPrice * 100
                      distanceColor = distancePct < 2 ? 'var(--warning)' : 'var(--text-2)'
                      distanceLabel = distancePct >= 0 ? `${distancePct.toFixed(1)}% away` : 'Passed'
                    }
                  }
                  return (
                    <tr key={a.id}>
                      <td><span className="chip">{a.ticker}</span></td>
                      <td>
                        <span style={{ fontSize: 13, color: 'var(--text)' }}>{alertDescription(a)}</span>
                      </td>
                      <td>
                        {currentPrice != null
                          ? <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>${Number(currentPrice).toFixed(2)}</span>
                          : <span style={{ color: 'var(--text-2)', fontSize: 12 }}>—</span>}
                      </td>
                      <td>
                        {distanceLabel
                          ? <span style={{ fontSize: 12, fontWeight: 600, color: distanceColor }}>{distanceLabel}</span>
                          : <span style={{ color: 'var(--text-2)', fontSize: 12 }}>—</span>}
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                          {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(a.id)} style={{ fontSize: 11 }}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Triggered history */}
      {tab === 'history' && (
        triggered.length === 0 ? (
          <div className="card">
            <div className="empty">
              <strong>No triggered alerts yet</strong>
              Alerts that fire will appear here with the price at which they triggered.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {triggered.sort((a, b) => new Date(b.triggered_at) - new Date(a.triggered_at)).map(a => (
              <div
                key={a.id}
                className="card"
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                  border: !a.read ? '1px solid rgba(245,158,11,0.4)' : undefined,
                  background: !a.read ? 'rgba(245,158,11,0.04)' : undefined,
                }}
              >
                <span className="chip" style={{ flexShrink: 0 }}>{a.ticker}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>
                    {alertDescription(a)}
                    {!a.read && <span className="badge badge-yellow" style={{ marginLeft: 8, fontSize: 10 }}>New</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                    Triggered at <strong style={{ color: 'var(--text)' }}>
                      {a.alert_type === 'pct_day' ? `±${a.triggered_price?.toFixed(2)}%` : `$${Number(a.triggered_price).toFixed(2)}`}
                    </strong>
                    {' · '}
                    {new Date(a.triggered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {!a.read && (
                    <button className="btn btn-outline btn-sm" onClick={() => handleMarkRead(a.id)} style={{ fontSize: 11 }}>
                      Mark Read
                    </button>
                  )}
                  <button className="btn btn-outline btn-sm" onClick={() => handleReactivate(a.id)} style={{ fontSize: 11, color: 'var(--success)' }} title="Re-arm this alert to watch for the same condition again">
                    ↺ Re-arm
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(a.id)} style={{ fontSize: 11 }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
