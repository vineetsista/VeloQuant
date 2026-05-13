import { useState, useEffect } from 'react'
import { api } from '../api'

const LABELS = {
  SPY: 'S&P 500', QQQ: 'Nasdaq 100', DIA: 'Dow Jones',
  IWM: 'Russell 2K', TLT: '20Y Bonds', GLD: 'Gold', VIX: 'VIX',
}

const CACHE_KEY = 'ria_market_bar_v2'

function loadCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') }
  catch { return null }
}

function saveCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() })) }
  catch {}
}

function getMarketStatus() {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric', minute: 'numeric', weekday: 'short', hour12: false,
  }).formatToParts(now)
  const weekday = parts.find(p => p.type === 'weekday')?.value
  const hour    = parseInt(parts.find(p => p.type === 'hour')?.value || '0')
  const minute  = parseInt(parts.find(p => p.type === 'minute')?.value || '0')
  const total   = hour * 60 + minute
  if (weekday === 'Sat' || weekday === 'Sun') return 'closed'
  if (total >= 9 * 60 + 30 && total < 16 * 60) return 'open'
  if (total >= 4 * 60 && total < 9 * 60 + 30)  return 'pre'
  if (total >= 16 * 60 && total < 20 * 60)      return 'after'
  return 'closed'
}

const STATUS_CONFIG = {
  open:   { label: 'LIVE',        color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  pre:    { label: 'PRE-MARKET',  color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  after:  { label: 'AFTER HRS',  color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  closed: { label: 'CLOSED',     color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
}

const TICKERS = ['SPY', 'QQQ', 'DIA', 'IWM', 'TLT', 'GLD', 'VIX']

export default function MarketBar() {
  const cached  = loadCache()
  const [data,   setData]   = useState(cached?.data || {})
  const [status, setStatus] = useState(getMarketStatus())
  const [dataDate, setDataDate] = useState(null)
  const [loaded, setLoaded] = useState(!!cached?.data)

  useEffect(() => {
    // Refresh market status every minute
    const statusTimer = setInterval(() => setStatus(getMarketStatus()), 60_000)

    // Fetch fresh data (skip if cache < 15 min old and market is closed)
    const cacheAge = cached ? (Date.now() - cached.ts) / 1000 : Infinity
    const marketClosed = getMarketStatus() === 'closed'
    const skipFetch = marketClosed && cacheAge < 900 && cached?.data

    if (!skipFetch) {
      api.getMarketIndices().then(fresh => {
        // Merge: keep cached values for any tickers that came back with errors
        const merged = { ...data }
        for (const t of TICKERS) {
          const p = fresh[t]?.price
          if (p && !p.error && p.close != null) merged[t] = fresh[t]
        }
        setData(merged)
        saveCache(merged)
        // Determine the data date from the first ticker that has a date
        const firstDate = TICKERS.map(t => merged[t]?.price?.date).find(Boolean)
        setDataDate(firstDate)
        setLoaded(true)
      }).catch(() => {
        // API failed — fall back to cache silently
        if (cached?.data) {
          const firstDate = TICKERS.map(t => cached.data[t]?.price?.date).find(Boolean)
          setDataDate(firstDate)
        }
        setLoaded(true)
      })
    } else {
      const firstDate = TICKERS.map(t => data[t]?.price?.date).find(Boolean)
      setDataDate(firstDate)
      setLoaded(true)
    }

    return () => clearInterval(statusTimer)
  }, [])

  // Always render if we have any data (including cached)
  const items = TICKERS.filter(t => data[t]?.price?.close != null)
  if (!loaded && items.length === 0) return null

  const statusCfg = STATUS_CONFIG[status]

  const formatDate = (iso) => {
    if (!iso) return null
    const d = new Date(iso + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div style={{
      background: 'linear-gradient(90deg, rgba(15,23,42,0.95), rgba(15,23,42,0.90))',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      overflowX: 'auto',
      scrollbarWidth: 'none',
      minHeight: 44,
    }}>
      {/* Market status badge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 16px 0 18px',
        borderRight: '1px solid var(--border)',
        flexShrink: 0, height: 44,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: statusCfg.color,
          boxShadow: status === 'open' ? `0 0 6px ${statusCfg.color}` : 'none',
          animation: status === 'open' ? 'pulse 2s infinite' : 'none',
          flexShrink: 0,
        }} />
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
          color: statusCfg.color,
        }}>
          {statusCfg.label}
        </span>
      </div>

      {/* Ticker items */}
      {items.map((ticker, i) => {
        const price = data[ticker].price
        const pct   = price?.pct_change
        const close = price?.close
        const isVix = ticker === 'VIX'
        const up    = isVix ? pct < 0 : pct > 0
        const down  = isVix ? pct > 0 : pct < 0
        const color = pct == null ? 'var(--text-2)'
          : up   ? '#10b981'
          : down  ? '#ef4444'
          : 'var(--text-2)'

        return (
          <div key={ticker} style={{
            display: 'flex', alignItems: 'center',
            padding: '0 16px',
            borderRight: i < items.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            flexShrink: 0, height: 44, gap: 8,
          }}>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--text-2)', width: 52,
            }}>
              {LABELS[ticker] || ticker}
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{
                fontSize: 13, fontWeight: 700,
                fontVariantNumeric: 'tabular-nums', color: 'var(--text)',
                letterSpacing: '-0.01em',
              }}>
                {close != null ? (ticker === 'VIX' ? Number(close).toFixed(2) : `$${Number(close).toFixed(2)}`) : '—'}
              </span>
              {pct != null && (
                <span style={{
                  fontSize: 11, fontWeight: 700, color,
                  display: 'flex', alignItems: 'center', gap: 1,
                }}>
                  {up ? '▲' : down ? '▼' : ''}
                  {Math.abs(pct).toFixed(2)}%
                </span>
              )}
            </div>
          </div>
        )
      })}

      {/* Right label */}
      <div style={{
        marginLeft: 'auto', padding: '0 18px',
        display: 'flex', alignItems: 'center', gap: 6,
        flexShrink: 0, height: 44,
      }}>
        <span style={{ fontSize: 9, color: 'var(--text-2)', letterSpacing: '0.05em' }}>
          {status === 'open' ? 'DELAYED 15 MIN' : `PRIOR CLOSE${dataDate ? ' · ' + formatDate(dataDate) : ''}`}
        </span>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
