import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 20px',
      }}>
        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <div style={{
            width: 52, height: 52,
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, margin: '0 auto 20px',
          }}>⚠</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 10, letterSpacing: '-0.02em' }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 24 }}>
            An unexpected error occurred. Refreshing the page usually fixes it.
          </div>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '12px 16px', marginBottom: 24,
            fontFamily: 'monospace', fontSize: 12, color: 'var(--danger)',
            textAlign: 'left', wordBreak: 'break-word',
          }}>
            {this.state.error?.message || 'Unknown error'}
          </div>
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            Reload page
          </button>
        </div>
      </div>
    )
  }
}
