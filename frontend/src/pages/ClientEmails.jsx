import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import usePageTitle from '../hooks/usePageTitle'

function parseEmail(content) {
  const lines = content.split('\n')
  const subjectLine = lines.find(l => l.toLowerCase().startsWith('subject:'))
  const subject = subjectLine ? subjectLine.replace(/^subject:\s*/i, '').trim() : ''
  const body = lines.filter(l => !l.toLowerCase().startsWith('subject:')).join('\n').trim()
  return { subject, body }
}

export default function ClientEmails() {
  usePageTitle('Client Emails')
  const [emails, setEmails] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [genForm, setGenForm] = useState({ ticker: '', company: '', event: '' })
  const [showForm, setShowForm] = useState(false)
  const [copied, setCopied] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [filter, setFilter] = useState('all')
  const [searchParams, setSearchParams] = useSearchParams()
  const [holdings, setHoldings] = useState([])
  const [contacts, setContacts] = useState([])

  useEffect(() => {
    load()
    api.getHoldings().then(setHoldings).catch(() => {})
    api.getContacts().then(setContacts).catch(() => {})
    // Pre-fill from filing alert shortcut
    const ticker = searchParams.get('ticker')
    const event = searchParams.get('event')
    if (ticker || event) {
      setGenForm(f => ({ ...f, ticker: ticker || '', event: event || '' }))
      setShowForm(true)
      setSearchParams({}, { replace: true })
    }
  }, [])

  async function load() {
    setLoading(true)
    try {
      const e = await api.getClientEmails()
      setEmails(e)
      if (e.length > 0) setSelected(e[0])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleMarkSent(id) {
    try {
      const updated = await api.markEmailSent(id)
      setEmails(prev => prev.map(e => e.id === id ? updated : e))
      if (selected?.id === id) setSelected(updated)
    } catch (e) { setError(e.message) }
  }

  async function handleDelete(id) {
    setDeleting(id)
    try {
      await api.deleteClientEmail(id)
      setEmails(prev => {
        const next = prev.filter(e => e.id !== id)
        if (selected?.id === id) setSelected(next[0] || null)
        return next
      })
    } catch (e) { setError(e.message) }
    finally { setDeleting(null) }
  }

  async function handleGenerate(e) {
    e.preventDefault()
    setGenerating(true); setError(null)
    try {
      const newEmail = await api.generateClientEmail(genForm.ticker, genForm.company, genForm.event)
      setEmails(prev => [newEmail, ...prev])
      setSelected(newEmail)
      setGenForm({ ticker: '', company: '', event: '' })
      setShowForm(false)
    } catch (e) { setError(e.message) }
    finally { setGenerating(false) }
  }

  async function handleCopy(withSubject = false) {
    if (!selected) return
    const { subject, body } = parseEmail(selected.draft_content)
    const text = withSubject ? `Subject: ${subject}\n\n${body}` : body
    await navigator.clipboard.writeText(text)
    setCopied(withSubject ? 'full' : 'body')
    setTimeout(() => setCopied(false), 2000)
  }

  function handleMailto() {
    if (!selected) return
    const { subject, body } = parseEmail(selected.draft_content)
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.open(mailto, '_self')
  }

  if (loading) return <div className="loading"><div className="spin" /><span>Loading client emails...</span></div>

  const pending = emails.filter(e => !e.sent).length
  const filtered = emails.filter(e => {
    if (filter === 'drafts') return !e.sent
    if (filter === 'sent') return e.sent
    return true
  })

  const selParsed = selected ? parseEmail(selected.draft_content) : null

  const matchedContacts = (() => {
    if (!selected || !contacts.length || !holdings.length) return []
    const ticker = selected.ticker?.toUpperCase()
    const tags = new Set(holdings.filter(h => h.ticker.toUpperCase() === ticker).map(h => h.client_tag).filter(Boolean))
    if (!tags.size) return []
    return contacts.filter(c => c.client_tag && tags.has(c.client_tag))
  })()

  return (
    <div>
      <div className="page-header">
        <div className="page-header-actions" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div className="page-title">Client Emails</div>
            <div className="page-subtitle">{pending} draft{pending !== 1 ? 's' : ''} ready · {emails.length - pending} sent</div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>
            {showForm ? '✕ Cancel' : '✦ Draft Email'}
          </button>
        </div>
      </div>

      {error && <div className="error-bar" onClick={() => setError(null)} style={{ cursor: 'pointer' }}>{error} ✕</div>}

      {/* Draft form */}
      {showForm && (
        <div className="card card-glow" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ marginBottom: 20 }}>Draft New Client Email</div>
          {generating ? (
            <div className="generating-box" style={{ padding: '24px 0' }}>
              <div className="spin" />
              <div className="generating-title">Drafting your email...</div>
              <div className="generating-sub">Writing a professional, personalized client communication.</div>
            </div>
          ) : (
            <form onSubmit={handleGenerate}>
              <div className="form-row" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
                <div className="form-group">
                  <label className="form-label">Ticker</label>
                  <input className="form-input" placeholder="AAPL" value={genForm.ticker}
                    onChange={e => setGenForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))}
                    style={{ width: 90 }} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Company Name</label>
                  <input className="form-input" placeholder="Apple Inc." value={genForm.company}
                    onChange={e => setGenForm(f => ({ ...f, company: e.target.value }))}
                    style={{ width: 200 }} required />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">What happened? (trigger event)</label>
                <textarea
                  className="form-input"
                  placeholder="Describe the event in plain terms. E.g. Apple beat earnings by 12% and raised guidance. Stock is up 6% after-hours..."
                  value={genForm.event}
                  onChange={e => setGenForm(f => ({ ...f, event: e.target.value }))}
                  rows={3}
                  style={{ resize: 'vertical', width: '100%' }}
                  required
                />
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4 }}>
                  Be specific — the more context you give, the better the email.
                </div>
              </div>
              <button className="btn btn-primary" type="submit">✦ Generate Draft</button>
            </form>
          )}
        </div>
      )}

      {emails.length === 0 ? (
        <div className="card">
          <div className="empty">
            <strong>No draft emails</strong>
            Click "Draft Email" above to generate a professional client communication from any market event.
          </div>
        </div>
      ) : (
        <div className="split-panel">
          {/* List */}
          <div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
              {['all', 'drafts', 'sent'].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  border: `1px solid ${filter === f ? 'var(--accent)' : 'var(--border)'}`,
                  background: filter === f ? 'rgba(79,124,246,0.1)' : 'transparent',
                  color: filter === f ? 'var(--accent)' : 'var(--text-2)',
                  cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize',
                }}>{f}</button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtered.map(email => {
                const { subject } = parseEmail(email.draft_content)
                const isSelected = selected?.id === email.id
                return (
                  <div
                    key={email.id}
                    onClick={() => setSelected(email)}
                    style={{
                      padding: '12px 14px',
                      border: `1px solid ${isSelected ? 'rgba(79,124,246,0.5)' : 'var(--border)'}`,
                      borderRadius: 10, cursor: 'pointer',
                      background: isSelected ? 'rgba(79,124,246,0.08)' : 'var(--surface)',
                      opacity: email.sent ? 0.6 : 1,
                      transition: 'all 0.14s',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                      <span className="chip" style={{ fontSize: 10, padding: '2px 7px' }}>{email.ticker}</span>
                      <span className={`badge ${email.sent ? 'badge-green' : 'badge-yellow'}`} style={{ fontSize: 10 }}>
                        {email.sent ? 'Sent' : 'Draft'}
                      </span>
                      <button
                        onClick={ev => { ev.stopPropagation(); handleDelete(email.id) }}
                        disabled={deleting === email.id}
                        style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: 13, padding: '0 2px', opacity: 0, transition: 'opacity 0.15s' }}
                        className="email-delete-btn"
                      >✕</button>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: isSelected ? 'var(--accent)' : 'var(--text)', lineHeight: 1.4, marginBottom: 3 }}>
                      {subject || 'Client Email'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
                      {new Date(email.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Email preview */}
          {selected && selParsed && (
            <div className="card card-glow" style={{ position: 'sticky', top: 16 }}>
              {/* Email header */}
              <div style={{ padding: '0 0 16px', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span className="chip">{selected.ticker}</span>
                      <span className={`badge ${selected.sent ? 'badge-green' : 'badge-yellow'}`}>
                        {selected.sent ? 'Sent' : 'Draft'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-2)' }}>
                        {new Date(selected.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4 }}>
                      {selParsed.subject}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleCopy(false)}
                      style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: copied === 'body' ? 'var(--success)' : 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                    >
                      {copied === 'body' ? '✓ Copied' : '⎘ Copy Body'}
                    </button>
                    <button
                      onClick={() => handleCopy(true)}
                      style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: copied === 'full' ? 'var(--success)' : 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                    >
                      {copied === 'full' ? '✓ Copied' : '⎘ Copy with Subject'}
                    </button>
                    <button
                      onClick={handleMailto}
                      style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                      title="Open in your email client"
                    >
                      ✉ Open in Mail
                    </button>
                    {matchedContacts.map(c => {
                      const { subject, body } = selParsed
                      return (
                        <button key={c.id}
                          onClick={() => window.open(`mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_self')}
                          style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(6,182,212,0.35)', background: 'rgba(6,182,212,0.06)', color: '#06b6d4', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, whiteSpace: 'nowrap' }}
                          title={c.email}
                        >
                          ✉ {c.name}
                        </button>
                      )
                    })}
                    {!selected.sent && (
                      <button className="btn btn-primary btn-sm" onClick={() => handleMarkSent(selected.id)} style={{ fontSize: 12 }}>
                        ✓ Mark Sent
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Email body */}
              <div style={{
                fontSize: 14, lineHeight: 1.8, color: 'var(--text)',
                background: 'rgba(0,0,0,0.15)', borderRadius: 10,
                padding: '20px 24px', whiteSpace: 'pre-wrap',
                fontFamily: 'Georgia, "Times New Roman", serif',
                maxHeight: 500, overflowY: 'auto',
              }}>
                {selParsed.body}
              </div>

              {/* Trigger event context */}
              {selected.trigger_event && (
                <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Trigger Event</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>{selected.trigger_event}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <style>{`.email-delete-btn { opacity: 0 !important } div:hover > .email-delete-btn { opacity: 1 !important }`}</style>
    </div>
  )
}
