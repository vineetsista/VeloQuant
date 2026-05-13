import { useState, useEffect } from 'react'
import { api } from '../api'
import BriefingRenderer from '../components/BriefingRenderer'

export default function Briefing() {
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

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [b, h] = await Promise.all([api.getBriefings(50), api.getHoldings()])
      setBriefings(b); setHoldingCount(h.length)
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
    } catch (e) { setError(e.message) }
    finally { setGenerating(false) }
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

  function handlePrint() {
    const w = window.open('', '_blank')
    const date = new Date(selected.generated_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    w.document.write(`<html><head><title>Morning Briefing – ${date}</title><style>body{font-family:Georgia,serif;max-width:700px;margin:40px auto;color:#111;line-height:1.7}h1{font-size:22px;margin-bottom:4px}p{margin:0 0 14px}pre{white-space:pre-wrap;font-family:inherit}</style></head><body><h1>Morning Intelligence Briefing</h1><p style="color:#666;font-size:13px">${date}</p><hr style="margin:20px 0"><pre>${selected.content}</pre></body></html>`)
    w.document.close()
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
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
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
                  <button onClick={handlePrint} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                    ⎙ Print
                  </button>
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
