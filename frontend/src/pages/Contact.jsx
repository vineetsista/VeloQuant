import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send message')
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 20px', position: 'relative' }}>
      <div style={{ position: 'fixed', top: '-150px', right: '-150px', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(79,124,246,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: '0 0 28px', display: 'block' }}
        >
          ← Back
        </button>

        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>Support</div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, letterSpacing: '-0.03em', margin: '0 0 16px' }}>
            Get in Touch
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-2)', lineHeight: 1.7, maxWidth: 520, margin: 0 }}>
            Questions about the platform, billing, or your account? We typically respond within one business day.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 32, alignItems: 'start' }}>

          {/* Contact info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {[
              {
                icon: '✉',
                title: 'Email',
                body: 'support@riaintelligence.com',
                sub: 'Responses within 1 business day',
              },
              {
                icon: '◎',
                title: 'Platform Issues',
                body: 'Briefing not arriving? Filing alert wrong?',
                sub: 'Include your account email and the date of the issue.',
              },
              {
                icon: '◈',
                title: 'Billing & Subscriptions',
                body: 'Trial, payment, or cancellation questions',
                sub: 'We can adjust or cancel your subscription directly — no hassle.',
              },
            ].map(item => (
              <div key={item.title} className="card" style={{ padding: '24px 24px' }}>
                <div style={{ fontSize: 22, marginBottom: 12, color: 'var(--accent)' }}>{item.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{item.title}</div>
                <div style={{ fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>{item.body}</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>{item.sub}</div>
              </div>
            ))}
          </div>

          {/* Contact form */}
          <div className="card card-glow" style={{ padding: 36 }}>
            {sent ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 36, marginBottom: 16, color: 'var(--success)' }}>✓</div>
                <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 10, letterSpacing: '-0.02em' }}>Message sent</div>
                <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7 }}>
                  We'll get back to you at <strong>{form.email}</strong> within one business day.
                </div>
                <button
                  className="btn btn-outline"
                  onClick={() => { setSent(false); setForm({ name: '', email: '', subject: '', message: '' }) }}
                  style={{ marginTop: 24, width: '100%', justifyContent: 'center' }}
                >
                  Send another message
                </button>
              </div>
            ) : (
              <>
                <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', marginBottom: 24 }}>Send a message</div>

                {error && <div className="error-bar" style={{ marginBottom: 16 }}>{error}</div>}

                <form onSubmit={handleSubmit}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Name</label>
                      <input className="form-input" type="text" placeholder="Jane Smith" value={form.name} onChange={set('name')} required style={{ width: '100%' }} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input className="form-input" type="email" placeholder="you@yourfirm.com" value={form.email} onChange={set('email')} required style={{ width: '100%' }} />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">Subject</label>
                    <select
                      className="form-input"
                      value={form.subject}
                      onChange={set('subject')}
                      required
                      style={{ width: '100%' }}
                    >
                      <option value="">Select a topic...</option>
                      <option value="Technical Issue">Technical Issue</option>
                      <option value="Billing Question">Billing Question</option>
                      <option value="Account Question">Account Question</option>
                      <option value="Feature Request">Feature Request</option>
                      <option value="General Question">General Question</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 24 }}>
                    <label className="form-label">Message</label>
                    <textarea
                      className="form-input"
                      placeholder="Describe your question or issue in as much detail as you'd like..."
                      value={form.message}
                      onChange={set('message')}
                      required
                      rows={5}
                      style={{ width: '100%', resize: 'vertical', minHeight: 120 }}
                    />
                  </div>

                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={loading}
                    style={{ width: '100%', justifyContent: 'center', padding: '12px 18px' }}
                  >
                    {loading ? <><div className="spin spin-sm" />Sending...</> : 'Send Message →'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
