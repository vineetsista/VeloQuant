import { useState, useEffect } from 'react'
import { api } from '../api'

const SECTOR_MAP = {
  // Technology
  AAPL:'Technology', MSFT:'Technology', GOOGL:'Technology', GOOG:'Technology', META:'Technology',
  NVDA:'Technology', AMD:'Technology', INTC:'Technology', AVGO:'Technology', QCOM:'Technology',
  CRM:'Technology', ORCL:'Technology', ADBE:'Technology', NOW:'Technology', WDAY:'Technology',
  INTU:'Technology', PANW:'Technology', CRWD:'Technology', NET:'Technology', SNOW:'Technology',
  PLTR:'Technology', CSCO:'Technology', IBM:'Technology', HPQ:'Technology', DELL:'Technology',
  AMAT:'Technology', LRCX:'Technology', KLAC:'Technology', MRVL:'Technology', MU:'Technology',
  ANET:'Technology', FTNT:'Technology', CTSH:'Technology', ACN:'Technology', SHOP:'Technology',
  SQ:'Technology', PYPL:'Technology', DDOG:'Technology', ZS:'Technology', OKTA:'Technology',
  TWLO:'Technology', ZM:'Technology', MDB:'Technology', EPAM:'Technology', FFIV:'Technology',
  // Consumer Discretionary
  AMZN:'Consumer', TSLA:'Consumer', HD:'Consumer', NKE:'Consumer', SBUX:'Consumer', MCD:'Consumer',
  WMT:'Consumer', TGT:'Consumer', COST:'Consumer', LOW:'Consumer', ETSY:'Consumer', EBAY:'Consumer',
  LYFT:'Consumer', UBER:'Consumer', ABNB:'Consumer', DPZ:'Consumer', CMG:'Consumer', YUM:'Consumer',
  DIS:'Consumer', LVS:'Consumer', MGM:'Consumer', RCL:'Consumer', CCL:'Consumer',
  DAL:'Consumer', UAL:'Consumer', LUV:'Consumer', BBY:'Consumer', TJX:'Consumer', ROST:'Consumer',
  // Consumer Staples
  PG:'Staples', KO:'Staples', PEP:'Staples', PM:'Staples', MO:'Staples',
  CL:'Staples', KMB:'Staples', GIS:'Staples', K:'Staples', HSY:'Staples', MDLZ:'Staples',
  KR:'Staples', DG:'Staples', DLTR:'Staples', HRL:'Staples', MKC:'Staples',
  // Financials
  JPM:'Financials', GS:'Financials', MS:'Financials', BAC:'Financials', WFC:'Financials', 'BRK.B':'Financials',
  AXP:'Financials', COF:'Financials', DFS:'Financials', BK:'Financials', STT:'Financials', SCHW:'Financials',
  USB:'Financials', PNC:'Financials', TFC:'Financials', KEY:'Financials', CFG:'Financials',
  SPGI:'Financials', MCO:'Financials', ICE:'Financials', CME:'Financials', CBOE:'Financials',
  NDAQ:'Financials', BLK:'Financials', KKR:'Financials', BX:'Financials', TROW:'Financials',
  AFL:'Financials', MET:'Financials', PRU:'Financials', AIG:'Financials', CB:'Financials',
  // Healthcare
  JNJ:'Healthcare', UNH:'Healthcare', PFE:'Healthcare', ABBV:'Healthcare', MRK:'Healthcare', LLY:'Healthcare',
  ABT:'Healthcare', TMO:'Healthcare', DHR:'Healthcare', BSX:'Healthcare', ISRG:'Healthcare',
  SYK:'Healthcare', MDT:'Healthcare', ILMN:'Healthcare', VRTX:'Healthcare', BIIB:'Healthcare',
  REGN:'Healthcare', GILD:'Healthcare', AMGN:'Healthcare', BMY:'Healthcare',
  CVS:'Healthcare', HCA:'Healthcare', CI:'Healthcare', HUM:'Healthcare', ELV:'Healthcare',
  MOH:'Healthcare', CNC:'Healthcare', HOLX:'Healthcare', EW:'Healthcare', ZBH:'Healthcare',
  // Energy
  XOM:'Energy', CVX:'Energy', COP:'Energy', SLB:'Energy', OXY:'Energy', DVN:'Energy',
  PXD:'Energy', EOG:'Energy', MPC:'Energy', VLO:'Energy', PSX:'Energy',
  HES:'Energy', BKR:'Energy', HAL:'Energy', APA:'Energy', FANG:'Energy',
  // Industrials
  GE:'Industrials', BA:'Industrials', CAT:'Industrials', HON:'Industrials', UPS:'Industrials',
  LMT:'Industrials', RTX:'Industrials', GD:'Industrials', NOC:'Industrials',
  DE:'Industrials', EMR:'Industrials', ROP:'Industrials', ITW:'Industrials', ETN:'Industrials',
  WM:'Industrials', RSG:'Industrials', CTAS:'Industrials', ADP:'Industrials', PAYX:'Industrials',
  VRSK:'Industrials', FDX:'Industrials', EXPD:'Industrials', CARR:'Industrials', OTIS:'Industrials',
  // Real Estate
  AMT:'Real Estate', PLD:'Real Estate', CCI:'Real Estate', EQIX:'Real Estate', DLR:'Real Estate',
  O:'Real Estate', VICI:'Real Estate', SPG:'Real Estate', EQR:'Real Estate',
  AVB:'Real Estate', PSA:'Real Estate', EXR:'Real Estate', WELL:'Real Estate',
  // Utilities
  NEE:'Utilities', DUK:'Utilities', SO:'Utilities', D:'Utilities', AEP:'Utilities',
  EXC:'Utilities', XEL:'Utilities', PCG:'Utilities', SRE:'Utilities', AWK:'Utilities',
  // Communications
  NFLX:'Communications', T:'Communications', VZ:'Communications', TMUS:'Communications',
  CHTR:'Communications', CMCSA:'Communications', WBD:'Communications', PARA:'Communications',
  // Materials
  LIN:'Materials', APD:'Materials', FCX:'Materials', NEM:'Materials',
  ECL:'Materials', SHW:'Materials', PPG:'Materials', NUE:'Materials', STLD:'Materials',
  // ETFs
  VTI:'ETF', SPY:'ETF', QQQ:'ETF', IWM:'ETF', TLT:'ETF', GLD:'ETF', SHY:'ETF', DIA:'ETF',
  XLF:'ETF', XLK:'ETF', XLE:'ETF', XLV:'ETF', XLI:'ETF', XLRE:'ETF', XLP:'ETF', XLU:'ETF',
  XLB:'ETF', XLC:'ETF', SPYD:'ETF', VYM:'ETF', SCHD:'ETF', JEPI:'ETF', ARKK:'ETF',
  IAU:'ETF', SLV:'ETF', USO:'ETF', HYG:'ETF', LQD:'ETF', AGG:'ETF', BND:'ETF',
}

