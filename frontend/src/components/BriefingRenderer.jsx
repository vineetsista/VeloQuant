function renderInline(text) {
  const parts = []
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g
  let last = 0, m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[2]) parts.push(<strong key={m.index} style={{ fontWeight: 700, color: 'var(--text)' }}>{m[2]}</strong>)
    else parts.push(<em key={m.index}>{m[3]}</em>)
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length > 1 ? parts : text
}

export default function BriefingRenderer({ content }) {
  if (!content) return null

  const blocks = content.split(/\n\n+/).filter(b => b.trim())
  const rendered = []
  let i = 0

  while (i < blocks.length) {
    const text = blocks[i].trim()

    // Section header — ALL CAPS line under 60 chars
    if (/^[A-Z][A-Z\s&:/–-]{4,}$/.test(text) && text.length < 60 && !/\d/.test(text)) {
      rendered.push(
        <div key={i} style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
          textTransform: 'uppercase', color: 'var(--accent)',
          padding: '20px 0 10px',
          borderBottom: '1px solid rgba(79,124,246,0.15)',
          marginBottom: 16,
        }}>{text}</div>
      )
      i++; continue
    }

    // Structured: "1. TICKER — Headline"
    const structured = text.match(/^(\d+)\.\s+([A-Z][A-Z./]{0,8})\s+[—–]\s+(.+)/)
    if (structured) {
      const bodyBlocks = []
      let j = i + 1
      while (j < blocks.length) {
        const next = blocks[j].trim()
        if (next.match(/^(\d+)\.\s+/) || next.match(/^overall portfolio tone/i)) break
        bodyBlocks.push(next)
        j++
      }
      rendered.push(
        <div key={i} className="briefing-item">
          <div className="briefing-num">{structured[1]}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <span className="chip" style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.06em' }}>
                {structured[2]}
              </span>
              <span style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.35, color: 'var(--text)' }}>
                {structured[3]}
              </span>
            </div>
            {bodyBlocks.length > 0 && (
              <div className="briefing-item-text" style={{ marginTop: 4 }}>
                {renderInline(bodyBlocks.join(' '))}
              </div>
            )}
          </div>
        </div>
      )
      i = j; continue
    }

    // Portfolio tone line
    const toneMatch = text.match(/^overall portfolio tone:\s*(constructive|cautious|mixed)\s+[—–-]+\s+(.+)/i)
    if (toneMatch) {
      const level = toneMatch[1].toUpperCase()
      const toneColor =
        level === 'CONSTRUCTIVE' ? 'var(--success)' :
        level === 'CAUTIOUS'     ? 'var(--warning)'  : 'var(--accent)'
      rendered.push(
        <div key={i} className="briefing-summary">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div className="briefing-summary-label">Portfolio Tone</div>
            <span style={{
              background: toneColor, color: '#fff',
              fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
              padding: '3px 10px', borderRadius: 4,
            }}>{level}</span>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)' }}>{renderInline(toneMatch[2])}</div>
        </div>
      )
      i++; continue
    }

    // Old-style numbered item (fallback)
    const numbered = text.match(/^(\d+)\.\s+([\s\S]+)/)
    if (numbered) {
      rendered.push(
        <div key={i} className="briefing-item">
          <div className="briefing-num">{numbered[1]}</div>
          <div className="briefing-item-text">{renderInline(numbered[2])}</div>
        </div>
      )
      i++; continue
    }

    // Lead / intro text — styled with accent left border
    rendered.push(
      <div key={i} style={{
        fontSize: 14.5, color: 'var(--text-2)', lineHeight: 1.8,
        marginBottom: 20, padding: '14px 18px',
        background: 'rgba(79,124,246,0.03)',
        border: '1px solid rgba(79,124,246,0.08)',
        borderLeft: '3px solid rgba(79,124,246,0.4)',
        borderRadius: '0 8px 8px 0',
        fontStyle: 'italic',
      }}>
        {renderInline(text)}
      </div>
    )
    i++
  }

  return <div>{rendered}</div>
}
