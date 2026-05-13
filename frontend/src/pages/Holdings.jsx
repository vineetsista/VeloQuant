import { useState, useEffect } from 'react'
import { api } from '../api'

const SECTOR_MAP = {
  AAPL:'Technology', MSFT:'Technology', GOOGL:'Technology', GOOG:'Technology', META:'Technology',
  NVDA:'Technology', AMD:'Technology', INTC:'Technology', AVGO:'Technology', QCOM:'Technology',
  AMZN:'Consumer', TSLA:'Consumer', HD:'Consumer', NKE:'Consumer', SBUX:'Consumer', MCD:'Consumer',
  JPM:'Financials', GS:'Financials', MS:'Financials', BAC:'Financials', WFC:'Financials', 'BRK.B':'Financials',
  JNJ:'Healthcare', UNH:'Healthcare', PFE:'Healthcare', ABBV:'Healthcare', MRK:'Healthcare', LLY:'Healthcare',
  XOM:'Energy', CVX:'Energy', COP:'Energy', SLB:'Energy',
  GE:'Industrials', BA:'Industrials', CAT:'Industrials', HON:'Industrials', UPS:'Industrials',
  VTI:'ETF', SPY:'ETF', QQQ:'ETF', IWM:'ETF', TLT:'ETF', GLD:'ETF', SHY:'ETF', DIA:'ETF',
}

const SECTOR_COLORS = {
  Technology:'#4f7cf6', Financials:'#06b6d4', Healthcare:'#10b981',
  Consumer:'#f59e0b', Energy:'#ef4444', Industrials:'#8b5cf6',
  ETF:'#64748b', Other:'#94a3b8',
}

function getSector(t) { return SECTOR_MAP[t.toUpperCase()] || 'Other' }

function PriceChange({ pct }) {
  if (pct == null) return <span style={{ color: 'var(--text-2)' }}>—</span>
  if (pct > 0)  return <span className="price-up">▲ {Math.abs(pct).toFixed(2)}%</span>
  if (pct < 0)  return <span className="price-down">▼ {Math.abs(pct).toFixed(2)}%</span>
  return <span className="price-flat">— 0.00%</span>
}