const SECTOR_COLORS = {
  Technology:'#4f7cf6', Financials:'#06b6d4', Healthcare:'#10b981',
  Consumer:'#f59e0b', Staples:'#fbbf24', Energy:'#ef4444',
  Industrials:'#8b5cf6', 'Real Estate':'#ec4899', Utilities:'#14b8a6',
  Communications:'#f97316', Materials:'#84cc16',
  ETF:'#64748b', Other:'#94a3b8',
}

function getSector(t) { return SECTOR_MAP[t.toUpperCase()] || 'Other' }

function PriceChange({ pct }) {
  if (pct == null) return <span style={{ color: 'var(--text-2)' }}>—</span>
  if (pct > 0)  return <span className="price-up">▲ {Math.abs(pct).toFixed(2)}%</span>
  if (pct < 0)  return <span className="price-down">▼ {Math.abs(pct).toFixed(2)}%</span>
  return <span className="price-flat">— 0.00%</span>
}

function Range52W({ data }) {
  if (!data?.high_52w || !data?.low_52w || !data?.current) return null
  const { high_52w, low_52w, current } = data
  const range = high_52w - low_52w
  if (range <= 0) return null
  const pos = Math.min(Math.max(((current - low_52w) / range) * 100, 0), 100)
  const nearHigh = pos >= 80
  const nearLow = pos <= 20
  const color = nearHigh ? 'var(--success)' : nearLow ? 'var(--danger)' : 'var(--text-2)'
  return (
    <div style={{ minWidth: 100, marginTop: 5 }}>
      <div style={{ fontSize: 9, color, fontWeight: 700, marginBottom: 3 }}>
        {nearHigh ? '▲ Near 52W High' : nearLow ? '▼ Near 52W Low' : `${pos.toFixed(0)}% of 52W range`}
      </div>
      <div style={{ position: 'relative', height: 4, background: 'var(--surface-2)', borderRadius: 2, marginBottom: 3 }}>
        <div style={{ width: `${pos}%`, height: '100%', background: `${color}33`, borderRadius: 2 }} />
        <div style={{
          position: 'absolute', width: 7, height: 7, borderRadius: '50%',
          background: color, border: '1.5px solid var(--surface)',
          top: '50%', transform: 'translateY(-50%)',
          left: `calc(${pos}% - 3.5px)`,
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
        <span>${Number(low_52w).toFixed(0)}</span>
        <span>${Number(high_52w).toFixed(0)}</span>
      </div>
    </div>
  )
}

export default function Holdings() {
  const [holdings,       setHoldings]       = useState([])
  const [marketData,     setMarketData]     = useState({})
  const [earnings,       setEarnings]       = useState({})
  const [dividends,      setDividends]      = useState({})
  const [indices,        setIndices]        = useState({})
  const [ranges52w,      setRanges52w]      = useState({})
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [ticker,         setTicker]         = useState('')
  const [size,           setSize]           = useState('')
  const [loading,        setLoading]        = useState(true)
  const [adding,         setAdding]         = useState(false)
  const [importing,      setImporting]      = useState(false)
  const [importMsg,      setImportMsg]      = useState(null)
  const [error,          setError]          = useState(null)
  const [sortBy,         setSortBy]         = useState('size')
  const [tickerValid,    setTickerValid]    = useState(null)  // null | {valid, name}
  const [validating,     setValidating]     = useState(false)
  const [expandedNote,   setExpandedNote]   = useState(null)  // holding id
  const [noteText,       setNoteText]       = useState('')
  const [savingNote,     setSavingNote]     = useState(false)
  const [expandedClient, setExpandedClient] = useState(null)  // holding id
  const [clientText,     setClientText]     = useState('')
  const [savingClient,   setSavingClient]   = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)  // null = All
  const [addClientText,  setAddClientText]  = useState('')
  const [expandedAlert,  setExpandedAlert]  = useState(null)  // holding id
  const [alertType,      setAlertType]      = useState('above')
  const [alertThreshold, setAlertThreshold] = useState('')
  const [savingAlert,    setSavingAlert]    = useState(false)
  const [alertSavedId,   setAlertSavedId]   = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const h = await api.getHoldings()
      setHoldings(h)
      if (h.length > 0) {
        try { setMarketData(await api.getMarketData()) } catch (_) {}
        try { setIndices(await api.getMarketIndices()) } catch (_) {}
        api.get52WRanges().then(r => setRanges52w(r)).catch(() => {})
        setCalendarLoading(true)
        Promise.allSettled([api.getEarnings(), api.getDividends()])
          .then(([e, d]) => {
            if (e.status === 'fulfilled') setEarnings(e.value)
            if (d.status === 'fulfilled') setDividends(d.value)
          })
          .finally(() => setCalendarLoading(false))
      }
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function validateTicker(t) {
    const clean = t.toUpperCase().trim()
    if (!clean || clean.length < 1) { setTickerValid(null); return }
    setValidating(true)
    try {
      const key = localStorage.getItem('ria_api_key')
      const res = await fetch(`/api/validate-ticker/${clean}`, {
        headers: key ? { 'X-API-Key': key } : {},
      })
      const d = await res.json()
      setTickerValid(d)
    } catch (_) { setTickerValid(null) }
    finally { setValidating(false) }
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!ticker || !size) return
    if (tickerValid && tickerValid.valid === false) return
    setAdding(true); setError(null)
    try {
      const h = await api.addHolding(ticker.toUpperCase().trim(), parseFloat(size), addClientText.trim() || null)
      setHoldings(prev => {
        const ex = prev.find(x => x.ticker === h.ticker)
        return ex ? prev.map(x => x.ticker === h.ticker ? h : x) : [...prev, h]
      })
      setTicker(''); setSize(''); setTickerValid(null); setAddClientText('')
      try { setMarketData(await api.getMarketData()) } catch (_) {}
    } catch (e) { setError(e.message) }
    finally { setAdding(false) }
  }

  function handleExportCSV() {
    const rows = [
      ['Ticker', 'Sector', 'Cost Basis ($)', 'Market Value ($)', 'P&L ($)', 'P&L (%)', 'Last Price', 'Day Change (%)', 'Portfolio (%)'],
    ]
    holdingValues.forEach(h => {
      const md = marketData[h.ticker]?.price
      rows.push([
        h.ticker,
        getSector(h.ticker),
        parseFloat(h.position_size).toFixed(2),
        h.currentValue != null ? h.currentValue.toFixed(2) : '',
        h.gainLoss != null ? h.gainLoss.toFixed(2) : '',
        h.gainLossPct != null ? h.gainLossPct.toFixed(2) : '',
        md?.close != null ? Number(md.close).toFixed(2) : '',
        md?.pct_change != null ? md.pct_change.toFixed(2) : '',
        totalCostBasis > 0 ? (parseFloat(h.position_size) / totalCostBasis * 100).toFixed(1) : '',
      ])
    })
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `holdings-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleDelete(id) {
    try {
      await api.deleteHolding(id)
      setHoldings(prev => prev.filter(h => h.id !== id))
    } catch (e) { setError(e.message) }
  }

  async function handleNoteSave(holdingId) {
    setSavingNote(true)
    try {
      const updated = await api.updateHoldingNotes(holdingId, noteText)
      setHoldings(prev => prev.map(h => h.id === holdingId ? { ...h, notes: updated.notes } : h))
      setExpandedNote(null)
    } catch (e) { setError(e.message) }
    finally { setSavingNote(false) }
  }

  async function handleClientSave(holdingId) {
    setSavingClient(true)
    try {
      const updated = await api.updateHoldingClient(holdingId, clientText)
      setHoldings(prev => prev.map(h => h.id === holdingId ? { ...h, client_tag: updated.client_tag } : h))
      setExpandedClient(null)
    } catch (e) { setError(e.message) }
    finally { setSavingClient(false) }
  }

  async function handleAlertCreate(holdingId) {
    if (!alertThreshold || savingAlert) return
    setSavingAlert(true)
    const h = holdings.find(x => x.id === holdingId)
    try {
      await api.createPriceAlert(h.ticker, alertType, parseFloat(alertThreshold))
      setExpandedAlert(null); setAlertThreshold('')
      setAlertSavedId(holdingId)
      setTimeout(() => setAlertSavedId(null), 2500)
    } catch (e) { setError(e.message) }
    finally { setSavingAlert(false) }
  }

  async function handleCSVImport(e) {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    setImporting(true); setImportMsg(null); setError(null)

    const text = await file.text()
    const lines = text.trim().split('\n').filter(l => l.trim())
    // Skip header row if first cell looks like a label
    const start = /^ticker|^symbol|^stock/i.test(lines[0]) ? 1 : 0
    const rows = lines.slice(start).map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')))

    let added = 0
    const skippedRows = []
    const errorRows = []
    for (const cols of rows) {
      const t = cols[0]?.toUpperCase()
      const s = parseFloat(cols[1])
      if (!t) { skippedRows.push('(blank ticker)'); continue }
      if (isNaN(s) || s <= 0) { skippedRows.push(`${t} — invalid size`); continue }
      try {
        const h = await api.addHolding(t, s)
        setHoldings(prev => {
          const ex = prev.find(x => x.ticker === h.ticker)
          return ex ? prev.map(x => x.ticker === h.ticker ? h : x) : [...prev, h]
        })
        added++
      } catch (e) { errorRows.push(`${t} — ${e.message}`) }
    }

    let msg = `Imported ${added} position${added !== 1 ? 's' : ''}.`
    if (skippedRows.length) msg += ` Skipped: ${skippedRows.join(', ')}.`
    if (errorRows.length) msg += ` Failed: ${errorRows.join(', ')}.`
    setImportMsg(msg)
    setImporting(false)
    if (added > 0) {
      try { setMarketData(await api.getMarketData()) } catch (_) {}
    }
  }

  if (loading) return <div className="loading"><div className="spin" /><span>Loading holdings...</span></div>

  // Client tagging
  const clientTags = [...new Set(holdings.map(h => h.client_tag).filter(Boolean))].sort()
  const viewHoldings = selectedClient ? holdings.filter(h => h.client_tag === selectedClient) : holdings

  const totalCostBasis = viewHoldings.reduce((s, h) => s + parseFloat(h.position_size), 0)
  const hasMarketData = viewHoldings.some(h => marketData[h.ticker]?.price?.close != null)

  // Live per-holding values
  const holdingValues = viewHoldings.map(h => {
    const close = marketData[h.ticker]?.price?.close
    const currentValue = h.shares && close ? h.shares * close : null
    const gainLoss = currentValue !== null ? currentValue - parseFloat(h.position_size) : null
    const gainLossPct = gainLoss !== null && parseFloat(h.position_size) > 0 ? gainLoss / parseFloat(h.position_size) * 100 : null
    return { ...h, currentValue, gainLoss, gainLossPct }
  })

  const totalLiveValue = holdingValues.reduce((s, h) => s + (h.currentValue ?? parseFloat(h.position_size)), 0)
  const totalGainLoss = hasMarketData ? totalLiveValue - totalCostBasis : null
  const totalGainLossPct = totalGainLoss !== null && totalCostBasis > 0 ? totalGainLoss / totalCostBasis * 100 : null
  const totalValue = totalLiveValue  // used for allocation %

  // Sector breakdown (by cost basis for stable allocation %)
  const sectorMap = {}
  viewHoldings.forEach(h => {
    const s = getSector(h.ticker)
    sectorMap[s] = (sectorMap[s] || 0) + parseFloat(h.position_size)
  })
  const sectors = Object.entries(sectorMap).sort((a, b) => b[1] - a[1])

  // Analytics
  const dayChange = holdingValues.reduce((sum, h) => {
    const md = marketData[h.ticker]?.price
    if (!md?.pct_change || !md?.close || !h.shares) return sum
    const prevClose = md.close / (1 + md.pct_change / 100)
    return sum + (md.close - prevClose) * h.shares
  }, 0)

  const topMover = viewHoldings
    .map(h => ({ h, pct: marketData[h.ticker]?.price?.pct_change }))
    .filter(x => x.pct != null)
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))[0]

  // Per-holding P&L attribution for today
  const holdingContributions = holdingValues
    .map(h => {
      const md = marketData[h.ticker]?.price
      if (!md?.pct_change || !md?.close || !h.shares) return null
      const prevClose = md.close / (1 + md.pct_change / 100)
      return { ticker: h.ticker, contribution: (md.close - prevClose) * h.shares }
    })
    .filter(Boolean)
    .sort((a, b) => b.contribution - a.contribution)

  const topContributors = holdingContributions.slice(0, 3)
  const topDetractors = [...holdingContributions].sort((a, b) => a.contribution - b.contribution).slice(0, 3).filter(x => x.contribution < 0)

  // Upcoming earnings within 30 days
  const upcomingEarnings = Object.entries(earnings)
    .filter(([, e]) => e.days_out != null && e.days_out >= 0 && e.days_out <= 30)
    .sort((a, b) => a[1].days_out - b[1].days_out)
    .map(([ticker, e]) => ({ ticker, ...e }))

  // Upcoming dividends within 45 days
  const upcomingDividends = Object.entries(dividends)
    .filter(([, d]) => d.days_out != null && d.days_out >= 0 && d.days_out <= 45)
    .sort((a, b) => a[1].days_out - b[1].days_out)
    .map(([ticker, d]) => ({ ticker, ...d }))

  // Tax-loss harvesting candidates: unrealized loss > 5% or > $1,000
  const tlhCandidates = holdingValues
    .filter(h => h.gainLoss != null && (h.gainLossPct < -5 || h.gainLoss < -1000))
    .sort((a, b) => a.gainLossPct - b.gainLossPct)

  // Rebalancing drift: flag positions where current weight deviates > 5pp from original
  const rebalanceDrift = totalCostBasis > 0 ? holdingValues
    .map(h => {
      const targetPct = parseFloat(h.position_size) / totalCostBasis * 100
      const currentPct = (h.currentValue ?? parseFloat(h.position_size)) / totalValue * 100
      const drift = currentPct - targetPct
      return { ticker: h.ticker, targetPct, currentPct, drift }
    })
    .filter(x => Math.abs(x.drift) >= 5)
    .sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift))
    : []

  const concentration = totalCostBasis > 0
    ? Math.max(...viewHoldings.map(h => parseFloat(h.position_size) / totalCostBasis * 100))
    : 0

  const sorted = [...holdingValues].sort((a, b) => {
    if (sortBy === 'size')   return parseFloat(b.position_size) - parseFloat(a.position_size)
    if (sortBy === 'ticker') return a.ticker.localeCompare(b.ticker)
    if (sortBy === 'change') {
      const pa = marketData[a.ticker]?.price?.pct_change ?? -999
      const pb = marketData[b.ticker]?.price?.pct_change ?? -999
      return pb - pa
    }
    return 0
  })

  function handleClientReport() {
    if (!selectedClient) return
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    const fmt = n => n != null ? `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'
    const fmtPct = n => n != null ? `${n >= 0 ? '+' : ''}${Number(n).toFixed(2)}%` : '—'

    const rowsHtml = holdingValues.map(h => {
      const md = marketData[h.ticker]?.price
      const sector = getSector(h.ticker)
      const pnlColor = h.gainLoss > 0 ? '#10b981' : h.gainLoss < 0 ? '#ef4444' : '#64748b'
      return `<tr>
        <td style="padding:10px 12px;font-weight:700;color:#0f172a;">${h.ticker}</td>
        <td style="padding:10px 12px;color:#64748b;font-size:12px;">${sector}</td>
        <td style="padding:10px 12px;text-align:right;">${fmt(h.position_size)}</td>
        <td style="padding:10px 12px;text-align:right;">${fmt(h.currentValue)}</td>
        <td style="padding:10px 12px;text-align:right;color:${pnlColor};font-weight:600;">${fmtPct(h.gainLossPct)}</td>
        <td style="padding:10px 12px;text-align:right;">${md?.close != null ? fmt(md.close) : '—'}</td>
        ${h.notes ? `<td style="padding:10px 12px;font-size:11px;color:#64748b;max-width:200px;">${h.notes}</td>` : '<td style="padding:10px 12px;color:#cbd5e1;">—</td>'}
      </tr>`
    }).join('')

    const sectorRowsHtml = sectors.map(([s, v]) => {
      const pct = totalCostBasis > 0 ? (v / totalCostBasis * 100).toFixed(1) : '0.0'
      const color = SECTOR_COLORS[s] || '#94a3b8'
      return `<tr>
        <td style="padding:8px 12px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:8px;"></span>${s}</td>
        <td style="padding:8px 12px;text-align:right;">${fmt(v)}</td>
        <td style="padding:8px 12px;text-align:right;font-weight:600;">${pct}%</td>
      </tr>`
    }).join('')

    const tlhHtml = tlhCandidates.length > 0
      ? tlhCandidates.map(h => `<tr>
          <td style="padding:8px 12px;font-weight:700;">${h.ticker}</td>
          <td style="padding:8px 12px;text-align:right;">${fmt(h.gainLoss)}</td>
          <td style="padding:8px 12px;text-align:right;color:#ef4444;font-weight:600;">${fmtPct(h.gainLossPct)}</td>
        </tr>`).join('')
      : '<tr><td colspan="3" style="padding:10px 12px;color:#94a3b8;">No current candidates</td></tr>'

    const earningsHtml = upcomingEarnings.filter(e => holdingValues.some(h => h.ticker === e.ticker)).slice(0, 8).map(e => {
      const label = e.days_out === 0 ? 'Today' : e.days_out === 1 ? 'Tomorrow' : `In ${e.days_out} days`
      return `<tr><td style="padding:7px 12px;font-weight:700;">${e.ticker}</td><td style="padding:7px 12px;">${e.next_est || '—'}</td><td style="padding:7px 12px;color:#f59e0b;">${label}</td></tr>`
    }).join('') || '<tr><td colspan="3" style="padding:10px 12px;color:#94a3b8;">None within 30 days</td></tr>'

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Portfolio Report — ${selectedClient} — ${today}</title>
<style>
  @media print { @page { margin: 0.75in; } }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #0f172a; margin: 0; padding: 32px; background: #fff; }
  h1 { font-size: 24px; font-weight: 800; letter-spacing: -0.03em; margin: 0 0 4px; }
  h2 { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #4f7cf6; margin: 28px 0 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
  .meta { font-size: 13px; color: #64748b; margin-bottom: 28px; }
  .stats { display: flex; gap: 16px; margin-bottom: 28px; }
  .stat { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; }
  .stat-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 4px; }
  .stat-value { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 8px 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; border-bottom: 2px solid #e2e8f0; }
  td { border-bottom: 1px solid #f1f5f9; }
  tr:last-child td { border-bottom: none; }
  .footer { margin-top: 40px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
</style></head><body>
<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:4px;">
  <div>
    <h1>${selectedClient} — Portfolio Report</h1>
    <div class="meta">Prepared ${today} · VeloQuant</div>
  </div>
  <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#4f7cf6;border:1px solid rgba(79,124,246,0.3);padding:6px 12px;border-radius:6px;">Confidential</div>
</div>

<div class="stats">
  <div class="stat">
    <div class="stat-label">Total Value</div>
    <div class="stat-value">${fmt(totalValue)}</div>
  </div>
  <div class="stat">
    <div class="stat-label">Cost Basis</div>
    <div class="stat-value">${fmt(totalCostBasis)}</div>
  </div>
  <div class="stat">
    <div class="stat-label">Unrealized P&L</div>
    <div class="stat-value" style="color:${totalGainLoss > 0 ? '#10b981' : totalGainLoss < 0 ? '#ef4444' : '#0f172a'};">${totalGainLoss != null ? fmtPct(totalGainLossPct) : '—'}</div>
  </div>
  <div class="stat">
    <div class="stat-label">Positions</div>
    <div class="stat-value">${holdingValues.length}</div>
  </div>
</div>

<h2>Holdings</h2>
<table>
  <thead><tr><th>Ticker</th><th>Sector</th><th>Cost Basis</th><th>Mkt Value</th><th>P&amp;L</th><th>Last Price</th><th>Notes</th></tr></thead>
  <tbody>${rowsHtml}</tbody>
</table>

<h2>Sector Allocation</h2>
<table>
  <thead><tr><th>Sector</th><th>Cost Basis</th><th>Allocation</th></tr></thead>
  <tbody>${sectorRowsHtml}</tbody>
</table>

${tlhCandidates.length > 0 ? `<h2>Tax-Loss Harvesting Candidates</h2>
<table>
  <thead><tr><th>Ticker</th><th>Unrealized Loss</th><th>Loss %</th></tr></thead>
  <tbody>${tlhHtml}</tbody>
</table>` : ''}

${upcomingEarnings.length > 0 ? `<h2>Upcoming Earnings (30 days)</h2>
<table>
  <thead><tr><th>Ticker</th><th>Est. Date</th><th>Timing</th></tr></thead>
  <tbody>${earningsHtml}</tbody>
</table>` : ''}

<div class="footer">This report was generated by VeloQuant and is intended solely for the named client. Not investment advice. Past performance does not guarantee future results.</div>
</body></html>`

    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 400)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Holdings</div>
          <div className="page-subtitle">
            {viewHoldings.length} position{viewHoldings.length !== 1 ? 's' : ''}
            {selectedClient ? ` · ${selectedClient}` : (holdings.length > 0 ? ` · ${holdings.length} total` : '')}
            {' · '}${totalCostBasis.toLocaleString()} cost basis
            {totalGainLoss !== null && (
              <span style={{ marginLeft: 8, color: totalGainLoss >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                · {totalGainLoss >= 0 ? '+' : '−'}${Math.abs(totalGainLoss).toLocaleString(undefined, { maximumFractionDigits: 0 })} total P&L
              </span>
            )}
          </div>
        </div>
        {selectedClient && (
          <button className="btn btn-outline" onClick={handleClientReport} style={{ fontSize: 12, flexShrink: 0 }}>
            ⎙ Client Report
          </button>
        )}
      </div>

      {error && <div className="error-bar" onClick={() => setError(null)} style={{ cursor: 'pointer' }}>{error} ✕</div>}

      {/* Client filter tabs */}
      {clientTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {[null, ...clientTags].map(tag => (
            <button
              key={tag ?? '__all__'}
              onClick={() => setSelectedClient(tag)}
              style={{
                fontSize: 12, padding: '5px 14px', borderRadius: 20,
                border: `1px solid ${selectedClient === tag ? 'var(--accent)' : 'var(--border)'}`,
                background: selectedClient === tag ? 'rgba(79,124,246,0.12)' : 'transparent',
                color: selectedClient === tag ? 'var(--accent)' : 'var(--text-2)',
                cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, transition: 'all 0.14s',
              }}
            >
              {tag ?? 'All Clients'}
            </button>
          ))}
        </div>
      )}

      {/* Analytics cards */}
      {viewHoldings.length > 0 && (
        <div className="stats-row" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Portfolio Value</div>
            <div className="stat-value">${(totalLiveValue / 1000).toFixed(0)}K</div>
            <div className="stat-sub" style={{ color: totalGainLoss > 0 ? 'var(--success)' : totalGainLoss < 0 ? 'var(--danger)' : undefined }}>
              {totalGainLoss !== null
                ? `${totalGainLoss >= 0 ? '+' : '−'}$${Math.abs(totalGainLoss).toLocaleString(undefined, { maximumFractionDigits: 0 })} (${totalGainLossPct >= 0 ? '+' : ''}${totalGainLossPct.toFixed(2)}%) vs cost`
                : `${holdings.length} active positions`}
            </div>
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

      {/* Attribution strip */}
      {holdingContributions.length > 0 && (
        <div className="card" style={{ padding: '10px 18px', marginBottom: 14, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-2)', marginRight: 4, flexShrink: 0 }}>
            Today's Attribution
          </span>
          {topContributors.map(({ ticker, contribution }) => (
            <span key={`g-${ticker}`} style={{
              fontSize: 12, fontWeight: 700,
              color: 'var(--success)',
              background: 'rgba(16,185,129,0.1)',
              padding: '3px 10px', borderRadius: 20,
              border: '1px solid rgba(16,185,129,0.2)',
            }}>
              {ticker} +${contribution.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          ))}
          {topDetractors.length > 0 && (
            <span style={{ color: 'var(--text-2)', fontSize: 12, marginLeft: 2, marginRight: 2 }}>·</span>
          )}
          {topDetractors.map(({ ticker, contribution }) => (
            <span key={`d-${ticker}`} style={{
              fontSize: 12, fontWeight: 700,
              color: 'var(--danger)',
              background: 'rgba(239,68,68,0.08)',
              padding: '3px 10px', borderRadius: 20,
              border: '1px solid rgba(239,68,68,0.15)',
            }}>
              {ticker} −${Math.abs(contribution).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          ))}
        </div>
      )}

      {/* Benchmark comparison strip */}
      {holdingContributions.length > 0 && Object.keys(indices).length > 0 && (() => {
        const portDayPct = totalValue > 0 ? dayChange / totalValue * 100 : null
        const benchmarks = [
          { label: 'SPY', pct: indices.SPY?.price?.pct_change },
          { label: 'QQQ', pct: indices.QQQ?.price?.pct_change },
          { label: 'DIA', pct: indices.DIA?.price?.pct_change },
        ].filter(b => b.pct != null)
        if (!portDayPct || benchmarks.length === 0) return null
        const beats = benchmarks.filter(b => portDayPct > b.pct).length
        const allBeats = beats === benchmarks.length
        const noneBeats = beats === 0
        return (
          <div className="card" style={{ padding: '10px 18px', marginBottom: 14, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-2)', flexShrink: 0 }}>
              vs Benchmarks
            </span>
            <span style={{
              fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
              color: portDayPct >= 0 ? 'var(--success)' : 'var(--danger)',
              background: portDayPct >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${portDayPct >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.15)'}`,
            }}>
              Portfolio {portDayPct >= 0 ? '+' : ''}{portDayPct.toFixed(2)}%
            </span>
            {benchmarks.map(({ label, pct }) => {
              const diff = portDayPct - pct
              const outperforms = diff > 0
              return (
                <span key={label} style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontWeight: 600 }}>{label}</span>
                  <span>{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: outperforms ? 'var(--success)' : 'var(--danger)' }}>
                    ({outperforms ? '+' : ''}{diff.toFixed(2)}pp)
                  </span>
                </span>
              )
            })}
            {(allBeats || noneBeats) && (
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                color: allBeats ? 'var(--success)' : 'var(--danger)',
              }}>
                {allBeats ? '▲ Outperforming all' : '▼ Underperforming all'}
              </span>
            )}
          </div>
        )
      })()}

      {/* TLH Candidates */}
      {tlhCandidates.length > 0 && (
        <div className="card" style={{ padding: '14px 20px', marginBottom: 14, borderLeft: '3px solid var(--danger)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--danger)' }}>
              Tax-Loss Harvesting Candidates
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-2)', fontWeight: 500 }}>— unrealized losses worth reviewing</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {tlhCandidates.map(h => (
              <div key={h.id} style={{
                padding: '8px 14px', borderRadius: 10,
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.2)',
                display: 'flex', flexDirection: 'column', gap: 2,
              }}>
                <span className="chip" style={{ fontSize: 12, alignSelf: 'flex-start' }}>{h.ticker}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)' }}>
                  −${Math.abs(h.gainLoss).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span style={{ fontSize: 10, color: 'var(--danger)', opacity: 0.8 }}>
                  {h.gainLossPct.toFixed(1)}% unrealized
                </span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 10, opacity: 0.65 }}>
            Consider harvesting losses before year-end. Consult a tax professional before acting.
          </div>
        </div>
      )}

      {/* Rebalancing drift */}
      {rebalanceDrift.length > 0 && (
        <div className="card" style={{ padding: '14px 20px', marginBottom: 14, borderLeft: '3px solid var(--accent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)' }}>
              Rebalancing Signals
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-2)', fontWeight: 500 }}>— drifted ≥5pp from original allocation</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {rebalanceDrift.map(({ ticker, targetPct, currentPct, drift }) => {
              const over = drift > 0
              return (
                <div key={ticker} style={{
                  padding: '8px 14px', borderRadius: 10,
                  background: over ? 'rgba(79,124,246,0.06)' : 'rgba(100,116,139,0.08)',
                  border: `1px solid ${over ? 'rgba(79,124,246,0.2)' : 'var(--border)'}`,
                  display: 'flex', flexDirection: 'column', gap: 2,
                }}>
                  <span className="chip" style={{ fontSize: 12, alignSelf: 'flex-start' }}>{ticker}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: over ? 'var(--accent)' : 'var(--text-2)' }}>
                    {over ? '▲ Over-weight' : '▼ Under-weight'}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
                    {currentPct.toFixed(1)}% now · {targetPct.toFixed(1)}% target · {drift > 0 ? '+' : ''}{drift.toFixed(1)}pp
                  </span>
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 10, opacity: 0.65 }}>
            Based on original cost basis allocation. Not investment advice.
          </div>
        </div>
      )}

      {/* Portfolio Calendar — Earnings & Dividends */}
      {(upcomingEarnings.length > 0 || upcomingDividends.length > 0 || calendarLoading) && (
        <div className="card" style={{ padding: '14px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: (upcomingEarnings.length > 0 || upcomingDividends.length > 0) ? 14 : 0 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-2)' }}>
              Portfolio Calendar
            </span>
            {calendarLoading && <div className="spin spin-sm" style={{ opacity: 0.5 }} />}
          </div>
          {(upcomingEarnings.length > 0 || upcomingDividends.length > 0) && (
            <>
              {upcomingEarnings.length > 0 && (
                <div style={{ marginBottom: upcomingDividends.length > 0 ? 16 : 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Earnings
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {upcomingEarnings.map(({ ticker, next_est, days_out }) => {
                      const urgent = days_out <= 7
                      return (
                        <div key={ticker} style={{
                          padding: '7px 12px', borderRadius: 10,
                          background: urgent ? 'rgba(245,158,11,0.07)' : 'var(--surface-2)',
                          border: `1px solid ${urgent ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
                          display: 'flex', flexDirection: 'column', gap: 2,
                        }}>
                          <span className="chip" style={{ fontSize: 11, alignSelf: 'flex-start' }}>{ticker}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: urgent ? 'var(--warning)' : 'var(--text-2)' }}>
                            {days_out <= 0 ? 'Today (est.)' : days_out === 1 ? 'Tomorrow (est.)' : `in ${days_out}d (est.)`}
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>{next_est}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {upcomingDividends.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Ex-Dividend Dates
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {upcomingDividends.map(({ ticker, ex_dividend_date, cash_amount, pay_date, days_out }) => {
                      const urgent = days_out <= 5
                      return (
                        <div key={ticker} style={{
                          padding: '7px 12px', borderRadius: 10,
                          background: urgent ? 'rgba(16,185,129,0.07)' : 'var(--surface-2)',
                          border: `1px solid ${urgent ? 'rgba(16,185,129,0.25)' : 'var(--border)'}`,
                          display: 'flex', flexDirection: 'column', gap: 2,
                        }}>
                          <span className="chip" style={{ fontSize: 11, alignSelf: 'flex-start' }}>{ticker}</span>
                          {cash_amount != null && (
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--success)' }}>
                              ${Number(cash_amount).toFixed(4).replace(/\.?0+$/, '')} / share
                            </span>
                          )}
                          <span style={{ fontSize: 10, color: urgent ? 'var(--success)' : 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
                            Ex-div: {ex_dividend_date} {days_out <= 0 ? '(today)' : `(in ${days_out}d)`}
                          </span>
                          {pay_date && <span style={{ fontSize: 10, color: 'var(--text-2)' }}>Pay: {pay_date}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              <div style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 10, opacity: 0.65 }}>
                Earnings dates are estimates. Dividend data from Polygon.
              </div>
            </>
          )}
        </div>
      )}

      <div className={viewHoldings.length > 0 ? 'grid-2' : undefined} style={{ marginBottom: 20 }}>
        {/* Add form */}
        <div className="card card-glow">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
              Add Position
            </div>
            <label style={{
              fontSize: 12, fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer',
              padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'transparent', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6,
              opacity: importing ? 0.6 : 1,
            }}>
              {importing ? <><div className="spin spin-sm" />Importing...</> : '⬆ Import CSV'}
              <input
                type="file"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                onChange={handleCSVImport}
                disabled={importing}
              />
            </label>
          </div>
          {importMsg && (
            <div style={{ fontSize: 12, color: 'var(--success)', marginBottom: 14, background: 'rgba(16,185,129,0.08)', padding: '8px 12px', borderRadius: 8 }}>
              {importMsg}
            </div>
          )}
          <form onSubmit={handleAdd} className="form-row" style={{ flexWrap: 'wrap' }}>
            <div className="form-group">
              <label className="form-label">Ticker</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  placeholder="AAPL"
                  value={ticker}
                  onChange={e => { setTicker(e.target.value.toUpperCase()); setTickerValid(null) }}
                  onBlur={e => validateTicker(e.target.value)}
                  style={{
                    width: 100,
                    borderColor: tickerValid?.valid === false ? 'var(--danger)' : tickerValid?.valid ? 'var(--success)' : undefined,
                  }}
                  required
                />
                {(validating || tickerValid) && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, fontSize: 11, whiteSpace: 'nowrap' }}>
                    {validating && <span style={{ color: 'var(--text-2)' }}>Checking...</span>}
                    {!validating && tickerValid?.valid && <span style={{ color: 'var(--success)' }}>✓ {tickerValid.name?.split(' ').slice(0, 3).join(' ')}</span>}
                    {!validating && tickerValid?.valid === false && <span style={{ color: 'var(--danger)' }}>✕ Ticker not found</span>}
                  </div>
                )}
              </div>
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
            <div className="form-group">
              <label className="form-label">Client <span style={{ color: 'var(--text-2)', fontWeight: 400 }}>(optional)</span></label>
              <input
                className="form-input"
                placeholder="e.g. John Smith"
                value={addClientText}
                onChange={e => setAddClientText(e.target.value)}
                list="client-suggestions-add"
                style={{ width: 130 }}
              />
              <datalist id="client-suggestions-add">
                {clientTags.map(t => <option key={t} value={t} />)}
              </datalist>
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
      <div className="card holdings-table-card" style={{ padding: 0, overflow: 'hidden' }}>
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
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
                <button onClick={handleExportCSV} style={{
                  fontSize: 11, padding: '4px 11px', borderRadius: 6,
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                  transition: 'all 0.14s',
                }}>↓ Export CSV</button>
              </div>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Sector</th>
                  <th>Cost Basis</th>
                  <th>Market Value</th>
                  <th>Total P&L</th>
                  <th>Last Price</th>
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
                  const portfolioPct = totalCostBasis > 0 ? (parseFloat(h.position_size) / totalCostBasis * 100) : 0
                  const sector = getSector(h.ticker)
                  const sColor = SECTOR_COLORS[sector] || SECTOR_COLORS.Other
                  const glColor = h.gainLoss > 0 ? 'var(--success)' : h.gainLoss < 0 ? 'var(--danger)' : 'var(--text-2)'

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
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-2)' }}>
                          ${parseFloat(h.position_size).toLocaleString()}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>
                          {h.currentValue != null
                            ? `$${h.currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                            : <span style={{ color: 'var(--text-2)' }}>—</span>}
                        </div>
                      </td>
                      <td>
                        {h.gainLoss != null ? (
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: glColor }}>
                              {h.gainLoss >= 0 ? '+' : '−'}${Math.abs(h.gainLoss).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                            <div style={{ fontSize: 11, color: glColor, opacity: 0.8 }}>
                              {h.gainLossPct >= 0 ? '+' : ''}{h.gainLossPct.toFixed(2)}%
                            </div>
                          </div>
                        ) : <span style={{ color: 'var(--text-2)' }}>—</span>}
                      </td>
                      <td>
                        {close != null ? (
                          <div>
                            <span style={{ fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>
                              ${Number(close).toFixed(2)}
                            </span>
                            <Range52W data={ranges52w[h.ticker.toUpperCase()]} />
                          </div>
                        ) : <span style={{ color: 'var(--text-2)' }}>—</span>}
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
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => {
                              if (expandedClient === h.id) { setExpandedClient(null); return }
                              setExpandedClient(h.id)
                              setExpandedNote(null)
                              setClientText(h.client_tag || '')
                            }}
                            style={{
                              fontSize: 11, padding: '3px 9px', borderRadius: 6,
                              border: `1px solid ${h.client_tag ? 'rgba(6,182,212,0.4)' : 'var(--border)'}`,
                              background: h.client_tag ? 'rgba(6,182,212,0.08)' : 'transparent',
                              color: h.client_tag ? '#06b6d4' : 'var(--text-2)',
                              cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                              transition: 'all 0.14s', flexShrink: 0,
                            }}
                            title={h.client_tag || 'Assign to client'}
                          >
                            {h.client_tag ? h.client_tag.split(' ')[0] : '+ Client'}
                          </button>
                          <button
                            onClick={() => {
                              if (expandedNote === h.id) { setExpandedNote(null); return }
                              setExpandedNote(h.id)
                              setExpandedClient(null)
                              setNoteText(h.notes || '')
                            }}
                            style={{
                              fontSize: 11, padding: '3px 9px', borderRadius: 6,
                              border: `1px solid ${h.notes ? 'rgba(79,124,246,0.4)' : 'var(--border)'}`,
                              background: h.notes ? 'rgba(79,124,246,0.08)' : 'transparent',
                              color: h.notes ? 'var(--accent)' : 'var(--text-2)',
                              cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                              transition: 'all 0.14s', flexShrink: 0,
                            }}
                            title={h.notes || 'Add note'}
                          >
                            {h.notes ? '📝' : '+ Note'}
                          </button>
                          <button
                            onClick={() => {
                              if (expandedAlert === h.id) { setExpandedAlert(null); return }
                              setExpandedAlert(h.id); setExpandedNote(null); setExpandedClient(null)
                              setAlertThreshold(close ? Number(close).toFixed(2) : '')
                              setAlertType('above')
                            }}
                            style={{
                              fontSize: 11, padding: '3px 9px', borderRadius: 6,
                              border: `1px solid ${alertSavedId === h.id ? 'rgba(16,185,129,0.4)' : 'var(--border)'}`,
                              background: alertSavedId === h.id ? 'rgba(16,185,129,0.08)' : 'transparent',
                              color: alertSavedId === h.id ? 'var(--success)' : 'var(--text-2)',
                              cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                              transition: 'all 0.14s', flexShrink: 0,
                            }}
                            title="Set price alert"
                          >
                            {alertSavedId === h.id ? '✓ Set' : '⚡ Alert'}
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(h.id)}
                            style={{ fontSize: 11 }}
                          >
                            Remove
                          </button>
                        </div>
                        {expandedClient === h.id && (
                          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <input
                              autoFocus
                              className="form-input"
                              value={clientText}
                              onChange={e => setClientText(e.target.value)}
                              placeholder="e.g. John Smith · Portfolio A"
                              style={{ fontSize: 12, padding: '6px 10px' }}
                              list="client-suggestions"
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleClientSave(h.id)
                                if (e.key === 'Escape') setExpandedClient(null)
                              }}
                            />
                            <datalist id="client-suggestions">
                              {clientTags.map(t => <option key={t} value={t} />)}
                            </datalist>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => handleClientSave(h.id)} disabled={savingClient} className="btn btn-primary" style={{ fontSize: 11, padding: '4px 12px' }}>
                                {savingClient ? 'Saving...' : 'Save'}
                              </button>
                              <button onClick={() => setExpandedClient(null)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit' }}>
                                Cancel
                              </button>
                              {h.client_tag && (
                                <button onClick={() => { setClientText(''); handleClientSave(h.id) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'inherit' }}>
                                  Unassign
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                        {expandedNote === h.id && (
                          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <textarea
                              autoFocus
                              value={noteText}
                              onChange={e => setNoteText(e.target.value)}
                              placeholder="e.g. Core long-term hold · Do not sell · Tax lot: $45.00"
                              style={{
                                width: '100%', minWidth: 220, fontSize: 11, padding: '7px 10px',
                                borderRadius: 8, border: '1px solid var(--border)',
                                background: 'var(--surface-2)', color: 'var(--text)',
                                fontFamily: 'inherit', resize: 'vertical', minHeight: 54,
                              }}
                              rows={2}
                              onKeyDown={e => { if (e.key === 'Escape') setExpandedNote(null) }}
                            />
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                onClick={() => handleNoteSave(h.id)}
                                disabled={savingNote}
                                className="btn btn-primary"
                                style={{ fontSize: 11, padding: '4px 12px' }}
                              >
                                {savingNote ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={() => setExpandedNote(null)}
                                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit' }}
                              >
                                Cancel
                              </button>
                              {h.notes && (
                                <button
                                  onClick={() => { setNoteText(''); handleNoteSave(h.id) }}
                                  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'inherit' }}
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                        {expandedAlert === h.id && (
                          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 240 }}>
                            {/* Alert type selector */}
                            <div style={{ display: 'flex', gap: 4 }}>
                              {[
                                { value: 'above',   label: '▲ Above' },
                                { value: 'below',   label: '▼ Below' },
                                { value: 'pct_day', label: '% Move' },
                              ].map(({ value, label }) => (
                                <button
                                  key={value}
                                  onClick={() => {
                                    setAlertType(value)
                                    if (value === 'pct_day') setAlertThreshold('5')
                                    else setAlertThreshold(close ? Number(close).toFixed(2) : '')
                                  }}
                                  style={{
                                    fontSize: 11, padding: '4px 10px', borderRadius: 6, fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer',
                                    border: `1px solid ${alertType === value ? 'rgba(251,191,36,0.5)' : 'var(--border)'}`,
                                    background: alertType === value ? 'rgba(251,191,36,0.1)' : 'transparent',
                                    color: alertType === value ? 'var(--warning)' : 'var(--text-2)',
                                    transition: 'all 0.12s',
                                  }}
                                >{label}</button>
                              ))}
                            </div>
                            {/* Threshold input */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 11, color: 'var(--text-2)', flexShrink: 0 }}>
                                {alertType === 'pct_day' ? 'Move ≥' : 'Price'}
                              </span>
                              <input
                                autoFocus
                                type="number"
                                className="form-input"
                                value={alertThreshold}
                                onChange={e => setAlertThreshold(e.target.value)}
                                step={alertType === 'pct_day' ? '0.5' : '0.01'}
                                min="0"
                                style={{ fontSize: 12, padding: '5px 8px', width: 90 }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleAlertCreate(h.id)
                                  if (e.key === 'Escape') setExpandedAlert(null)
                                }}
                              />
                              <span style={{ fontSize: 11, color: 'var(--text-2)', flexShrink: 0 }}>
                                {alertType === 'pct_day' ? '%' : 'USD'}
                              </span>
                            </div>
                            {/* Hint */}
                            <div style={{ fontSize: 10, color: 'var(--text-2)', opacity: 0.75 }}>
                              {alertType === 'above' && alertThreshold && `Alert when ${h.ticker} rises above $${Number(alertThreshold).toFixed(2)}`}
                              {alertType === 'below' && alertThreshold && `Alert when ${h.ticker} falls below $${Number(alertThreshold).toFixed(2)}`}
                              {alertType === 'pct_day' && alertThreshold && `Alert when ${h.ticker} moves ≥${alertThreshold}% in a single day`}
                            </div>
                            {/* Actions */}
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                onClick={() => handleAlertCreate(h.id)}
                                disabled={!alertThreshold || savingAlert}
                                className="btn btn-primary"
                                style={{ fontSize: 11, padding: '4px 12px' }}
                              >
                                {savingAlert ? 'Setting...' : '⚡ Set Alert'}
                              </button>
                              <button
                                onClick={() => setExpandedAlert(null)}
                                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit' }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
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
