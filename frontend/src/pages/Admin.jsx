import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getAdvisorId } from '../api'
import usePageTitle from '../hooks/usePageTitle'

const STATUS_COLOR = {
  active:   'var(--success)',
  trialing: 'var(--accent)',
  past_due: 'var(--danger)',
  canceled: 'var(--text-2)',
  unpaid:   'var(--danger)',
  legacy:   '#10b981',
  none:     'var(--text-2)',
}
const STATUS_LABEL = {
  active: 'Active', trialing: 'Trial', past_due: 'Past Due',
  canceled: 'Canceled', unpaid: 'Unpaid', legacy: 'Legacy', none: 'None',
}

function Metric({ label, value, sub, color, big }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: color || 'var(--text)', fontSize: big ? 30 : undefined }}>
        {value}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
      color: 'var(--text-2)', marginBottom: 10, marginTop: 4,
    }}>{children}</div>
  )
}

function SignupChart({ data }) {
  const max = Math.max(...data.map(d => d.count), 1)
  const W = 100, H = 48
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - (d.count / max) * (H - 4) - 2
    return `${x},${y}`
  }).join(' ')

  const total = data.reduce((s, d) => s + d.count, 0)
  const recent7 = data.slice(-7).reduce((s, d) => s + d.count, 0)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
      <div style={{ flex: 1 }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 56, display: 'block', overflow: 'visible' }}>
          <defs>
            <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f7cf6" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#4f7cf6" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polyline points={pts} fill="none" stroke="#4f7cf6" strokeWidth="1.5" strokeLinejoin="round" />
          {data.map((d, i) => {
            if (d.count === 0) return null
            const x = (i / (data.length - 1)) * W
            const y = H - (d.count / max) * (H - 4) - 2
            return <circle key={i} cx={x} cy={y} r="2" fill="#4f7cf6" />
          })}
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--text-2)' }}>{data[0]?.date.slice(5)}</span>
          <span style={{ fontSize: 10, color: 'var(--text-2)' }}>{data[data.length - 1]?.date.slice(5)}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 28, flexShrink: 0 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>{recent7}</div>
          <div style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 2 }}>Last 7 days</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{total}</div>
          <div style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 2 }}>Last 30 days</div>
        </div>
      </div>
    </div>
  )
}

