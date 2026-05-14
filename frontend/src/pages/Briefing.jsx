import { useState, useEffect } from 'react'
import { api } from '../api'
import BriefingRenderer from '../components/BriefingRenderer'
import usePageTitle from '../hooks/usePageTitle'

export default function Briefing() {
  usePageTitle('Briefings')
  const [briefings, setBriefings] = useState([])
  const [selected, setSelected] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [holdingCount, setHoldingCount] = useState(0)
  const [copied, setCopied] = useState(false)
  const [emailing, setEmailing] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [search, setSearch] = useState('')
  const [contacts, setContacts] = useState([])
  const [contactMenu, setContactMenu] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [b, h] = await Promise.all([api.getBriefings(50), api.getHoldings()])
      setBriefings(b); setHoldingCount(h.length)
      api.getContacts().then(setContacts).catch(() => {})
      if (b.length > 0) setSelected(b[0])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleGenerate() {
    setGenerating(true); setError(null)
    try {
      const b = await api.generateBriefing()
      setBriefings(prev => [b, ...prev])
      setSelected(b)
    } catch (e) {
      if (e.code === 'subscription_required') {
        setError('Your free trial has ended. Subscribe to continue generating briefings.')
      } else {
        setError(e.message)
      }
    } finally { setGenerating(false) }
  }

  async function handleDelete(id) {
    setDeleting(id)
    try {
      await api.deleteBriefing(id)
      setBriefings(prev => {
        const next = prev.filter(b => b.id !== id)
        if (selected?.id === id) setSelected(next[0] || null)
        return next
      })
    } catch (e) { setError(e.message) }
    finally { setDeleting(null) }
  }

  function handleCopy() {
    if (!selected) return
    navigator.clipboard.writeText(selected.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function handleEmail() {
    if (!selected || emailing) return
    setEmailing(true)
    try {
      const updated = await api.sendBriefing(selected.id)
      setBriefings(prev => prev.map(b => b.id === updated.id ? updated : b))
      setSelected(updated)
    } catch (e) {
      setError(e.message)
    } finally {
      setEmailing(false)
    }
  }

  function handleDownload() {
    if (!selected) return
    const date = new Date(selected.generated_at).toISOString().slice(0, 10)
    const blob = new Blob([selected.content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `briefing-${date}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handlePrint() {
    const w = window.open('', '_blank')
    const date = new Date(selected.generated_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    const blocks = selected.content.split(/\n\n+/).filter(b => b.trim())
    let bodyHtml = ''
    let i = 0
    while (i < blocks.length) {
      const text = blocks[i].trim()
      if (/^[A-Z][A-Z\s&:/–-]{4,}$/.test(text) && text.length < 60 && !/\d/.test(text)) {
        bodyHtml += `<div class="section-label">${text}</div>`
        i++; continue
      }
      const structured = text.match(/^(\d+)\.\s+([A-Z][A-Z./]{0,8})\s+[—–]\s+(.+)/)
      if (structured) {
        const bodyParts = []
        let j = i + 1
        while (j < blocks.length) {
          const nx = blocks[j].trim()
          if (/^(\d+)\.\s+/.test(nx) || /^overall portfolio tone/i.test(nx)) break
          bodyParts.push(nx)
          j++
        }
        bodyHtml += `<div class="item"><div class="num">${structured[1]}</div><div class="item-body"><div class="item-header"><span class="chip">${structured[2]}</span> ${structured[3]}</div>${bodyParts.length ? `<p>${bodyParts.join(' ')}</p>` : ''}</div></div>`
        i = j; continue
      }
      const tone = text.match(/^overall portfolio tone:\s*(constructive|cautious|mixed)\s+[—–-]+\s+(.+)/i)
      if (tone) {
        bodyHtml += `<div class="tone"><strong>Portfolio Tone: ${tone[1].toUpperCase()}</strong> — ${tone[2]}</div>`
        i++; continue
      }
      bodyHtml += `<p class="lead">${text}</p>`
      i++
    }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Morning Briefing — ${date}</title><style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;max-width:700px;margin:0 auto;padding:48px 40px;color:#0f172a;line-height:1.6;font-size:14px}
      .header{border-bottom:2px solid #4f7cf6;padding-bottom:20px;margin-bottom:32px}
      .brand{font-size:10px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#4f7cf6;margin-bottom:6px}
      .title{font-size:24px;font-weight:800;letter-spacing:-.03em;margin-bottom:4px}
      .subtitle{font-size:12px;color:#64748b}
      .section-label{font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#4f7cf6;padding:20px 0 8px;border-bottom:1px solid #e2e8f0;margin-bottom:12px}
      .item{display:flex;gap:16px;margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #f1f5f9}
      .num{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#4f7cf6,#06b6d4);color:#fff;font-size:12px;font-weight:800;text-align:center;line-height:28px;flex-shrink:0}
      .item-body{flex:1}
      .item-header{font-size:14px;font-weight:700;margin-bottom:6px;line-height:1.35}
      .chip{display:inline-block;background:rgba(79,124,246,.1);color:#4f7cf6;font-size:9px;font-weight:800;letter-spacing:.06em;padding:2px 7px;border-radius:3px;margin-right:6px;vertical-align:middle}
      .item-body p{font-size:13px;color:#475569;line-height:1.7;margin-top:6px}
      .tone{background:#f8fafc;border:1px solid #e2e8f0;border-left:3px solid #4f7cf6;padding:14px 16px;border-radius:0 8px 8px 0;margin-bottom:20px;font-size:13px;color:#334155}
      .lead{font-size:14px;color:#475569;font-style:italic;margin-bottom:18px;padding:12px 16px;border-left:3px solid rgba(79,124,246,.3);background:rgba(79,124,246,.02)}
      .footer{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center}
      @media print{body{padding:0} .footer{page-break-inside:avoid}}
    </style></head><body>
      <div class="header">
        <div class="brand">VeloQuant</div>
        <div class="title">Morning Briefing</div>
        <div class="subtitle">${date}</div>
      </div>
      ${bodyHtml}
      <div class="footer">Generated by VeloQuant &nbsp;·&nbsp; Not investment advice &nbsp;·&nbsp; For internal use only</div>
    </body></html>`)
    w.document.close()
    w.focus()
    w.print()
  }

  const filtered = briefings.filter(b =>
    !search || b.content.toLowerCase().includes(search.toLowerCase()) ||
    new Date(b.generated_at).toLocaleDateString().includes(search)
  )

  if (loading) return <div className="loading"><div className="spin" /><span>Loading briefings...</span></div>

  return (
    <div>
      <div className="page-header">
        <div className="page-header-actions" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div className="page-title">Briefings</div>
            <div className="page-subtitle">{briefings.length} report{briefings.length !== 1 ? 's' : ''} in archive</div>
          </div>
          <button className="btn btn-primary" onClick={handleGenerate} disabled={generating || holdingCount === 0}>
            {generating ? <><div className="spin spin-sm" />Generating...</> : <>◆ Generate New</>}
          </button>
        </div>
      </div>

      {error && <div className="error-bar" onClick={() => setError(null)} style={{ cursor: 'pointer' }}>{error} ✕</div>}

      {generating && (
        <div className="card card-glow" style={{ marginBottom: 20 }}>
          <div className="generating-box">
            <div className="spin" />
            <div className="generating-title">Analyzing your portfolio...</div>
            <div className="generating-sub">
              Pulling market data, SEC filings, and news for all holdings.<br />
              This takes about 30–60 seconds.
            </div>
          </div>
        </div>
      )}

      {briefings.length === 0 && !generating ? (
        <div className="card">
          <div className="empty">
            <strong>No briefings yet</strong>
            Click "Generate New" to create your first morning intelligence report.
          </div>
        </div>
      ) : (
        <div className="split-panel">
          {/* Sidebar list */}
          <div>
            <input
              className="form-input"
              placeholder="Search briefings..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', marginBottom: 10, fontSize: 13 }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtered.map(b => {
                const isSelected = selected?.id === b.id
                const lines = b.content.split('\n').filter(l => l.trim())
                const preview = lines.find(l => /^\d+\./.test(l)) || lines[0] || ''
                return (
                  <div
                    key={b.id}
                    onClick={() => setSelected(b)}
                    style={{
                      padding: '12px 14px',
                      border: `1px solid ${isSelected ? 'rgba(79,124,246,0.5)' : 'var(--border)'}`,
                      borderRadius: 10,
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(79,124,246,0.08)' : 'var(--surface)',
                      transition: 'all 0.14s',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: isSelected ? 'var(--accent)' : 'var(--text)' }}>
                        {new Date(b.generated_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </div>
                      <button
                        onClick={ev => { ev.stopPropagation(); handleDelete(b.id) }}
                        disabled={deleting === b.id}
                        style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: 13, padding: '0 2px', opacity: 0, transition: 'opacity 0.15s' }}
                        className="briefing-delete-btn"
                      >✕</button>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 5 }}>
                      {new Date(b.generated_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {preview.replace(/^\d+\.\s*/, '')}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Content pane */}
          {selected && (
            <div className="card card-glow" style={{ position: 'sticky', top: 16 }}>
              <div className="card-header" style={{ marginBottom: 4 }}>
                <div>
                  <div className="card-title" style={{ marginBottom: 2 }}>
                    {new Date(selected.generated_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                    {new Date(selected.generated_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    {selected.delivered && <span style={{ marginLeft: 10, color: 'var(--success)', fontWeight: 600 }}>✓ Emailed</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={handleCopy} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: copied ? 'var(--success)' : 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                    {copied ? '✓ Copied' : '⎘ Copy'}
                  </button>
                  <button
                    onClick={handleEmail}
                    disabled={emailing || selected?.delivered}
                    style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: selected?.delivered ? 'var(--success)' : 'var(--text-2)', cursor: selected?.delivered ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 600, opacity: emailing ? 0.6 : 1 }}
                  >
                    {selected?.delivered ? '✓ Emailed' : emailing ? 'Sending...' : '✉ Email me'}
                  </button>
                  <button onClick={handleDownload} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                    ↓ Download
                  </button>
                  <button onClick={handlePrint} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                    ⎙ Print / PDF
                  </button>
                  {contacts.length > 0 && (
                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={() => setContactMenu(v => !v)}
                        style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(6,182,212,0.35)', background: contactMenu ? 'rgba(6,182,212,0.12)' : 'rgba(6,182,212,0.06)', color: '#06b6d4', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, whiteSpace: 'nowrap' }}
                      >
                        ✉ Send to Client {contactMenu ? '▲' : '▼'}
                      </button>
                      {contactMenu && (
                        <div
                          style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, background: 'var(--bg-2)', border: '1px solid var(--border-2)', borderRadius: 10, padding: 4, zIndex: 50, minWidth: 220, boxShadow: '0 8px 32px rgba(0,0,0,0.55)' }}
                          onMouseLeave={() => setContactMenu(false)}
                        >
                          {contacts.map(c => {
                            const date = new Date(selected.generated_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
                            const tone = selected.content.match(/overall portfolio tone[:\s]+.+/i)?.[0]?.slice(0, 140) || ''
                            const body = `Hi ${c.name.split(' ')[0]},\n\n${tone ? tone + '\n\n' : ''}Wanted to touch base on this morning's market update. Happy to hop on a call if you have any questions.\n\nBest regards`
                            return (
                              <button
                                key={c.id}
                                onClick={() => { window.open(`mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent(`Market Update — ${date}`)}&body=${encodeURIComponent(body)}`, '_self'); setContactMenu(false) }}
                                style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: '9px 12px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', gap: 1, transition: 'background 0.12s' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                <span style={{ fontSize: 12, fontWeight: 600 }}>{c.name}</span>
                                <span style={{ fontSize: 10, color: 'var(--text-2)' }}>{c.email}</span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <BriefingRenderer content={selected.content} />
            </div>
          )}
        </div>
      )}

      <style>{`.briefing-delete-btn { opacity: 0 !important } div:hover > .briefing-delete-btn { opacity: 1 !important }`}</style>
    </div>
  )
}
