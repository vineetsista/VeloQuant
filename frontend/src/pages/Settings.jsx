import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, clearAdvisorId, getAdvisorId } from '../api'

const TAB = { PROFILE: 'profile', SUBSCRIPTION: 'subscription', SECURITY: 'security' }

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  )
}

function FieldRow({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--border)', gap: 24 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{label}</div>
        {hint && <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>{hint}</div>}
      </div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

export default function Settings() {
  const [advisor, setAdvisor] = useState(null)
  const [tab, setTab] = useState(TAB.PROFILE)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  // Profile state
  const [name, setName] = useState('')
  const [firm, setFirm] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState(null)

  // Security state
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState(null)

  // Danger zone
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Billing
  const [portalLoading, setPortalLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  useEffect(() => {
    api.getAdvisor().then(a => {
      setAdvisor(a)
      setName(a.name)
      setFirm(a.firm_name)
      setLoading(false)
    }).catch(() => navigate('/'))
  }, [])

  async function saveProfile(e) {
    e.preventDefault()
    setProfileSaving(true); setProfileMsg(null)
    try {
      const updated = await api.updateProfile(name, firm)
      setAdvisor(updated)
      setProfileMsg({ type: 'success', text: 'Profile updated successfully.' })
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message })
    } finally {
      setProfileSaving(false)
    }
  }

  async function changePassword(e) {
    e.preventDefault()
    if (newPw !== confirmPw) { setPwMsg({ type: 'error', text: 'Passwords do not match' }); return }
    if (newPw.length < 8) { setPwMsg({ type: 'error', text: 'Password must be at least 8 characters' }); return }
    setPwSaving(true); setPwMsg(null)
    try {
      await api.changePassword(currentPw, newPw)
      setPwMsg({ type: 'success', text: 'Password updated successfully.' })
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } catch (err) {
      setPwMsg({ type: 'error', text: err.message })
    } finally {
      setPwSaving(false)
    }
  }

  async function openPortal() {
    setPortalLoading(true)
    try {
      const { url } = await api.createPortal(getAdvisorId())
      window.location.href = url
    } catch (err) {
      alert(err.message)
    } finally {
      setPortalLoading(false)
    }
  }

  async function openCheckout() {
    setCheckoutLoading(true)
    try {
      const { url } = await api.createCheckout(getAdvisorId())
      window.location.href = url
    } catch (err) {
      alert(err.message)
    } finally {
      setCheckoutLoading(false)
    }
  }

  async function deleteAccount() {
    if (deleteConfirm !== advisor?.name) return
    setDeleting(true)
    try {
      await api.deleteAccount()
      clearAdvisorId()
      window.location.href = '/'
    } catch (err) {
      alert(err.message)
      setDeleting(false)
    }
  }

  function pwStrength(pw) {
    if (!pw) return { score: 0, label: '', color: 'transparent' }
    let s = 0
    if (pw.length >= 8) s++
    if (pw.length >= 12) s++
    if (/[A-Z]/.test(pw)) s++
    if (/[0-9]/.test(pw)) s++
    if (/[^A-Za-z0-9]/.test(pw)) s++
    if (s <= 1) return { score: s, label: 'Weak', color: 'var(--danger)' }
    if (s <= 3) return { score: s, label: 'Fair', color: 'var(--warning)' }
    return { score: s, label: 'Strong', color: 'var(--success)' }
  }

  const statusColor = {
    trialing: 'var(--accent)',
    active: 'var(--success)',
    past_due: 'var(--danger)',
    canceled: 'var(--text-2)',
    unpaid: 'var(--danger)',
  }

  const statusLabel = {
    trialing: `Free Trial${advisor?.trial_days_remaining != null ? ` · ${advisor.trial_days_remaining} days left` : ''}`,
    active: 'Active',
    past_due: 'Past Due — payment failed',
    canceled: 'Canceled',
    unpaid: 'Unpaid',
  }

  if (loading) return <div className="loading"><div className="spin" /><span>Loading settings...</span></div>

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Settings</div>
        <div className="page-subtitle">Manage your account, subscription, and security</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--surface)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {[
          { key: TAB.PROFILE, label: 'Profile' },
          { key: TAB.SUBSCRIPTION, label: 'Subscription' },
          { key: TAB.SECURITY, label: 'Security' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              background: tab === t.key ? 'var(--surface-2)' : 'transparent',
              color: tab === t.key ? 'var(--text)' : 'var(--text-2)',
              transition: 'all 0.15s',
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* ── PROFILE TAB ── */}
      {tab === TAB.PROFILE && (
        <div className="card card-glow" style={{ padding: '8px 28px 28px' }}>
          <Section title="Account Information">
            <form onSubmit={saveProfile}>
              <FieldRow label="Full Name" hint="Your name as it appears on briefings and emails.">
                <input
                  className="form-input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  style={{ width: '100%' }}
                />
              </FieldRow>
              <FieldRow label="Firm Name" hint="Your RIA firm name shown throughout the platform.">
                <input
                  className="form-input"
                  value={firm}
                  onChange={e => setFirm(e.target.value)}
                  required
                  style={{ width: '100%' }}
                />
              </FieldRow>
              <FieldRow label="Email Address" hint={<>To change your email, contact us at <a href="mailto:ria.intelligence.briefings@gmail.com" style={{color:'var(--accent)'}}>ria.intelligence.briefings@gmail.com</a></>}>
                <input
                  className="form-input"
                  value={advisor?.email || ''}
                  disabled
                  style={{ width: '100%', opacity: 0.6 }}
                />
              </FieldRow>
              <FieldRow label="Account Created" hint="">
                <div style={{ fontSize: 13, color: 'var(--text-2)', paddingTop: 8 }}>
                  {advisor?.created_at ? new Date(advisor.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                </div>
              </FieldRow>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
                {profileMsg && (
                  <span style={{ fontSize: 13, color: profileMsg.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>
                    {profileMsg.text}
                  </span>
                )}
                <button className="btn btn-primary" type="submit" disabled={profileSaving}>
                  {profileSaving ? <><div className="spin spin-sm" />Saving...</> : 'Save Changes'}
                </button>
              </div>
            </form>
          </Section>
        </div>
      )}

      {/* ── SUBSCRIPTION TAB ── */}
      {tab === TAB.SUBSCRIPTION && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card card-glow" style={{ padding: 28 }}>
            <Section title="Current Plan">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>RIA Intelligence Platform</div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)' }}>$299 / month · AI morning briefings for independent advisors</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {advisor?.is_legacy ? (
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--success)', background: 'rgba(16,185,129,0.12)', padding: '5px 12px', borderRadius: 20 }}>
                      Legacy · Full Access
                    </div>
                  ) : advisor?.subscription_status ? (
                    <div style={{
                      fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                      color: statusColor[advisor.subscription_status] || 'var(--text-2)',
                      background: `${statusColor[advisor.subscription_status] || 'var(--text-2)'}18`,
                      padding: '5px 12px', borderRadius: 20,
                    }}>
                      {statusLabel[advisor.subscription_status] || advisor.subscription_status}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      No Subscription
                    </div>
                  )}
                </div>
              </div>
            </Section>

            {advisor?.subscription_status === 'trialing' && (
              <Section title="Trial Period">
                <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, rgba(79,124,246,0.08), rgba(6,182,212,0.05))', border: '1px solid rgba(79,124,246,0.2)', borderRadius: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Your free trial is active</div>
                      <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                        {advisor.trial_days_remaining != null
                          ? `${advisor.trial_days_remaining} day${advisor.trial_days_remaining !== 1 ? 's' : ''} remaining — no charge until trial ends`
                          : 'Trial active — no charge until trial ends'}
                      </div>
                    </div>
                    <div style={{ width: 80, height: 80, position: 'relative', flexShrink: 0 }}>
                      <svg viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" strokeWidth="2.5" />
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--accent)" strokeWidth="2.5"
                          strokeDasharray={`${((advisor.trial_days_remaining ?? 14) / 14) * 100} 100`}
                          strokeLinecap="round" />
                      </svg>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>{advisor.trial_days_remaining ?? 14}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>days</div>
                      </div>
                    </div>
                  </div>
                </div>
              </Section>
            )}

            {!advisor?.is_legacy && (
              <Section title="Billing Management">
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {(advisor?.subscription_status === 'trialing' || advisor?.subscription_status === 'active') && (
                    <button className="btn btn-outline" onClick={openPortal} disabled={portalLoading} style={{ fontSize: 13 }}>
                      {portalLoading ? <><div className="spin spin-sm" />Loading...</> : 'Manage Billing & Invoices →'}
                    </button>
                  )}
                  {(!advisor?.subscription_status || advisor?.subscription_status === 'canceled') && (
                    <button className="btn btn-primary" onClick={openCheckout} disabled={checkoutLoading} style={{ fontSize: 13 }}>
                      {checkoutLoading ? <><div className="spin spin-sm" />Loading...</> : 'Subscribe Now →'}
                    </button>
                  )}
                  {(advisor?.subscription_status === 'past_due' || advisor?.subscription_status === 'unpaid') && (
                    <button className="btn btn-primary" onClick={openPortal} disabled={portalLoading} style={{ fontSize: 13, background: 'var(--danger)' }}>
                      {portalLoading ? <><div className="spin spin-sm" />Loading...</> : 'Fix Payment Method →'}
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 10 }}>
                  Billing is handled securely by Stripe. We never store your card details.
                </div>
              </Section>
            )}
          </div>

          <div className="card" style={{ padding: 28 }}>
            <Section title="What's Included">
              {[
                ['◆ Daily Morning Briefings', 'AI-generated intelligence report delivered to your inbox at 7:30am ET'],
                ['◎ SEC Filing Alerts', 'Real-time analysis of 10-K, 10-Q, and 8-K filings for your holdings'],
                ['✦ Client Email Drafts', 'One-click personalized client communications for market events'],
                ['◈ Unlimited Holdings', 'Track as many positions as you need across any stock or ETF'],
                ['≋ Full Briefing History', 'Archive of all past briefings with search and filtering'],
              ].map(([title, desc]) => (
                <div key={title} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <span style={{ color: 'var(--success)', marginTop: 1 }}>✓</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </Section>
          </div>
        </div>
      )}

      {/* ── SECURITY TAB ── */}
      {tab === TAB.SECURITY && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card card-glow" style={{ padding: '8px 28px 28px' }}>
            <Section title="Change Password">
              <form onSubmit={changePassword}>
                {advisor?.has_password !== false && (
                  <FieldRow label="Current Password" hint="Required to verify your identity.">
                    <input
                      className="form-input"
                      type={showPw ? 'text' : 'password'}
                      value={currentPw}
                      onChange={e => setCurrentPw(e.target.value)}
                      placeholder="Current password"
                      style={{ width: '100%' }}
                    />
                  </FieldRow>
                )}
                <FieldRow label="New Password" hint="Minimum 8 characters. Use a mix of letters, numbers, and symbols.">
                  <div>
                    <div style={{ position: 'relative' }}>
                      <input
                        className="form-input"
                        type={showPw ? 'text' : 'password'}
                        value={newPw}
                        onChange={e => setNewPw(e.target.value)}
                        placeholder="New password"
                        style={{ width: '100%', paddingRight: 44 }}
                        required
                      />
                      <button type="button" onClick={() => setShowPw(v => !v)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', fontSize: 12, padding: 4, fontFamily: 'inherit' }}>
                        {showPw ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    {newPw && (() => {
                      const s = pwStrength(newPw)
                      return (
                        <div style={{ marginTop: 6 }}>
                          <div style={{ display: 'flex', gap: 3, marginBottom: 3 }}>
                            {[1,2,3,4].map(n => <div key={n} style={{ flex: 1, height: 3, borderRadius: 2, background: n <= s.score ? s.color : 'var(--border)' }} />)}
                          </div>
                          <div style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{s.label}</div>
                        </div>
                      )
                    })()}
                  </div>
                </FieldRow>
                <FieldRow label="Confirm New Password" hint="">
                  <input
                    className="form-input"
                    type={showPw ? 'text' : 'password'}
                    value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                    placeholder="Confirm new password"
                    style={{ width: '100%', borderColor: confirmPw && confirmPw !== newPw ? 'var(--danger)' : undefined }}
                    required
                  />
                  {confirmPw && confirmPw !== newPw && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>Passwords do not match</div>}
                </FieldRow>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
                  {pwMsg && (
                    <span style={{ fontSize: 13, color: pwMsg.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>
                      {pwMsg.text}
                    </span>
                  )}
                  <button className="btn btn-primary" type="submit" disabled={pwSaving || !newPw || !confirmPw}>
                    {pwSaving ? <><div className="spin spin-sm" />Updating...</> : 'Update Password'}
                  </button>
                </div>
              </form>
            </Section>
          </div>

          <div className="card" style={{ padding: 28, borderColor: 'rgba(239,68,68,0.2)' }}>
            <Section title="Danger Zone">
              <div style={{ padding: '20px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--danger)', marginBottom: 6 }}>Delete Account</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.6 }}>
                  This permanently deletes your account, all holdings, briefings, and data. This action cannot be undone.
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>
                    Type your name <strong style={{ color: 'var(--text)' }}>{advisor?.name}</strong> to confirm:
                  </label>
                  <input
                    className="form-input"
                    value={deleteConfirm}
                    onChange={e => setDeleteConfirm(e.target.value)}
                    placeholder={advisor?.name}
                    style={{ width: '100%', maxWidth: 300, borderColor: 'rgba(239,68,68,0.3)' }}
                  />
                </div>
                <button
                  onClick={deleteAccount}
                  disabled={deleteConfirm !== advisor?.name || deleting}
                  style={{
                    background: deleteConfirm === advisor?.name ? 'var(--danger)' : 'rgba(239,68,68,0.2)',
                    border: 'none', borderRadius: 8, padding: '8px 18px',
                    color: 'white', fontSize: 13, fontWeight: 600, cursor: deleteConfirm === advisor?.name ? 'pointer' : 'not-allowed',
                    fontFamily: 'inherit', opacity: deleteConfirm !== advisor?.name ? 0.5 : 1,
                    transition: 'all 0.15s',
                  }}
                >
                  {deleting ? 'Deleting...' : 'Delete My Account'}
                </button>
              </div>
            </Section>
          </div>
        </div>
      )}
    </div>
  )
}
