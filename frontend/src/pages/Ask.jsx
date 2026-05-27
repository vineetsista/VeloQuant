import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useToast } from '../components/Toast'
import usePageTitle from '../hooks/usePageTitle'

const SUGGESTIONS = [
  'Which of my holdings reported earnings this week?',
  "What's the biggest risk in my portfolio right now?",
  'Summarize what changed for me since my last briefing.',
  'Which positions are near their 52-week highs?',
  'What should I tell a client who is worried about rates?',
  "Which of my holdings has the most upcoming catalysts?",
  'Where am I most concentrated, and what does that imply?',
  'Which of my positions has the most negative analyst sentiment?',
]

export default function Ask() {
  usePageTitle('Ask Portfolio')
  const toast = useToast()
  const navigate = useNavigate()
  const [holdings, setHoldings] = useState([])
  const [conversation, setConversation] = useState([])  // [{role, content, ts}]
  const [input, setInput] = useState('')
  const [asking, setAsking] = useState(false)
  const inputRef = useRef(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    api.getHoldings().then(setHoldings).catch(() => {})
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [conversation, asking])

  async function ask(question) {
    const q = (question || input).trim()
    if (!q || asking) return
    setInput('')
    const history = conversation.map(m => ({ role: m.role, content: m.content }))
    setConversation(c => [...c, { role: 'user', content: q, ts: Date.now() }])
    setAsking(true)
    try {
      const { answer } = await api.askPortfolio(q, history)
      setConversation(c => [...c, { role: 'assistant', content: answer, ts: Date.now() }])
    } catch (e) {
      toast.error(e.message || 'Failed to get answer')
      setConversation(c => [...c, { role: 'assistant', content: `⚠ ${e.message || 'Something went wrong.'}`, ts: Date.now() }])
    } finally {
      setAsking(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      ask()
    }
  }

  const noHoldings = holdings.length === 0

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24, color: 'var(--accent)' }}>✺</span>
              Ask Your Portfolio
            </div>
            <div className="page-subtitle">
              Natural-language Q&A grounded in your live holdings, recent filings, news, and the latest briefing.
            </div>
          </div>
          {conversation.length > 0 && (
            <button className="btn btn-outline" onClick={() => setConversation([])} style={{ marginTop: 4 }}>
              ↺ New Chat
            </button>
          )}
        </div>
      </div>

      {noHoldings && (
        <div className="card card-glow" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 38, marginBottom: 12 }}>◈</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Add holdings to start asking</div>
          <div style={{ fontSize: 14, color: 'var(--text-2)', maxWidth: 460, margin: '0 auto 24px', lineHeight: 1.7 }}>
            Ask Portfolio uses your real holdings to ground every answer. Add a few tickers and you'll be able to ask anything about your book.
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/holdings')}>Add Holdings →</button>
        </div>
      )}

      {!noHoldings && (
        <div className="card card-glow" style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: 540 }}>
          {/* Conversation pane */}
          <div ref={scrollRef} style={{ flex: 1, padding: '28px 32px', overflowY: 'auto', maxHeight: 'calc(100vh - 320px)' }}>
            {conversation.length === 0 && (
              <div style={{ padding: '20px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--accent-b))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, color: '#fff', fontWeight: 800, boxShadow: '0 4px 20px rgba(79,124,246,0.4)' }}>✺</div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 2 }}>Your analyst is ready.</div>
                    <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Ask anything about your {holdings.length} holding{holdings.length !== 1 ? 's' : ''}, recent filings, or what the briefing meant.</div>
                  </div>
                </div>

                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: 12 }}>Try asking</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => ask(s)}
                      disabled={asking}
                      style={{
                        textAlign: 'left',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        padding: '14px 16px',
                        cursor: 'pointer',
                        color: 'var(--text-2)',
                        fontSize: 13.5,
                        lineHeight: 1.55,
                        fontFamily: 'inherit',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'rgba(79,124,246,0.35)'
                        e.currentTarget.style.background = 'rgba(79,124,246,0.04)'
                        e.currentTarget.style.color = 'var(--text)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'var(--border)'
                        e.currentTarget.style.background = 'var(--surface)'
                        e.currentTarget.style.color = 'var(--text-2)'
                      }}
                    >
                      <span style={{ color: 'var(--accent)', marginRight: 6 }}>›</span>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {conversation.map((m, i) => (
              <div key={m.ts + '-' + i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div className={`chat-bubble ${m.role}`}>
                  {m.role === 'assistant' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 11, color: 'var(--accent)', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                      <span>✺ Analyst</span>
                    </div>
                  )}
                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                </div>
              </div>
            ))}

            {asking && (
              <div className="chat-bubble assistant" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                <div className="spin spin-sm" />
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Analyzing your portfolio…</span>
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                disabled={asking}
                placeholder="Ask anything about your portfolio…"
                style={{
                  flex: 1,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-2)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  color: 'var(--text)',
                  fontSize: 14.5,
                  fontFamily: 'inherit',
                  resize: 'none',
                  outline: 'none',
                  maxHeight: 140,
                  lineHeight: 1.5,
                  transition: 'border-color 0.18s, box-shadow 0.18s',
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = 'var(--accent)'
                  e.currentTarget.style.boxShadow = '0 0 0 4px rgba(79,124,246,0.16)'
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = 'var(--border-2)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
              <button
                className="btn btn-primary"
                onClick={() => ask()}
                disabled={asking || !input.trim()}
                style={{ padding: '12px 18px', flexShrink: 0 }}
              >
                {asking ? <><div className="spin spin-sm" />…</> : <>Ask <span className="kbd" style={{ marginLeft: 4 }}>↵</span></>}
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span>Powered by Claude · grounded in your {holdings.length} holding{holdings.length !== 1 ? 's' : ''}</span>
              <span style={{ color: 'var(--border-3)' }}>·</span>
              <span>Not investment advice — for research only</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
