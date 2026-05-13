export default function BriefingRenderer({ content }) {
  if (!content) return null

  const blocks = content.split(/\n\n+/).filter(b => b.trim())
  const rendered = []
  let i = 0

  while (i < blocks.length) {
    const text = blocks[i].trim()

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
                {bodyBlocks.join('\n\n')}
              </div>
            )}
          </div>
        </div>
      )
      i = j
      continue
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
          <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)' }}>{toneMatch[2]}</div>
        </div>
      )
      i++
      continue
    }

    // Old-style numbered item (fallback)
    const numbered = text.match(/^(\d+)\.\s+([\s\S]+)/)
    if (numbered) {
      rendered.push(
        <div key={i} className="briefing-item">
          <div className="briefing-num">{numbered[1]}</div>
          <div className="briefing-item-text">{numbered[2]}</div>
        </div>
      )
      i++
      continue
    }

    // Lead / intro text
    rendered.push(<div key={i} className="briefing-lead">{text}</div>)
    i++
  }

  return <div>{rendered}</div>
}
