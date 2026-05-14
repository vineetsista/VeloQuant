import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, clearAdvisorId, getAdvisorId, getApiKey, setApiKey } from '../api'
import { useToast } from '../components/Toast'
import usePageTitle from '../hooks/usePageTitle'

const TAB = { PROFILE: 'profile', SUBSCRIPTION: 'subscription', SECURITY: 'security', NOTIFICATIONS: 'notifications', CLIENTS: 'clients' }

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
  usePageTitle('Settings')
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
  const [showApiKey, setShowApiKey] = useState(false)
  const [apiKeyCopied, setApiKeyCopied] = useState(false)

  // API key rotation
  const [rotatingKey, setRotatingKey] = useState(false)
  const [rotateConfirm, setRotateConfirm] = useState(false)

  // Email change
  const [newEmail, setNewEmail] = useState('')
  const [emailChangeSaving, setEmailChangeSaving] = useState(false)
  const [emailChangeMsg, setEmailChangeMsg] = useState(null)

  // Danger zone
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Billing
  const [portalLoading, setPortalLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutAnnualLoading, setCheckoutAnnualLoading] = useState(false)

  // Slack
  const [slackWebhook, setSlackWebhook] = useState('')
  const [slackSaving, setSlackSaving] = useState(false)
  const [slackTesting, setSlackTesting] = useState(false)
  const [slackMsg, setSlackMsg] = useState(null)

  // Clients / contacts
  const [contacts, setContacts] = useState([])
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactTag, setContactTag] = useState('')
  const [contactSaving, setContactSaving] = useState(false)
  const [contactMsg, setContactMsg] = useState(null)
  const [editingContact, setEditingContact] = useState(null)

  // Notification preferences
  const [briefingEmail, setBriefingEmail] = useState(true)
  const [filingAlertEmail, setFilingAlertEmail] = useState(true)
  const [priceAlertEmail, setPriceAlertEmail] = useState(true)
  const [briefingFocus, setBriefingFocus] = useState('')
  const [notifSaving, setNotifSaving] = useState(false)

  const toast = useToast()

  useEffect(() => {
    api.getAdvisor().then(a => {
      setAdvisor(a)
      setName(a.name)
      setFirm(a.firm_name)
      setBriefingEmail(a.briefing_email_enabled !== false)
      setFilingAlertEmail(a.filing_alert_email_enabled !== false)
      setPriceAlertEmail(a.price_alert_email_enabled !== false)
      setSlackWebhook(a.slack_webhook_url || '')
      setBriefingFocus(a.briefing_focus || '')
      setLoading(false)
    }).catch(() => navigate('/'))
    api.getContacts().then(setContacts).catch(() => {})
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

  async function handleRotateApiKey() {
    setRotatingKey(true)
    try {
      const { api_key } = await api.rotateApiKey()
      setApiKey(api_key)
      setRotateConfirm(false)
      toast.success('API key regenerated. Update any integrations using the old key.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setRotatingKey(false)
    }
  }

  async function handleEmailChange(e) {
    e.preventDefault()
    setEmailChangeSaving(true); setEmailChangeMsg(null)
    try {
      await api.requestEmailChange(newEmail)
      setEmailChangeMsg({ type: 'success', text: `Verification email sent to ${newEmail}. Click the link to confirm.` })
      setNewEmail('')
    } catch (err) {
      setEmailChangeMsg({ type: 'error', text: err.message })
    } finally {
      setEmailChangeSaving(false)
    }
  }

  async function openPortal() {
    setPortalLoading(true)
    try {
      const { url } = await api.createPortal(getAdvisorId())
      window.location.href = url
    } catch (err) {
      toast.error(err.message)
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
      toast.error(err.message)
    } finally {
      setCheckoutLoading(false)
    }
  }

  async function openAnnualCheckout() {
    setCheckoutAnnualLoading(true)
    try {
      const { url } = await api.createAnnualCheckout(getAdvisorId())
      window.location.href = url
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCheckoutAnnualLoading(false)
    }
  }

  async function saveSlack(e) {
    e.preventDefault()
    setSlackSaving(true); setSlackMsg(null)
    try {
      const updated = await api.updateSlackWebhook(slackWebhook)
      setAdvisor(updated)
      setSlackMsg({ type: 'success', text: slackWebhook ? 'Slack webhook saved.' : 'Slack notifications disabled.' })
    } catch (err) {
      setSlackMsg({ type: 'error', text: err.message })
    } finally {
      setSlackSaving(false)
    }
  }

  async function testSlack() {
    setSlackTesting(true); setSlackMsg(null)
    try {
      await api.testSlackWebhook()
      setSlackMsg({ type: 'success', text: 'Test message sent — check your Slack channel.' })
    } catch (err) {
      setSlackMsg({ type: 'error', text: err.message })
    } finally {
      setSlackTesting(false)
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
      toast.error(err.message)
      setDeleting(false)
    }
  }

  async function saveNotifications() {
    setNotifSaving(true)
    try {
      const updated = await api.updateEmailPreferences({
        briefing_email_enabled: briefingEmail,
        filing_alert_email_enabled: filingAlertEmail,
        price_alert_email_enabled: priceAlertEmail,
        briefing_focus: briefingFocus,
      })
      setAdvisor(updated)
      toast.success('Notification preferences saved.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setNotifSaving(false)
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
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--surface)', borderRadius: 10, padding: 4, maxWidth: '100%', overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {[
          { key: TAB.PROFILE, label: 'Profile' },
          { key: TAB.SUBSCRIPTION, label: 'Subscription' },
          { key: TAB.SECURITY, label: 'Security' },
          { key: TAB.NOTIFICATIONS, label: 'Notifications' },
          { key: TAB.CLIENTS, label: `Clients${contacts.length > 0 ? ` (${contacts.length})` : ''}` },
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
              <FieldRow label="Email Address" hint="Changing your email sends a verification link to the new address.">
                <div>
                  <input
                    className="form-input"
                    value={advisor?.email || ''}
                    disabled
                    style={{ width: '100%', opacity: 0.6, marginBottom: 10 }}
                  />
                  <form onSubmit={handleEmailChange} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      className="form-input"
                      type="email"
                      placeholder="New email address"
                      value={newEmail}
                      onChange={e => setNewEmail(e.target.value)}
                      style={{ flex: 1, minWidth: 200 }}
                      required
                    />
                    <button className="btn btn-outline" type="submit" disabled={emailChangeSaving || !newEmail} style={{ fontSize: 12, flexShrink: 0 }}>
                      {emailChangeSaving ? <><div className="spin spin-sm" />Sending...</> : 'Send Verification'}
                    </button>
                  </form>
                  {emailChangeMsg && (
                    <div style={{ fontSize: 12, marginTop: 8, color: emailChangeMsg.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>
                      {emailChangeMsg.text}
                    </div>
                  )}
                </div>
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
                  <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>VeloQuant</div>
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

          {!advisor?.is_legacy && (!advisor?.subscription_status || advisor?.subscription_status === 'canceled') && (
            <div className="card" style={{ padding: 28, border: '1px solid rgba(79,124,246,0.25)', background: 'linear-gradient(135deg, rgba(79,124,246,0.04), rgba(6,182,212,0.02))' }}>
              <Section title="Annual Plan — Save 2 Months">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>
                      $2,990 <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)' }}>/year</span>
                      <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 700, background: 'rgba(16,185,129,0.15)', color: 'var(--success)', padding: '3px 8px', borderRadius: 12, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Save $588</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Everything in monthly, billed once per year · $249/month effective rate</div>
                  </div>
                  <button className="btn btn-primary" onClick={openAnnualCheckout} disabled={checkoutAnnualLoading} style={{ fontSize: 13, flexShrink: 0 }}>
                    {checkoutAnnualLoading ? <><div className="spin spin-sm" />Loading...</> : 'Subscribe Annually →'}
                  </button>
                </div>
              </Section>
            </div>
          )}

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

      {/* ── NOTIFICATIONS TAB ── */}
      {tab === TAB.NOTIFICATIONS && (
        <div className="card card-glow" style={{ padding: '8px 28px 28px' }}>
          <Section title="Email Delivery">
            {[
              {
                label: 'Daily Morning Briefing',
                hint: 'AI-generated intelligence report delivered to your inbox at 7:30am ET on weekdays.',
                value: briefingEmail,
                set: setBriefingEmail,
              },
              {
                label: 'New Filing Alerts',
                hint: 'Email digest when new SEC filings (10-K, 10-Q, 8-K) are detected for your holdings.',
                value: filingAlertEmail,
                set: setFilingAlertEmail,
              },
              {
                label: 'Price Alert Triggers',
                hint: 'Email notification when one of your Watchlist price alerts fires.',
                value: priceAlertEmail,
                set: setPriceAlertEmail,
              },
            ].map(({ label, hint, value, set }) => (
              <FieldRow key={label} label={label} hint={hint}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => set(v => !v)}
                    style={{
                      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: value ? 'var(--accent)' : 'var(--border)',
                      position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                      boxShadow: value ? '0 0 8px rgba(79,124,246,0.5)' : 'none',
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 3, left: value ? 23 : 3,
                      width: 18, height: 18, borderRadius: '50%',
                      background: '#fff', transition: 'left 0.2s',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                    }} />
                  </button>
                  <span style={{ fontSize: 13, color: value ? 'var(--text)' : 'var(--text-2)', fontWeight: 600 }}>
                    {value ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </FieldRow>
            ))}
          </Section>

          <Section title="Briefing Customization">
            <FieldRow
              label="Today's Focus"
              hint="Optional context injected into each morning briefing. Highlight a client meeting, a macro theme to watch, or specific positions to emphasize. Resets each day."
            >
              <div>
                <textarea
                  className="form-input"
                  placeholder="e.g. Client meeting with Johnson family tomorrow — emphasize dividend income thesis. Watch tech exposure given Fed meeting this week."
                  value={briefingFocus}
                  onChange={e => setBriefingFocus(e.target.value.slice(0, 500))}
                  rows={3}
                  style={{ width: '100%', fontFamily: 'inherit', resize: 'vertical', minHeight: 72 }}
                />
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4, textAlign: 'right' }}>
                  {briefingFocus.length}/500
                </div>
              </div>
            </FieldRow>
          </Section>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn btn-primary" onClick={saveNotifications} disabled={notifSaving}>
              {notifSaving ? <><div className="spin spin-sm" />Saving...</> : 'Save Preferences'}
            </button>
          </div>

          <Section title="Slack Notifications">
            <FieldRow
              label="Slack Incoming Webhook"
              hint="Get briefing-ready pings and price alert triggers posted to a Slack channel. Create an Incoming Webhook in your Slack app settings and paste the URL below."
            >
              <form onSubmit={saveSlack}>
                <input
                  className="form-input"
                  type="url"
                  placeholder="https://hooks.slack.com/services/..."
                  value={slackWebhook}
                  onChange={e => { setSlackWebhook(e.target.value); setSlackMsg(null) }}
                  style={{ width: '100%', marginBottom: 8 }}
                />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" type="submit" disabled={slackSaving} style={{ fontSize: 12 }}>
                    {slackSaving ? <><div className="spin spin-sm" />Saving...</> : 'Save Webhook'}
                  </button>
                  {advisor?.slack_webhook_url && (
                    <button type="button" className="btn btn-outline" onClick={testSlack} disabled={slackTesting} style={{ fontSize: 12 }}>
                      {slackTesting ? <><div className="spin spin-sm" />Sending...</> : '↗ Send Test'}
                    </button>
                  )}
                  {advisor?.slack_webhook_url && (
                    <button type="button" className="btn btn-outline" onClick={async () => {
                      setSlackSaving(true); setSlackMsg(null)
                      try {
                        const updated = await api.updateSlackWebhook('')
                        setAdvisor(updated); setSlackWebhook('')
                        setSlackMsg({ type: 'success', text: 'Slack notifications disabled.' })
                      } catch (err) {
                        setSlackMsg({ type: 'error', text: err.message })
                      } finally { setSlackSaving(false) }
                    }} style={{ fontSize: 12, color: 'var(--danger)' }}>
                      Disconnect
                    </button>
                  )}
                </div>
                {slackMsg && (
                  <div style={{ fontSize: 12, marginTop: 8, color: slackMsg.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>
                    {slackMsg.text}
                  </div>
                )}
              </form>
            </FieldRow>
            {advisor?.slack_webhook_url && (
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4, padding: '10px 0' }}>
                ✓ Connected · You'll receive a ping when your morning briefing is ready, when filings are detected, and when price alerts trigger.
              </div>
            )}
          </Section>
        </div>
      )}

      {/* ── SECURITY TAB ── */}
      {tab === TAB.SECURITY && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card card-glow" style={{ display: 'none' }}>
            <Section title="API Key">
              <FieldRow
                label="Your API Key"
                hint="Used to authenticate requests to the VeloQuant API. Keep this secret — treat it like a password."
              >
                <div>
                  <div style={{ position: 'relative', display: 'flex', gap: 8 }}>
                    <input
                      className="form-input"
                      readOnly
                      value={showApiKey ? (getApiKey() || '—') : '•'.repeat(32)}
                      style={{ flex: 1, fontFamily: 'monospace', fontSize: 12, letterSpacing: showApiKey ? 0 : '0.06em' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(v => !v)}
                      style={{ padding: '0 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', flexShrink: 0 }}
                    >
                      {showApiKey ? 'Hide' : 'Reveal'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const key = getApiKey()
                        if (!key) return
                        navigator.clipboard.writeText(key).then(() => {
                          setApiKeyCopied(true)
                          setTimeout(() => setApiKeyCopied(false), 2000)
                        })
                      }}
                      style={{ padding: '0 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: apiKeyCopied ? 'var(--success)' : 'var(--text-2)', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', flexShrink: 0 }}
                    >
                      {apiKeyCopied ? '✓ Copied' : '⎘ Copy'}
                    </button>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    {!rotateConfirm ? (
                      <button
                        type="button"
                        onClick={() => setRotateConfirm(true)}
                        style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                      >
                        ↻ Regenerate Key
                      </button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: 'var(--warning)' }}>⚠ Old key will stop working immediately.</span>
                        <button type="button" onClick={handleRotateApiKey} disabled={rotatingKey}
                          style={{ fontSize: 12, padding: '5px 14px', borderRadius: 8, border: 'none', background: 'var(--danger)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                          {rotatingKey ? 'Regenerating...' : 'Yes, Regenerate'}
                        </button>
                        <button type="button" onClick={() => setRotateConfirm(false)}
                          style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </FieldRow>
            </Section>
          </div>

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

      {/* ── CLIENTS TAB ── */}
      {tab === TAB.CLIENTS && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card card-glow" style={{ padding: 28 }}>
            <Section title="Add Contact">
              <form onSubmit={async e => {
                e.preventDefault()
                setContactSaving(true); setContactMsg(null)
                try {
                  if (editingContact) {
                    const updated = await api.updateContact(editingContact.id, { name: contactName, email: contactEmail, client_tag: contactTag })
                    setContacts(prev => prev.map(c => c.id === updated.id ? updated : c))
                    setEditingContact(null)
                    setContactMsg({ type: 'success', text: 'Contact updated.' })
                  } else {
                    const created = await api.createContact(contactName, contactEmail, contactTag)
                    setContacts(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
                    setContactMsg({ type: 'success', text: `${contactName} added.` })
                  }
                  setContactName(''); setContactEmail(''); setContactTag('')
                } catch (err) {
                  setContactMsg({ type: 'error', text: err.message })
                } finally { setContactSaving(false) }
              }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
                  <div className="form-group" style={{ flex: '1 1 160px' }}>
                    <label className="form-label">Full Name</label>
                    <input className="form-input" placeholder="Jane Smith" value={contactName}
                      onChange={e => setContactName(e.target.value)} required style={{ width: '100%' }} />
                  </div>
                  <div className="form-group" style={{ flex: '2 1 220px' }}>
                    <label className="form-label">Email Address</label>
                    <input className="form-input" type="email" placeholder="jane@example.com" value={contactEmail}
                      onChange={e => setContactEmail(e.target.value)} required style={{ width: '100%' }} />
                  </div>
                  <div className="form-group" style={{ flex: '1 1 140px' }}>
                    <label className="form-label">Client Tag <span style={{ color: 'var(--text-2)', fontWeight: 400 }}>(optional)</span></label>
                    <input className="form-input" placeholder="e.g. Smith Family" value={contactTag}
                      onChange={e => setContactTag(e.target.value)} style={{ width: '100%' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, paddingBottom: 1 }}>
                    <button className="btn btn-primary" type="submit" disabled={contactSaving} style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                      {contactSaving ? 'Saving...' : editingContact ? 'Save Changes' : '+ Add Contact'}
                    </button>
                    {editingContact && (
                      <button type="button" className="btn btn-outline" onClick={() => { setEditingContact(null); setContactName(''); setContactEmail(''); setContactTag('') }} style={{ fontSize: 13 }}>
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
                {contactMsg && (
                  <div style={{ fontSize: 12, color: contactMsg.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>
                    {contactMsg.text}
                  </div>
                )}
              </form>
            </Section>

            <Section title={`Contacts · ${contacts.length}`}>
              {contacts.length === 0 ? (
                <div style={{ color: 'var(--text-2)', fontSize: 13, padding: '12px 0' }}>
                  No contacts yet. Add your first client above to enable contact-aware email sending.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {contacts.map((c, i) => (
                    <div key={c.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
                      borderBottom: i < contacts.length - 1 ? '1px solid var(--border)' : 'none',
                      flexWrap: 'wrap',
                    }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{c.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 1 }}>{c.email}</div>
                      </div>
                      {c.client_tag && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                          background: 'rgba(6,182,212,0.1)', color: '#06b6d4',
                          border: '1px solid rgba(6,182,212,0.25)',
                        }}>{c.client_tag}</span>
                      )}
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            setEditingContact(c)
                            setContactName(c.name)
                            setContactEmail(c.email)
                            setContactTag(c.client_tag || '')
                            setContactMsg(null)
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          }}
                          style={{ fontSize: 11 }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={async () => {
                            try {
                              await api.deleteContact(c.id)
                              setContacts(prev => prev.filter(x => x.id !== c.id))
                            } catch (err) { setContactMsg({ type: 'error', text: err.message }) }
                          }}
                          style={{ fontSize: 11 }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>

          <div className="card" style={{ padding: 20, background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--text)' }}>How client tags work:</strong> Assign a "Client Tag" here that matches the tag you use in Holdings. When you open a client email in the Client Emails page, contacts with matching tags will appear as quick-send targets.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
