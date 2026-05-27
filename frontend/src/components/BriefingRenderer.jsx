function renderInline(text) {
  const parts = []
  // Match **bold** and *italic* AND `code` AND $price patterns AND tickers like NVDA
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g
  let last = 0, m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[2]) parts.push(<strong key={m.index} style={{ fontWeight: 700, color: 'var(--text)' }}>{m[2]}</strong>)
    else if (m[3]) parts.push(<em key={m.index} style={{ color: 'var(--text)' }}>{m[3]}</em>)
    else if (m[4]) parts.push(<code key={m.index} style={{ fontFamily: 'var(--mono)', fontSize: '0.9em', background: 'rgba(79,124,246,0.1)', padding: '1px 6px', borderRadius: 4, color: 'var(--accent-2)' }}>{m[4]}</code>)
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
        <div key={i} className="briefing-section">{text}</div>
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
        if (next.match(/^(\d+)\.\s+/) || next.match(/^overall portfolio tone/i) || /^[A-Z][A-Z\s&:/–-]{4,}$/.test(next)) break
        bodyBlocks.push(next)
        j++
      }
      rendered.push(
        <div key={i} className="briefing-item">
          <div className="briefing-num">{structured[1]}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <span className="chip" style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.06em' }}>
                {structured[2]}
              </span>
              <span style={{ fontWeight: 700, fontSize: 15.5, lineHeight: 1.4, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                {structured[3]}
              </span>
            </div>
            {bodyBlocks.length > 0 && (
              <div className="briefing-item-text">
                {renderInline(bodyBlocks.join(' '))}
              </div>
            )}
          </div>
        </div>
      )
      i = j; continue
    }

    // Portfolio tone line — flexible format
    const toneMatch = text.match(/^overall portfolio tone:\s*(constructive|cautious|mixed|neutral|positive|negative)[^—–\n]*[—–-]+\s*(.+)/i)
      || text.match(/^portfolio tone:\s*(constructive|cautious|mixed|neutral|positive|negative)[^—–\n]*[—–-]+\s*(.+)/i)
    if (toneMatch) {
      const level = toneMatch[1].toUpperCase()
      const toneClass =
        level === 'CONSTRUCTIVE' ? 'tone-constructive' :
        level === 'CAUTIOUS'     ? 'tone-cautious'     :
        ''
      const tonePillClass =
        level === 'CONSTRUCTIVE' ? 'constructive' :
        level === 'CAUTIOUS'     ? 'cautious'     :
        'mixed'
      rendered.push(
        <div key={i} className={`briefing-summary ${toneClass}`}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div className="briefing-summary-label">◆ Portfolio Tone</div>
            <span className={`tone-pill ${tonePillClass}`}>
              <span className="dot" />
              {level}
            </span>
          </div>
          <div style={{ fontSize: 14.5, lineHeight: 1.78, color: 'var(--text)' }}>{renderInline(toneMatch[2])}</div>
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

    // Bullet list — line starting with • or -
    if (/^[•\-]\s+/.test(text)) {
      const items = text.split(/\n/).filter(l => /^[•\-]\s+/.test(l)).map(l => l.replace(/^[•\-]\s+/, ''))
      rendered.push(
        <ul key={i} style={{ margin: '12px 0 16px 0', paddingLeft: 0, listStyle: 'none' }}>
          {items.map((item, k) => (
            <li key={k} style={{ display: 'flex', gap: 12, padding: '6px 0', fontSize: 14.5, lineHeight: 1.78, color: 'var(--text)' }}>
              <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }}>◆</span>
              <span style={{ flex: 1 }}>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      )
      i++; continue
    }

    // Lead / intro text — premium serif feel with accent left border
    rendered.push(
      <div key={i} className="briefing-lead">
        {renderInline(text)}
      </div>
    )
    i++
  }

  if (rendered.length === 0) {
    return (
      <div style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.8, whiteSpace: 'pre-wrap', fontFamily: 'var(--serif)' }}>
        {content}
      </div>
    )
  }

  return <div className="briefing-content">{rendered}</div>
}
