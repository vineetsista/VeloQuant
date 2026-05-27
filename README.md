<div align="center">

<img src="frontend/public/veloquant-logo.svg" alt="VeloQuant" width="220" />

# **VeloQuant**

### Morning intelligence for independent financial advisors.

*Goldman Sachs has a team of analysts. Now so do you.*

[![Live at veloquant.net](https://img.shields.io/badge/Live-veloquant.net-4f7cf6?style=for-the-badge)](https://veloquant.net)
[![Built with Claude](https://img.shields.io/badge/AI-Claude_Sonnet_4.6-d97757?style=for-the-badge)](https://www.anthropic.com)
[![Stack](https://img.shields.io/badge/Stack-React_+_Flask_+_Postgres-06b6d4?style=for-the-badge)]()
[![License](https://img.shields.io/badge/License-Proprietary-ff4560?style=for-the-badge)]()

</div>

---

## What it does

Every weekday at **7:30am ET**, VeloQuant delivers a personalized morning briefing covering every holding in an advisor's book — overnight moves, SEC filings, analyst data, insider transactions, earnings, and ready-to-send client talking points. **In 10 minutes, not 2 hours.**

Built for independent RIAs managing $20M–$300M AUM who don't have a Bloomberg terminal — and shouldn't need one.

---

## ✦ The product

| Capability | What it is |
|---|---|
| **◆ Morning Briefing** | Daily 7:30am AI briefing — portfolio-specific, every claim sourced. Powered by Claude with a buy-side analyst system prompt. |
| **✺ Ask Portfolio** | Natural-language Q&A grounded in your real holdings, filings, news, and the latest briefing. ChatGPT-style chat, no hallucinations. |
| **✺ Holding Deep-Dive** | One-click analyst memo on any position: catalysts, numbers, what-to-watch, client talking points. |
| **📨 Friday Executive Wrap** | Auto-generated Friday 4:15pm ET email: the week in your book, next week's catalysts, weekend client talking points. |
| **◎ SEC Filing Alerts** | Real-time EDGAR monitoring with material-impact analysis on every 8-K, 10-Q, and insider Form 4 — for every holding. |
| **✦ Client Email Drafts** | AI-drafted client communications. Plain English. Never sent automatically. |
| **◉ Watchlist + Price Alerts** | Threshold-based alerts (above/below/% move) with email + Slack delivery. |
| **💰 Tax-Loss Harvesting** | Surfaces holdings down ≥3% with estimated tax benefit. |
| **◈ Portfolio Analytics** | Allocation donut, sector breakdown, 52-week range bars, concentration risk, 30-day trend sparkline, benchmark comparison. |

---

## ⚡ Stack

<table>
<tr><td><b>Frontend</b></td><td>React 18 (Vite) · React Router v6 · Source Serif Pro typography · Plausible analytics</td></tr>
<tr><td><b>Backend</b></td><td>Python · Flask · SQLAlchemy · APScheduler · Flask-Limiter</td></tr>
<tr><td><b>Database</b></td><td>PostgreSQL</td></tr>
<tr><td><b>AI</b></td><td>Anthropic Claude (Sonnet 4.6)</td></tr>
<tr><td><b>Market data</b></td><td>Polygon.io · Finnhub · FINRA · SEC EDGAR</td></tr>
<tr><td><b>Email</b></td><td>SendGrid (verified sender on veloquant.net)</td></tr>
<tr><td><b>Payments</b></td><td>Stripe ($99/mo subscription, 14-day free trial)</td></tr>
<tr><td><b>Deploy</b></td><td>Railway (monorepo: Flask serves built React bundle)</td></tr>
</table>

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                          veloquant.net                           │
└──────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
              ┌───────────────────────────────────┐
              │  Flask app  (Railway)             │
              │  ├─ /api/*       JSON routes      │
              │  └─ /*           React SPA bundle │
              └───────────────────────────────────┘
                                  │
        ┌──────────┬──────────────┼──────────────┬──────────┐
        ▼          ▼              ▼              ▼          ▼
   ┌────────┐ ┌────────┐ ┌────────────────┐ ┌────────┐ ┌────────┐
   │Postgres│ │ Claude │ │ Market Data    │ │SendGrid│ │ Stripe │
   │        │ │ API    │ │ Polygon · EDGAR│ │        │ │        │
   │advisors│ │        │ │ Finnhub · FINRA│ │        │ │        │
   │holdings│ │        │ │                │ │        │ │        │
   │briefings│└────────┘ └────────────────┘ └────────┘ └────────┘
   │alerts  │
   │emails  │
   └────────┘
                                  │
                                  ▼
              ┌───────────────────────────────────┐
              │  APScheduler (background jobs)    │
              │  ├─ 7:30am ET weekdays  briefings │
              │  ├─ 6:00am ET daily     trial nag │
              │  └─ 4:15pm ET Fridays   weekly wrap│
              └───────────────────────────────────┘
```

---

## 📂 Repo layout

```
RIAPlatform/
├── backend/
│   ├── app.py                       # Flask routes (auth, holdings, billing, briefings, Q&A)
│   ├── models.py                    # SQLAlchemy models
│   ├── scheduler.py                 # Background jobs (briefings, weekly wrap, trial reminders)
│   ├── email_delivery.py            # SendGrid HTML email templates
│   ├── data/
│   │   ├── polygon.py               # Market data (with thread-safe caching)
│   │   ├── edgar.py                 # SEC filings
│   │   ├── finnhub.py               # News, earnings, analyst data
│   │   ├── finra.py                 # Short-volume data
│   │   └── news.py                  # Macro / news aggregation
│   └── intelligence/
│       ├── briefing.py              # Morning briefing — Claude prompt + data fusion
│       ├── portfolio_qa.py          # Ask Portfolio + Deep-Dive + Weekly Wrap
│       ├── filing_analyzer.py       # SEC filing impact analysis
│       └── email_generator.py       # Client email drafts
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx                  # Router + layout
│   │   ├── api.js                   # API client
│   │   ├── index.css                # Design system
│   │   ├── components/
│   │   │   ├── BriefingRenderer.jsx # Premium briefing typography
│   │   │   ├── MarketBar.jsx        # Live indices ticker
│   │   │   ├── Toast.jsx
│   │   │   └── ErrorBoundary.jsx
│   │   └── pages/
│   │       ├── Landing.jsx          # Marketing page + ROI calculator + demo
│   │       ├── Dashboard.jsx        # Briefing + portfolio + alerts
│   │       ├── Ask.jsx              # Portfolio Q&A chat
│   │       ├── Holdings.jsx         # Holdings table + analytics + deep-dive
│   │       ├── Briefing.jsx         # Briefing archive (↑/↓ navigation)
│   │       ├── FilingAlerts.jsx     # SEC filing inbox
│   │       ├── ClientEmails.jsx     # AI-drafted emails
│   │       ├── Watchlist.jsx        # Price alerts
│   │       ├── Settings.jsx         # Profile · billing · security · Slack
│   │       ├── Admin.jsx            # Owner-only admin console
│   │       └── Onboarding.jsx       # Signup + holdings setup
│   ├── public/                      # Static assets (logo, sitemap, robots)
│   └── index.html
│
├── .env.example                     # Required environment variables
├── Dockerfile                       # Railway build
└── README.md
```

---

## 🚀 Quick start (local dev)

**Prerequisites:** Python 3.10+, Node 18+, PostgreSQL 14+

```bash
# 1. Backend
cd backend
python -m venv venv
source venv/bin/activate          # (Windows) venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example ../.env         # fill in your API keys
flask --app app run

# 2. Frontend (in a separate terminal)
cd frontend
npm install
npm run dev                        # http://localhost:5173

# 3. Database
createdb ria_intelligence          # or use the DATABASE_URL from Railway
```

Required environment variables — see `.env.example` for the full list:

| Variable | What it's for |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `ANTHROPIC_API_KEY` | Claude API |
| `POLYGON_API_KEY` | Free-tier market data |
| `SENDGRID_API_KEY` + `BRIEFING_FROM_EMAIL` | Email delivery |
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + `STRIPE_PRICE_ID` | Billing |
| `APP_URL` | Used in email links + Stripe redirects |
| `ADMIN_EMAIL` | Email that gets access to `/admin` |
| `FINNHUB_API_KEY` | Free-tier news/earnings/analyst data |

---

## 🔐 Security & privacy by design

- **No client data ever stored.** Advisors enter stock tickers only — never client names, account numbers, or portfolio values.
- **TLS 1.3 in transit · AES-256 at rest.**
- **No CRM/custodian integrations.** Completely siloed from sensitive client systems.
- **Per-advisor API keys** with rotation. Stripe webhook signature verification. CAN-SPAM-compliant unsubscribe tokens.
- **Rate-limited AI endpoints** (briefings 8/hr, Q&A 30/hr, deep-dive 20/hr) to prevent quota exhaustion.
- **Prompt-injection sanitization** on user-supplied focus strings and Q&A questions.

---

## 📈 The briefing — what makes it different

Most "AI market summary" tools regurgitate generic news. VeloQuant's briefing system prompt is engineered to behave like the head of equity research at a buy-side firm:

- **Every number is sourced.** Not "beat estimates" — "beat by $0.14/share, or 5.2%".
- **Mechanism, not conclusion.** Not "this is good for banks" — "rising NII directly expands JPM's net interest margin, which represents 58% of revenue."
- **Portfolio-specific.** Every claim ties back to the advisor's actual positions.
- **Client-call ready.** Every item ends with a sentence the advisor could use on a client call.

Read the system prompt yourself: `backend/intelligence/briefing.py`.

---

## 🧠 Tech highlights

- **Concurrent data fetch** via `ThreadPoolExecutor` — briefing pulls market data, EDGAR, Finnhub news, earnings, analyst consensus, FINRA short volume, and macro indices *in parallel*.
- **Two-call grouped daily strategy** for Polygon free tier — avoids the paid snapshot endpoint by computing close + day-pct from `yesterday` + `day-before` grouped daily endpoints (with 12s rate-limit gap).
- **Thread-locked caching** in `polygon.py` prevents duplicate fetches under React StrictMode double-render in dev.
- **Idempotent schema migrations** run at app startup — safe to re-deploy.
- **Source Serif Pro briefing typography** for institutional-grade reading experience. Print stylesheet so advisors can export to PDF.

---

## 🛣️ Roadmap

- [x] Morning briefing pipeline
- [x] SEC filing alerts
- [x] Stripe billing + 14-day trial
- [x] Client email drafts
- [x] Watchlist / price alerts
- [x] Slack notifications
- [x] **Ask Portfolio** — natural-language Q&A
- [x] **Holding Deep-Dive** — one-page analyst memos
- [x] **Friday Executive Wrap** — auto Friday email
- [x] **Tax-Loss Harvesting** candidates
- [ ] Benzinga Pro integration (named analyst upgrades/downgrades)
- [ ] Polygon paid tier (pre-market prices)
- [ ] Unusual Whales (options flow)
- [ ] Earnings-call transcript summaries
- [ ] Multi-portfolio support (one advisor, many client books)
- [ ] Client-facing PDF report generator (white-label)
- [ ] MFA + IP whitelist

---

## 👤 Built by

**Vineet Sista** · Founder

> *"Independent advisors are brilliant — but they're losing two hours every morning to research a team of analysts could do in fifteen minutes. The information advantage shouldn't belong only to the white-shoe firms."*

🌐 [veloquant.net](https://veloquant.net) · ✉️ support@veloquant.net

---

<div align="center">

*Not investment advice. For informational and productivity purposes only.*

</div>
