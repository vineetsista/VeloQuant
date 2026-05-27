const STORAGE_KEY    = 'ria_advisor_id'
const API_KEY_STORAGE = 'ria_api_key'

export function getAdvisorId()  { return localStorage.getItem(STORAGE_KEY) }
export function setAdvisorId(id) { localStorage.setItem(STORAGE_KEY, String(id)) }
export function clearAdvisorId() {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(API_KEY_STORAGE)
}

export function getApiKey()       { return localStorage.getItem(API_KEY_STORAGE) }
export function setApiKey(key)    { localStorage.setItem(API_KEY_STORAGE, key) }

function id() {
  const v = getAdvisorId()
  if (!v) throw new Error('No advisor session found')
  return v
}

async function req(path, options = {}) {
  const key = getApiKey()
  const headers = { ...(options.headers || {}) }
  if (key) headers['X-API-Key'] = key
  const res = await fetch(`/api${path}`, { ...options, headers })
  const data = await res.json()
  if (!res.ok) {
    if (res.status === 402) {
      const err = new Error(data.message || 'Your free trial has ended. Please subscribe to continue.')
      err.code = 'subscription_required'
      throw err
    }
    throw new Error(data.error || `Request failed: ${res.status}`)
  }
  return data
}

export const api = {
  createAdvisor: (name, firm_name, email, password) => req('/advisors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, firm_name, email, password }),
  }),
  getAdvisor:       () => req(`/advisors/${id()}`),
  getHoldings:      () => req(`/advisors/${id()}/holdings`),
  addHolding: (ticker, position_size, client_tag) => req(`/advisors/${id()}/holdings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker, position_size, ...(client_tag ? { client_tag } : {}) }),
  }),
  deleteHolding: (hid) => req(`/advisors/${id()}/holdings/${hid}`, { method: 'DELETE' }),
  getBriefings:     (limit = 10) => req(`/advisors/${id()}/briefings?limit=${limit}`),
  getLatestBriefing:() => req(`/advisors/${id()}/briefings/latest`),
  generateBriefing: () => req(`/advisors/${id()}/generate-briefing`, { method: 'POST' }),
  getMarketData:    () => req(`/advisors/${id()}/market-data`),
  getEarnings:      () => req(`/advisors/${id()}/earnings`),
  getDividends:     () => req(`/advisors/${id()}/dividends`),
  updateHoldingClient: (hid, client_tag) => req(`/advisors/${id()}/holdings/${hid}/client`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_tag }),
  }),
  updateHoldingNotes: (hid, notes) => req(`/advisors/${id()}/holdings/${hid}/notes`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  }),
  getFilingAlerts:  (unreadOnly = false) =>
    req(`/advisors/${id()}/filing-alerts${unreadOnly ? '?unread=true' : ''}`),
  markAlertRead:    (aid) => req(`/filing-alerts/${aid}/read`, { method: 'PATCH' }),
  analyzeFilings:   (days_back = 7) => req(`/advisors/${id()}/analyze-filings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ days_back }),
  }),
  getPriceAlerts:   () => req(`/advisors/${id()}/price-alerts`),
  getUnreadPriceAlerts: () => req(`/advisors/${id()}/price-alerts`).then(a => a.filter(x => !x.read && !x.active).length),
  createPriceAlert: (ticker, alert_type, threshold) => req(`/advisors/${id()}/price-alerts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker, alert_type, threshold }),
  }),
  deletePriceAlert: (aid) => req(`/advisors/${id()}/price-alerts/${aid}`, { method: 'DELETE' }),
  markPriceAlertRead: (aid) => req(`/price-alerts/${aid}/read`, { method: 'PATCH' }),
  markAllPriceAlertsRead: () => req(`/advisors/${id()}/price-alerts/mark-all-read`, { method: 'POST' }),
  reactivatePriceAlert: (aid) => req(`/price-alerts/${aid}/reactivate`, { method: 'POST' }),
  getClientEmails:  () => req(`/advisors/${id()}/client-emails`),
  markEmailSent:    (eid) => req(`/client-emails/${eid}/send`, { method: 'PATCH' }),
  generateClientEmail: (ticker, company_name, trigger_event) =>
    req(`/advisors/${id()}/generate-client-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker, company_name, trigger_event }),
    }),
  verifyEmail: (token) => req(`/verify-email/${token}`, { method: 'POST' }),
  resendVerification: (email) => req('/resend-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }),
  forgotPassword: (email) => req('/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }),
  resetPassword: (token, password) => req(`/reset-password/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  }),
  getAdvisorByEmail: (email, password = '') => req('/advisors/by-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }),
  updateEmailPreferences: (prefs) => req(`/advisors/${id()}/email-preferences`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prefs),
  }),
  updateProfile: (name, firm_name) => req(`/advisors/${id()}/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, firm_name }),
  }),
  changePassword: (current_password, new_password) => req(`/advisors/${id()}/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ current_password, new_password }),
  }),
  rotateApiKey: () => req(`/advisors/${id()}/rotate-api-key`, { method: 'POST' }),
  requestEmailChange: (email) => req(`/advisors/${id()}/request-email-change`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }),
  verifyEmailChange: (token) => req(`/verify-email-change/${token}`, { method: 'POST' }),
  deleteAccount: () => req(`/advisors/${id()}`, { method: 'DELETE' }),
  getMarketIndices: () => req('/market/indices'),
  getPortfolioSnapshots: (days = 30) => req(`/advisors/${id()}/portfolio-snapshots?days=${days}`),
  get52WRanges: () => req(`/advisors/${id()}/holdings/52w`),
  getMarketPrices:  (tickers) => req(`/market/prices?tickers=${tickers.join(',')}`),
  deleteBriefing: (bid) => req(`/briefings/${bid}`, { method: 'DELETE' }),
  sendBriefing: (bid) => req(`/briefings/${bid}/send`, { method: 'POST' }),
  createCheckout: (advisor_id) => req('/stripe/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ advisor_id }),
  }),
  createAnnualCheckout: (advisor_id) => req('/stripe/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ advisor_id, annual: true }),
  }),
  updateSlackWebhook: (webhook_url) => req(`/advisors/${id()}/slack`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ webhook_url }),
  }),
  testSlackWebhook: () => req(`/advisors/${id()}/slack/test`, { method: 'POST' }),
  createPortal: (advisor_id) => req('/stripe/create-portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ advisor_id }),
  }),
  adminGetStats:           () => req('/admin/stats'),
  adminGetAdvisors:        () => req('/admin/advisors'),
  adminGrantLegacy:        (tid) => req(`/admin/advisors/${tid}/grant-legacy`, { method: 'PATCH' }),
  adminSyncStripe:         (tid) => req(`/admin/advisors/${tid}/sync-stripe`, { method: 'POST' }),
  adminDeleteAdvisor:      (tid) => req(`/admin/advisors/${tid}`, { method: 'DELETE' }),
  adminTriggerJobs:        () => req('/admin/run-morning-jobs', { method: 'POST' }),
  adminGenerateBriefingFor: (tid) => req(`/admin/advisors/${tid}/generate-briefing`, { method: 'POST' }),
  demoGenerate: (tickers) => req('/demo/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tickers }),
  }),
  getContacts: () => req(`/advisors/${id()}/contacts`),
  createContact: (name, email, client_tag) => req(`/advisors/${id()}/contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, client_tag }),
  }),
  updateContact: (cid, data) => req(`/advisors/${id()}/contacts/${cid}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),
  deleteContact: (cid) => req(`/advisors/${id()}/contacts/${cid}`, { method: 'DELETE' }),
  deleteFilingAlert: (aid) => req(`/filing-alerts/${aid}`, { method: 'DELETE' }),
  deleteClientEmail: (eid) => req(`/client-emails/${eid}`, { method: 'DELETE' }),
  askPortfolio: (question, history = []) => req(`/advisors/${id()}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, history }),
  }),
  holdingDeepDive: (hid) => req(`/advisors/${id()}/holdings/${hid}/deep-dive`, { method: 'POST' }),
  getTLHCandidates: () => req(`/advisors/${id()}/tlh-candidates`),
}