export default function Admin() {
  usePageTitle('Admin Console')
  const [tab, setTab]               = useState('overview')
  const [stats, setStats]           = useState(null)
  const [users, setUsers]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [search, setSearch]         = useState('')
  const [statusFilter, setFilter]   = useState('all')
  const [sortBy, setSortBy]         = useState('joined')
  const [busy, setBusy]             = useState({})
  const [confirm, setConfirm]       = useState(null)
  const [jobMsg, setJobMsg]         = useState(null)
  const [jobRunning, setJobRunning] = useState(false)
  const [briefingMsg, setBriefingMsg] = useState({})
  const navigate = useNavigate()
  const myId = parseInt(getAdvisorId())

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [s, u] = await Promise.all([api.adminGetStats(), api.adminGetAdvisors()])
      setStats(s); setUsers(u)
    } catch (e) {
      if (e.message.includes('Unauthorized')) navigate('/')
      else setError(e.message)
    } finally { setLoading(false) }
  }

  function setBusyKey(key, val) { setBusy(p => ({ ...p, [key]: val })) }

  async function handleGrantLegacy(u) {
    setBusyKey(`leg_${u.id}`, true)
    try {
      const updated = await api.adminGrantLegacy(u.id)
      setUsers(p => p.map(x => x.id === updated.id ? { ...x, ...updated } : x))
      const s = await api.adminGetStats(); setStats(s)
    } catch (e) { setError(e.message) }
    finally { setBusyKey(`leg_${u.id}`, false) }
  }

  async function handleSyncStripe(u) {
    setBusyKey(`syn_${u.id}`, true)
    try {
      const updated = await api.adminSyncStripe(u.id)
      setUsers(p => p.map(x => x.id === updated.id ? { ...x, ...updated } : x))
    } catch (e) { setError(e.message) }
    finally { setBusyKey(`syn_${u.id}`, false) }
  }

  async function handleDelete(u) {
    if (confirm?.id !== u.id) { setConfirm({ id: u.id, name: u.name }); return }
    setBusyKey(`del_${u.id}`, true)
    try {
      await api.adminDeleteAdvisor(u.id)
      setUsers(p => p.filter(x => x.id !== u.id))
      setConfirm(null)
      const s = await api.adminGetStats(); setStats(s)
    } catch (e) { setError(e.message) }
    finally { setBusyKey(`del_${u.id}`, false) }
  }

  async function handleTriggerJobs() {
    setJobRunning(true); setJobMsg(null)
    try {
      await api.adminTriggerJobs()
      setJobMsg({ ok: true, text: 'Jobs triggered. Check Flask terminal for progress.' })
    } catch (e) { setJobMsg({ ok: false, text: e.message }) }
    finally { setJobRunning(false) }
  }

  async function handleGenerateBriefingFor(u) {
    setBusyKey(`brief_${u.id}`, true)
    setBriefingMsg(p => ({ ...p, [u.id]: null }))
    try {
      await api.adminGenerateBriefingFor(u.id)
      setBriefingMsg(p => ({ ...p, [u.id]: { ok: true } }))
      // Refresh user list to update briefing count
      const updated = await api.adminGetAdvisors()
      setUsers(updated)
    } catch (e) {
      setBriefingMsg(p => ({ ...p, [u.id]: { ok: false, text: e.message } }))
    } finally { setBusyKey(`brief_${u.id}`, false) }
  }

  if (loading) return <div className="loading"><div className="spin" /><span>Loading admin console...</span></div>

  // Filter + sort users
  const filtered = users
    .filter(u => {
      if (search) {
        const s = search.toLowerCase()
        return u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s) || u.firm_name.toLowerCase().includes(s)
      }
      return true
    })
    .filter(u => {
      if (statusFilter === 'all') return true
      if (statusFilter === 'legacy') return u.is_legacy
      return u.subscription_status === statusFilter
    })
    .sort((a, b) => {
      if (sortBy === 'joined')    return new Date(b.created_at) - new Date(a.created_at)
      if (sortBy === 'active')    return (b.briefing_count || 0) - (a.briefing_count || 0)
      if (sortBy === 'name')      return a.name.localeCompare(b.name)
      return 0
    })

  const convRate = stats && (stats.active + stats.canceled) > 0
    ? Math.round(stats.active / (stats.active + stats.canceled) * 100)
    : 0

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              Admin Console
              <span style={{
                fontSize: 10, padding: '3px 10px', borderRadius: 20,
                background: 'rgba(239,68,68,0.12)', color: '#ef4444',
                fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>Owner</span>
            </div>
            <div className="page-subtitle">Platform analytics, user management, and controls</div>
          </div>
          <button className="btn btn-outline" onClick={load} style={{ fontSize: 12 }}>↻ Refresh</button>
        </div>
      </div>

      {error && <div className="error-bar" onClick={() => setError(null)} style={{ cursor: 'pointer' }}>{error} ✕</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--surface)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {[
          { key: 'overview', label: '◆ Overview' },
          { key: 'users',    label: `◈ Users (${users.length})` },
          { key: 'system',   label: '⚙ System' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            background: tab === t.key ? 'var(--surface-2)' : 'transparent',
            color: tab === t.key ? 'var(--text)' : 'var(--text-2)',
            transition: 'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && stats && (
        <div>
          <SectionLabel>Revenue</SectionLabel>
          <div className="stats-row" style={{ marginBottom: 20 }}>
            <Metric label="Monthly Recurring Revenue" value={`$${stats.mrr.toLocaleString()}`} sub={`$${stats.arr.toLocaleString()} ARR`} color="var(--success)" big />
            <Metric label="Active Subscribers" value={stats.active} sub="Paying $299 / mo" color="var(--success)" />
            <Metric label="In Free Trial" value={stats.trialing} sub="14-day trial active" color="var(--accent)" />
            <Metric label="Trial → Paid Rate" value={`${convRate}%`} sub="Of closed trials" color={convRate >= 50 ? 'var(--success)' : 'var(--warning)'} />
          </div>

          <SectionLabel>Users</SectionLabel>
          <div className="stats-row" style={{ marginBottom: 20 }}>
            <Metric label="Total Accounts" value={stats.total_users} sub="All time signups" />
            <Metric label="Legacy Access" value={stats.legacy} sub="Grandfathered full access" />
            <Metric label="Past Due" value={stats.past_due} sub={stats.past_due > 0 ? 'Payment failed — at risk' : 'All clear'} color={stats.past_due > 0 ? 'var(--danger)' : undefined} />
            <Metric label="Churned" value={stats.canceled} sub="Canceled subscriptions" color={stats.canceled > 0 ? 'var(--text-2)' : undefined} />
          </div>

          <SectionLabel>Platform Activity</SectionLabel>
          <div className="stats-row" style={{ marginBottom: 24 }}>
            <Metric label="Total Briefings" value={stats.total_briefings} sub="AI reports generated" />
            <Metric label="Filing Alerts" value={stats.total_alerts} sub="SEC insights delivered" />
            <Metric label="Client Emails" value={stats.total_emails} sub="Drafts generated" />
            <Metric
              label="Avg Briefings / User"
              value={stats.total_users > 0 ? (stats.total_briefings / stats.total_users).toFixed(1) : '—'}
              sub="Engagement metric"
            />
          </div>

          {stats.signup_trend && (
            <>
              <SectionLabel>Signups — Last 30 Days</SectionLabel>
              <div className="card" style={{ padding: '20px 24px' }}>
                <SignupChart data={stats.signup_trend} />
              </div>
            </>
          )}
        </div>
      )}

      {/* ── USERS ── */}
      {tab === 'users' && (
        <div>
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              className="form-input"
              placeholder="Search by name, email, or firm..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 280, fontSize: 13 }}
            />
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {['all', 'trialing', 'active', 'past_due', 'canceled', 'legacy'].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                  border: `1px solid ${statusFilter === f ? 'var(--accent)' : 'var(--border)'}`,
                  background: statusFilter === f ? 'rgba(79,124,246,0.1)' : 'transparent',
                  color: statusFilter === f ? 'var(--accent)' : 'var(--text-2)',
                  cursor: 'pointer', textTransform: 'capitalize',
                }}>
                  {f === 'all' ? `All (${users.length})` : f.replace('_', ' ')}
                </button>
              ))}
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-2)' }}>Sort:</span>
              {[['joined', 'Newest'], ['active', 'Most Active'], ['name', 'A–Z']].map(([k, l]) => (
                <button key={k} onClick={() => setSortBy(k)} style={{
                  padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                  border: `1px solid ${sortBy === k ? 'var(--accent)' : 'var(--border)'}`,
                  background: sortBy === k ? 'rgba(79,124,246,0.1)' : 'transparent',
                  color: sortBy === k ? 'var(--accent)' : 'var(--text-2)', cursor: 'pointer',
                }}>{l}</button>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Holdings</th>
                  <th style={{ textAlign: 'center' }}>Briefings</th>
                  <th style={{ textAlign: 'center' }}>Email</th>
                  <th>Last Active</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const statusKey = u.is_legacy ? 'legacy' : (u.subscription_status || 'none')
                  const color = STATUS_COLOR[statusKey] || 'var(--text-2)'
                  const label = STATUS_LABEL[statusKey] || statusKey
                  const isConfirm = confirm?.id === u.id

                  return (
                    <tr key={u.id} style={{ opacity: u.subscription_status === 'canceled' ? 0.55 : 1 }}>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{u.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{u.firm_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{u.email}</div>
                        {u.id === myId && (
                          <span style={{ fontSize: 9, fontWeight: 800, color: '#ef4444', letterSpacing: '0.1em', textTransform: 'uppercase' }}>YOU</span>
                        )}
                      </td>
                      <td>
                        <span style={{
                          fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20,
                          color, background: `${color}18`,
                          textTransform: 'uppercase', letterSpacing: '0.08em',
                        }}>{label}</span>
                        {u.subscription_status === 'trialing' && u.trial_days_remaining != null && (
                          <div style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 3 }}>
                            {u.trial_days_remaining}d left
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{u.holding_count ?? 0}</td>
                      <td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{u.briefing_count ?? 0}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span title={u.briefing_email_enabled === false ? 'Unsubscribed' : 'Email on'} style={{ fontSize: 14 }}>
                          {u.briefing_email_enabled === false ? '🔕' : '✉'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {u.last_briefing_at
                          ? new Date(u.last_briefing_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : <span style={{ color: 'var(--text-2)' }}>Never</span>}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-2)' }}>
                        {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {u.holding_count > 0 && (
                            <div>
                              <button
                                className="btn btn-outline btn-sm"
                                onClick={() => handleGenerateBriefingFor(u)}
                                disabled={!!busy[`brief_${u.id}`]}
                                style={{ fontSize: 10, whiteSpace: 'nowrap', color: 'var(--accent)', borderColor: 'rgba(79,124,246,0.4)' }}
                                title="Generate a briefing for this user"
                              >
                                {busy[`brief_${u.id}`] ? '...' : '◆ Brief'}
                              </button>
                              {briefingMsg[u.id] && (
                                <div style={{ fontSize: 9, marginTop: 2, color: briefingMsg[u.id].ok ? 'var(--success)' : 'var(--danger)' }}>
                                  {briefingMsg[u.id].ok ? '✓ done' : briefingMsg[u.id].text?.slice(0, 24)}
                                </div>
                              )}
                            </div>
                          )}
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => handleGrantLegacy(u)}
                            disabled={!!busy[`leg_${u.id}`]}
                            style={{
                              fontSize: 10, whiteSpace: 'nowrap',
                              color: u.is_legacy ? 'var(--warning)' : undefined,
                              borderColor: u.is_legacy ? 'var(--warning)' : undefined,
                            }}
                          >
                            {busy[`leg_${u.id}`] ? '...' : u.is_legacy ? 'Revoke Legacy' : 'Grant Legacy'}
                          </button>
                          {u.stripe_subscription_id && (
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => handleSyncStripe(u)}
                              disabled={!!busy[`syn_${u.id}`]}
                              style={{ fontSize: 10 }}
                            >
                              {busy[`syn_${u.id}`] ? '...' : '↻ Sync'}
                            </button>
                          )}
                          {u.id !== myId && (
                            <>
                              <button
                                onClick={() => isConfirm ? handleDelete(u) : setConfirm({ id: u.id, name: u.name })}
                                disabled={!!busy[`del_${u.id}`]}
                                style={{
                                  fontSize: 10, borderRadius: 6, padding: '3px 8px', fontFamily: 'inherit', fontWeight: 700,
                                  cursor: 'pointer', transition: 'all 0.15s',
                                  background: isConfirm ? '#ef4444' : 'transparent',
                                  border: `1px solid ${isConfirm ? '#ef4444' : 'rgba(239,68,68,0.4)'}`,
                                  color: isConfirm ? '#fff' : '#ef4444',
                                }}
                              >
                                {busy[`del_${u.id}`] ? '...' : isConfirm ? 'Confirm' : 'Delete'}
                              </button>
                              {isConfirm && (
                                <button
                                  onClick={() => setConfirm(null)}
                                  style={{
                                    fontSize: 10, borderRadius: 6, padding: '3px 8px', fontFamily: 'inherit',
                                    background: 'transparent', border: '1px solid var(--border)',
                                    color: 'var(--text-2)', cursor: 'pointer',
                                  }}
                                >Cancel</button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="empty">No users match your filters.</div>
            )}
          </div>
        </div>
      )}

      {/* ── SYSTEM ── */}
      {tab === 'system' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card card-glow" style={{ padding: 28 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: 14 }}>Morning Briefing Scheduler</div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Daily Morning Briefing Jobs</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, maxWidth: 420 }}>
                  Runs automatically at 7:30am ET via APScheduler for all active subscribers with holdings.
                  Use the button below to trigger a manual run for testing or recovery.
                </div>
              </div>
              <div style={{ flexShrink: 0 }}>
                <button
                  className="btn btn-primary"
                  onClick={handleTriggerJobs}
                  disabled={jobRunning}
                >
                  {jobRunning ? <><div className="spin spin-sm" />Running jobs...</> : '▶ Run Morning Jobs Now'}
                </button>
                {jobMsg && (
                  <div style={{ marginTop: 8, fontSize: 12, color: jobMsg.ok ? 'var(--success)' : 'var(--danger)' }}>
                    {jobMsg.text}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 28 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: 14 }}>Platform Configuration</div>
            {[
              ['Subscription Price',   '$299 / month'],
              ['Free Trial Duration',  '14 days'],
              ['Briefing Schedule',    '7:30 AM ET · Daily'],
              ['AI Model',             'Claude Sonnet 4.6 (Anthropic)'],
              ['Market Data',          'Polygon.io · 15-min delayed'],
              ['Email Delivery',       'SendGrid'],
              ['Payments',             'Stripe'],
              ['Admin Access',         'Gated by ADMIN_EMAIL env var'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ color: 'var(--text-2)' }}>{k}</span>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