export default function Holdings() {
  const [holdings,   setHoldings]   = useState([])
  const [marketData, setMarketData] = useState({})
  const [ticker,     setTicker]     = useState('')
  const [size,       setSize]       = useState('')
  const [loading,    setLoading]    = useState(true)
  const [adding,     setAdding]     = useState(false)
  const [error,      setError]      = useState(null)
  const [sortBy,     setSortBy]     = useState('size')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const h = await api.getHoldings()
      setHoldings(h)
      if (h.length > 0) {
        try { setMarketData(await api.getMarketData()) } catch (_) {}
      }
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!ticker || !size) return
    setAdding(true); setError(null)
    try {
      const h = await api.addHolding(ticker.toUpperCase().trim(), parseFloat(size))
      setHoldings(prev => {
        const ex = prev.find(x => x.ticker === h.ticker)
        return ex ? prev.map(x => x.ticker === h.ticker ? h : x) : [...prev, h]
      })
      setTicker(''); setSize('')
      // Refresh market data after adding
      try { setMarketData(await api.getMarketData()) } catch (_) {}
    } catch (e) { setError(e.message) }
    finally { setAdding(false) }
  }

  async function handleDelete(id) {
    try {
      await api.deleteHolding(id)
      setHoldings(prev => prev.filter(h => h.id !== id))
    } catch (e) { setError(e.message) }
  }

  if (loading) return <div className="loading"><div className="spin" /><span>Loading holdings...</span></div>

  const totalValue = holdings.reduce((s, h) => s + parseFloat(h.position_size), 0)

  // Sector breakdown
  const sectorMap = {}
  holdings.forEach(h => {
    const s = getSector(h.ticker)
    sectorMap[s] = (sectorMap[s] || 0) + parseFloat(h.position_size)
  })
  const sectors = Object.entries(sectorMap).sort((a, b) => b[1] - a[1])

  // Analytics
  const dayChange = holdings.reduce((sum, h) => {
    const md = marketData[h.ticker]?.price
    if (!md?.pct_change || !md?.close) return sum
    const prevClose = md.close / (1 + md.pct_change / 100)
    const shares = parseFloat(h.position_size) / md.close
    return sum + (md.close - prevClose) * shares
  }, 0)

  const topMover = holdings
    .map(h => ({ h, pct: marketData[h.ticker]?.price?.pct_change }))
    .filter(x => x.pct != null)
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))[0]

  const concentration = totalValue > 0
    ? Math.max(...holdings.map(h => parseFloat(h.position_size) / totalValue * 100))
    : 0

  const sorted = [...holdings].sort((a, b) => {
    if (sortBy === 'size')   return parseFloat(b.position_size) - parseFloat(a.position_size)
    if (sortBy === 'ticker') return a.ticker.localeCompare(b.ticker)
    if (sortBy === 'change') {
      const pa = marketData[a.ticker]?.price?.pct_change ?? -999
      const pb = marketData[b.ticker]?.price?.pct_change ?? -999
      return pb - pa
    }
    return 0
  })

  const hasMarketData = holdings.some(h => marketData[h.ticker]?.price?.close != null)

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Holdings</div>
        <div className="page-subtitle">
          {holdings.length} position{holdings.length !== 1 ? 's' : ''} · ${totalValue.toLocaleString()} total allocated
        </div>
      </div>

      {error && <div className="error-bar" onClick={() => setError(null)} style={{ cursor: 'pointer' }}>{error} ✕</div>}

      {/* Analytics cards */}
      {holdings.length > 0 && (
        <div className="stats-row" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Portfolio Value</div>
            <div className="stat-value">${(totalValue / 1000).toFixed(0)}K</div>
            <div className="stat-sub">{holdings.length} active positions</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Est. Day Change</div>
            <div className="stat-value" style={{
              color: dayChange > 0 ? 'var(--success)' : dayChange < 0 ? 'var(--danger)' : 'var(--text)',
              fontSize: 28,
            }}>
              {hasMarketData
                ? `${dayChange >= 0 ? '+' : ''}$${Math.abs(dayChange).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                : '—'}
            </div>
            <div className="stat-sub">vs. prior close</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Top Concentration</div>
            <div className="stat-value" style={{
              color: concentration > 40 ? 'var(--warning)' : 'var(--text)',
              fontSize: 28,
            }}>
              {concentration.toFixed(0)}%
            </div>
            <div className="stat-sub">{concentration > 40 ? '⚠ Consider diversifying' : '✓ Well diversified'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Top Mover</div>
            <div className="stat-value" style={{
              fontSize: 24,
              color: topMover
                ? topMover.pct > 0 ? 'var(--success)' : 'var(--danger)'
                : 'var(--text-2)',
            }}>
              {topMover
                ? `${topMover.pct > 0 ? '▲' : '▼'} ${Math.abs(topMover.pct).toFixed(2)}%`
                : '—'}
            </div>
            <div className="stat-sub">{topMover ? topMover.h.ticker : 'No data yet'}</div>
          </div>
        </div>
      )}

      <div className={holdings.length > 0 ? 'grid-2' : undefined} style={{ marginBottom: 20 }}>
        {/* Add form */}
        <div className="card card-glow">
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 18, letterSpacing: '-0.01em' }}>
            Add Position
          </div>
          <form onSubmit={handleAdd} className="form-row" style={{ flexWrap: 'wrap' }}>
            <div className="form-group">
              <label className="form-label">Ticker</label>
              <input
                className="form-input"
                placeholder="AAPL"
                value={ticker}
                onChange={e => setTicker(e.target.value.toUpperCase())}
                style={{ width: 100 }}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Position Size ($)</label>
              <input
                className="form-input"
                type="number"
                placeholder="50,000"
                value={size}
                onChange={e => setSize(e.target.value)}
                style={{ width: 150 }}
                required
                min="1"
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={adding} style={{ marginTop: 21 }}>
              {adding ? <><div className="spin spin-sm" />Adding...</> : '+ Add Position'}
            </button>
          </form>
        </div>

        {/* Sector breakdown */}
        {sectors.length > 0 && (
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: 16 }}>
              Sector Allocation
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sectors.map(([sector, val]) => {
                const pct = totalValue > 0 ? (val / totalValue * 100) : 0
                const color = SECTOR_COLORS[sector] || SECTOR_COLORS.Other
                return (
                  <div key={sector}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0, boxShadow: `0 0 6px ${color}88` }} />
                        {sector}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ height: 5, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        width: `${pct}%`, height: '100%', borderRadius: 4,
                        background: `linear-gradient(90deg, ${color}, ${color}99)`,
                        transition: 'width 0.6s cubic-bezier(0.2, 0, 0, 1)',
                        boxShadow: `0 0 8px ${color}55`,
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Holdings table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {holdings.length === 0 ? (
          <div className="empty">
            <strong>No holdings yet</strong>
            Add your first position above to start receiving personalized intelligence.
          </div>
        ) : (
          <>
            {/* Table header */}
            <div style={{
              padding: '14px 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.02)',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>
                {holdings.length} Position{holdings.length !== 1 ? 's' : ''}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[['size', 'By Value'], ['ticker', 'A–Z'], ['change', 'By Change']].map(([s, lbl]) => (
                  <button key={s} onClick={() => setSortBy(s)} style={{
                    fontSize: 11, padding: '4px 11px', borderRadius: 6,
                    border: `1px solid ${sortBy === s ? 'var(--accent)' : 'var(--border)'}`,
                    background: sortBy === s ? 'rgba(79,124,246,0.12)' : 'transparent',
                    color: sortBy === s ? 'var(--accent)' : 'var(--text-2)',
                    cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                    transition: 'all 0.14s',
                  }}>{lbl}</button>
                ))}
              </div>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Sector</th>
                  <th>Position</th>
                  <th>Last Close</th>
                  <th>Day Change</th>
                  <th>% of Portfolio</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(h => {
                  const md = marketData[h.ticker]?.price
                  const pct = md?.pct_change
                  const close = md?.close
                  const portfolioPct = totalValue > 0 ? (parseFloat(h.position_size) / totalValue * 100) : 0
                  const sector = getSector(h.ticker)
                  const sColor = SECTOR_COLORS[sector] || SECTOR_COLORS.Other

                  return (
                    <tr key={h.id}>
                      <td>
                        <span className="chip" style={{ fontSize: 12 }}>{h.ticker}</span>
                      </td>
                      <td>
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: sColor,
                          background: `${sColor}18`, padding: '3px 9px', borderRadius: 20,
                          border: `1px solid ${sColor}30`,
                        }}>{sector}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>
                          ${parseFloat(h.position_size).toLocaleString()}
                        </div>
                      </td>
                      <td>
                        {close != null
                          ? <span style={{ fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>
                              ${Number(close).toFixed(2)}
                            </span>
                          : <span style={{ color: 'var(--text-2)' }}>—</span>}
                      </td>
                      <td>
                        <PriceChange pct={pct} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 100 }}>
                          <div style={{ flex: 1, height: 5, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{
                              width: `${portfolioPct}%`, height: '100%',
                              background: 'linear-gradient(90deg, var(--accent), var(--accent-b))',
                              borderRadius: 4,
                              boxShadow: '0 0 6px rgba(79,124,246,0.5)',
                            }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', width: 38, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                            {portfolioPct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(h.id)}
                          style={{ fontSize: 11 }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )
}
