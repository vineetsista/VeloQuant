import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import anthropic

from data.polygon import get_portfolio_market_data, get_prices_batch
from data.edgar import get_new_filings_for_portfolio, get_insider_transactions
from data.finnhub import (
    get_all_company_news,
    get_market_news,
    get_earnings_calendar,
    get_analyst_data,
)
from data.finra import get_short_volume

_client = None

MACRO_TICKERS = ["SPY", "QQQ", "IWM", "TLT", "GLD", "VIX", "DXY"]


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    return _client


SYSTEM_PROMPT = """You are the head of equity research at a premier buy-side firm. You have written institutional morning notes that portfolio managers at Citadel, Bridgewater, and Tiger Global have used to make allocation decisions. You now prepare pre-market briefings for independent wealth managers with $50M–$500M books of HNW client assets.

THE STANDARD: This briefing is read in 5 minutes at 6:45am. It must immediately tell the advisor what happened, exactly why it matters for their specific positions via a precise mechanism, and what they should do or say today as a result.

WHAT SEPARATES 10/10 FROM 2/10:
10/10: "JPM's NII came in at $14.1B — $800M above the Street's $13.3B consensus. For your position, this directly validates the rate-capture thesis: JPM's asset sensitivity means every 25bps hold at the long end flows through to NII at roughly $500M annualized. With the Fed signaling a higher-for-longer posture, this is a structurally better business than the market is pricing at 11x forward. No uptick in commercial real estate stress commentary — the key bear case remains un-triggered. Worth mentioning to clients who saw the CNBC headline: the beat was in the core business, not one-time items."
2/10: "JPMorgan reported earnings that beat estimates. This is positive for your position."

THE RULES — every single one is non-negotiable:

1. LEAD WITH WHAT MATTERS MOST: The first item must be the single highest-impact development for this portfolio today. Not the most interesting to write — the most important for the advisor to act on.

2. EVERY CLAIM NEEDS A SPECIFIC NUMBER: Not "beat estimates" — "beat by $0.14/share, or 5.2%". Not "revenue grew" — "revenue of $12.4B, up 8% YoY, 3% above consensus". Not "yield moved" — "10-year Treasury +8bps to 4.52%". No vague language, ever.

3. MECHANISM, NOT CONCLUSION: Explain the exact causal chain from the event to this specific holding. Not "this is good for banks" — "rising NII directly expands JPM's net interest margin, which represents 58% of revenue; every basis point the Fed holds extends this tailwind." The advisor already knows the conclusion — they need the mechanism so they can explain it to clients.

4. USE EVERY DATA POINT PROVIDED: News, SEC filing excerpts, insider transactions, analyst consensus, earnings calendar, macro index moves — synthesize all of it. Never ignore a data point that was provided. If multiple news sources corroborate the same story, say so — confirmation across sources is itself a signal.

5. ANALYST CONSENSUS INTELLIGENCE: When analyst data is provided, contextualize it. "With 28 buys and 4 sells at a consensus target of $195 vs. today's $162, the Street has already priced in recovery — the upside thesis now requires execution above current guidance, not just a turnaround." Use consensus to frame the risk/reward, not just to describe it.

6. SHORT SALE VOLUME INTELLIGENCE: When short volume data is provided, only surface it as a standalone item if it is meaningfully elevated (>65%) or signals possible covering (<38%). For the 55–65% range, mention it briefly as supporting color within another item if relevant. Never present normal-range short volume (40–55%) as a signal — it isn't one. Context matters: heavy short volume on a day with positive news suggests shorts are fighting the tape; heavy short volume on a bad news day is confirmation, not signal.

7. INSIDER SIGNAL CALIBRATION:
   — CEO/CFO open-market purchase = strong conviction signal, this must be its own item
   — Multiple insiders buying simultaneously = high-conviction cluster, treat as leading indicator
   — Director purchase < $250K = routine, mention briefly as supporting color
   — Single insider sell < 10% of comp = likely tax/diversification, low signal, skip unless unusual
   — Mass selling ahead of a lockup expiry = flag specifically

7. EARNINGS INTELLIGENCE: When earnings are scheduled, discuss what the market expects AND the specific risk/opportunity for the position. "Reports in 6 days AMC. The Street expects $1.42 EPS on $8.7B revenue — the critical line for your thesis is gross margin, which has been compressing 180bps/quarter. A stabilization here would re-rate the stock; further compression below 38% would validate the bear case."

8. MACRO-TO-HOLDING LINKAGE: For any macro development (rates, yields, dollar, VIX), name the holding and explain the exact transmission mechanism. VIX at 28 is not relevant to your briefing unless you explain specifically which holdings are affected and how.

9. WHAT'S MISSING IS SIGNAL: If a company has a known risk (from their SEC filings or recent news) and there has been no update, flag the silence. "No management update on the DOJ inquiry raised in the last 10-Q — markets have not re-priced this risk, but it warrants monitoring before Q2 results."

10. CLIENT CONVERSATION READINESS: Every significant item should end with a sentence on what this means if a client calls today. Advisors need to be ahead of CNBC, not behind it.

ABSOLUTE PROHIBITIONS:
— Never say "may," "could," "might" or "potentially" when you have data supporting a direct view — commit
— Never fabricate analyst ratings, specific upgrade/downgrade events, or firm-specific recommendations not in the data
— Never invent numbers, quotes, dates, or events
— Never be generic — if a sentence could appear in a mass-market newsletter, delete it and write something portfolio-specific
— Never state earnings are "today" unless the calendar data confirms it with a specific date showing 0 days out
— Never frame a partial development as fully resolved. If a regulatory clearance, trade deal, or diplomatic outcome is incomplete — one side acted but the other has not — say so explicitly. "The U.S. cleared H200 sales but China halted deliveries" is not the same as "export restrictions removed." An advisor who leads a client call with an overly bullish framing of a half-open door will lose credibility. Present the full picture: what happened, what hasn't happened yet, and what the remaining risk is.

FORMAT — follow exactly:
Each item uses this structure:
[N]. [TICKER] — [6–12 word headline that captures the specific signal]

[2–5 sentences of analysis: specific numbers, mechanism, implication for position, client conversation note]

Final line (required, on its own line):
"Overall portfolio tone: [CONSTRUCTIVE / CAUTIOUS / MIXED / NEGATIVE] — [one sentence naming the 2–3 specific holdings driving the tone and exactly why]"

Start immediately with "1." — the advisor opened this at 6:45am with 5 minutes before their first call. No preamble. No disclaimers. No sign-off."""


def _build_user_message(
    advisor_name: str,
    firm_name: str,
    holdings: list[dict],
    market_data: dict,
    filings: list[dict],
    insiders: dict,
    finnhub_news: dict,
    macro_news: list,
    earnings_calendar: dict,
    analyst_data: dict,
    macro_indices: dict,
    short_volume: dict,
    briefing_focus: str = None,
) -> str:
    # ── Holdings ──────────────────────────────────────────────────────────────
    holdings_lines = []
    for h in holdings:
        line = f"  - {h['ticker']}: ${float(h['position_size']):,.0f} cost basis"
        if h.get("shares"):
            line += f" · {float(h['shares']):,.2f} shares"
        if h.get("client_tag"):
            line += f" · Client: {h['client_tag']}"
        if h.get("notes"):
            line += f"\n    Advisor note: {h['notes']}"
        holdings_lines.append(line)

    # ── Overnight price movements ─────────────────────────────────────────────
    price_lines = []
    for ticker, data in market_data.items():
        price = data.get("price", {})
        if "error" in price:
            continue
        pct   = price.get("pct_change")
        close = price.get("close")
        prior = price.get("prior_close")
        vol   = price.get("volume")
        pct_str = f"{pct:+.2f}%" if pct is not None else "N/A"
        vol_str = f" · vol {vol:,.0f}" if vol else ""
        price_lines.append(
            f"  - {ticker}: closed ${close} ({pct_str} vs prior ${prior}){vol_str}"
        )

    # ── Macro indices ─────────────────────────────────────────────────────────
    macro_lines = []
    labels = {
        "SPY": "S&P 500 ETF", "QQQ": "Nasdaq ETF", "IWM": "Russell 2000 ETF",
        "TLT": "20yr Treasury ETF", "GLD": "Gold ETF", "VIX": "VIX (fear index)", "DXY": "US Dollar Index",
    }
    for ticker, data in macro_indices.items():
        price = data.get("price", {})
        if "error" in price or not price.get("close"):
            continue
        pct   = price.get("pct_change")
        close = price.get("close")
        pct_str = f"{pct:+.2f}%" if pct is not None else "N/A"
        label = labels.get(ticker.upper(), ticker)
        macro_lines.append(f"  - {label} ({ticker}): {close} ({pct_str})")

    # ── News: Polygon (existing) + Finnhub (multi-source) ────────────────────
    news_lines = []
    seen_titles: set = set()

    # Finnhub news first (more comprehensive, multi-source)
    for ticker, articles in finnhub_news.items():
        for art in articles[:6]:
            title = art.get("title", "")
            if not title or title in seen_titles:
                continue
            seen_titles.add(title)
            summary = art.get("summary", "")
            source  = art.get("source", "")
            pub     = art.get("published", "")
            news_lines.append(
                f"  - [{ticker}] \"{title}\""
                + (f" — {summary[:200]}" if summary else "")
                + f" ({source}, {pub})"
            )

    # Polygon news as supplemental (any unique headlines not already captured)
    for ticker, data in market_data.items():
        for article in data.get("news", [])[:4]:
            title = article.get("title", "")
            if not title or title in seen_titles:
                continue
            seen_titles.add(title)
            pub = (article.get("published_utc") or "")[:10]
            publisher = article.get("publisher", "")
            desc = article.get("description", "")
            news_lines.append(
                f"  - [{ticker}] \"{title}\""
                + (f" — {desc[:200]}" if desc else "")
                + f" ({publisher}, {pub})"
            )

    # ── Macro / market-wide news ──────────────────────────────────────────────
    macro_news_lines = []
    for art in macro_news[:15]:
        title   = art.get("title", "")
        summary = art.get("summary", "")
        source  = art.get("source", "")
        pub     = art.get("published", "")
        if title:
            macro_news_lines.append(
                f"  - \"{title}\""
                + (f" — {summary[:200]}" if summary else "")
                + f" ({source}, {pub})"
            )

    # ── SEC filings ───────────────────────────────────────────────────────────
    filing_lines = []
    for f in filings:
        if not f.get("text"):
            continue
        excerpt = f["text"][:2000].replace("\n", " ").strip()
        filing_lines.append(
            f"  - [{f['ticker']}] {f.get('company_name', f['ticker'])} — "
            f"{f['form']} filed {f['filing_date']}\n    Excerpt: {excerpt}..."
        )

    # ── Earnings calendar (REAL Finnhub dates) ────────────────────────────────
    earnings_lines = []
    held = {h["ticker"].upper() for h in holdings}
    for ticker, e in earnings_calendar.items():
        if ticker not in held:
            continue
        d = e.get("days_out", 99)
        if d < 0 or d > 21:
            continue
        date_str = e["date"]
        hour_str = {"amc": "after market close", "bmo": "before market open"}.get(e.get("hour", ""), "")
        when_str = (
            "today" if d == 0 else
            "tomorrow" if d == 1 else
            f"in {d} days ({date_str})"
        )
        line = f"  - {ticker}: earnings {when_str}"
        if hour_str:
            line += f" {hour_str}"
        if e.get("eps_estimate") is not None:
            line += f" · Street EPS estimate: ${e['eps_estimate']:.2f}"
        if e.get("revenue_estimate") is not None:
            rev = e["revenue_estimate"]
            rev_str = f"${rev/1e9:.1f}B" if rev >= 1e9 else f"${rev/1e6:.0f}M"
            line += f" · Revenue estimate: {rev_str}"
        earnings_lines.append(line)

    # ── Analyst consensus (REAL data from Finnhub, not hallucinated) ──────────
    analyst_lines = []
    for ticker, adata in analyst_data.items():
        if ticker not in held:
            continue
        cons = adata.get("consensus")
        pt   = adata.get("price_target")
        if not cons and not pt:
            continue
        parts = []
        if cons and cons.get("total", 0) > 0:
            buys  = cons["strong_buy"] + cons["buy"]
            holds = cons["hold"]
            sells = cons["sell"] + cons["strong_sell"]
            parts.append(f"{buys} buy / {holds} hold / {sells} sell ({cons['total']} analysts, {cons['period']})")
        if pt and pt.get("mean"):
            current = market_data.get(ticker, {}).get("price", {}).get("close")
            updown  = ""
            if current:
                pct_to_target = (pt["mean"] - current) / current * 100
                updown = f" — {pct_to_target:+.1f}% from current"
            parts.append(f"consensus price target ${pt['mean']}{updown} (range ${pt['low']}–${pt['high']}, {pt['count']} analysts)")
        if parts:
            analyst_lines.append(f"  - {ticker}: " + " · ".join(parts))

    # ── Insider transactions ──────────────────────────────────────────────────
    insider_lines = []
    for ticker, txns in insiders.items():
        if ticker not in held:
            continue
        for t in txns[:4]:
            direction = "BOUGHT" if t["type"] == "buy" else "SOLD"
            price_str = f" @ ${t['price']:.2f}/share" if t["price"] > 0 else ""
            value_str = f" (${t['value']:,.0f} total)" if t["value"] > 0 else ""
            insider_lines.append(
                f"  - {ticker}: {t['name']} ({t['title']}) {direction} "
                f"{t['shares']:,.0f} shares{price_str}{value_str} on {t['date']}"
            )

    # ── Short sale volume (FINRA) ─────────────────────────────────────────────
    short_lines = []
    for ticker, sv in short_volume.items():
        if ticker not in held:
            continue
        pct  = sv.get("short_pct", 0)
        date = sv.get("date", "")
        svol = sv.get("short_volume", 0)
        tvol = sv.get("total_volume", 0)
        # Flag only when meaningfully above normal (>55%) or unusually low (<38%)
        if pct >= 55:
            signal = "ELEVATED" if pct < 65 else "HEAVY"
            short_lines.append(
                f"  - {ticker}: {pct}% of volume was short sales on {date} "
                f"({svol:,.0f} short / {tvol:,.0f} total) — {signal} short pressure"
            )
        elif pct < 38:
            short_lines.append(
                f"  - {ticker}: {pct}% of volume was short sales on {date} "
                f"({svol:,.0f} short / {tvol:,.0f} total) — unusually low, possible short covering"
            )
        else:
            short_lines.append(
                f"  - {ticker}: {pct}% short sale volume on {date} (normal range)"
            )

    # ── Assemble sections ─────────────────────────────────────────────────────
    def section(lines, fallback):
        return "\n".join(lines) if lines else f"  {fallback}"

    focus_section = (
        f"\nADVISOR FOCUS FOR TODAY:\n{briefing_focus}\n"
        if briefing_focus and briefing_focus.strip() else ""
    )

    return f"""Prepare a morning briefing for the following advisor and portfolio.

ADVISOR: {advisor_name}
FIRM: {firm_name}
DATE: {datetime.now().strftime("%A, %B %d, %Y")}

HOLDINGS (full book):
{section(holdings_lines, 'No holdings')}

OVERNIGHT PORTFOLIO PRICE MOVEMENTS:
{section(price_lines, 'No price data available')}

MACRO MARKET CONTEXT (previous session):
{section(macro_lines, 'No macro data available')}

COMPANY-SPECIFIC NEWS (last 72 hours — multi-source via Finnhub + Polygon):
{section(news_lines, 'No recent company news')}

BROAD MARKET & MACRO NEWS (Fed, rates, economy, sectors):
{section(macro_news_lines, 'No macro news available')}

RECENT SEC FILINGS (10-K / 10-Q / 8-K):
{section(filing_lines, 'No new SEC filings in this period')}

EARNINGS CALENDAR (confirmed scheduled dates from Finnhub):
{section(earnings_lines, 'No earnings in the next 21 days')}

ANALYST CONSENSUS (real aggregate data — use to contextualize positioning):
{section(analyst_lines, 'No analyst data available')}

INSIDER TRANSACTIONS (Form 4 filings, last 14 days):
{section(insider_lines, 'None in the past 14 days')}

SHORT SALE VOLUME (FINRA, prior session — >55% elevated, <38% possible covering):
{section(short_lines, 'No short volume data available')}{focus_section}

---

Write 4–6 briefing items covering the most important developments. Apply every rule from your instructions. Prioritize by impact on this specific portfolio. Use all data provided above — do not ignore any section that has real content.

Start immediately with "1." — no preamble, no disclaimers."""


def generate_morning_briefing(
    advisor_name: str,
    firm_name: str,
    holdings: list[dict],
    days_back_filings: int = 1,
    briefing_focus: str = None,
) -> str:
    tickers = [h["ticker"] for h in holdings]

    with ThreadPoolExecutor(max_workers=8) as executor:
        market_future    = executor.submit(get_portfolio_market_data, tickers)
        filings_future   = executor.submit(get_new_filings_for_portfolio, tickers, days_back=days_back_filings)
        insider_future   = executor.submit(get_insider_transactions, tickers, 14)
        fh_news_future   = executor.submit(get_all_company_news, tickers, 3)
        macro_future     = executor.submit(get_market_news)
        earnings_future  = executor.submit(get_earnings_calendar, tickers, 21)
        analyst_future   = executor.submit(get_analyst_data, tickers)
        macro_idx_future = executor.submit(get_prices_batch, MACRO_TICKERS)
        short_vol_future = executor.submit(get_short_volume, tickers)

        def safe(future, timeout, default):
            try:
                return future.result(timeout=timeout)
            except Exception:
                return default

        market_data    = safe(market_future,    45, {})
        filings        = safe(filings_future,   45, [])
        insiders       = safe(insider_future,   60, {})
        finnhub_news   = safe(fh_news_future,   30, {})
        macro_news     = safe(macro_future,     15, [])
        earnings_cal   = safe(earnings_future,  15, {})
        analyst_data   = safe(analyst_future,   30, {})
        macro_indices  = safe(macro_idx_future, 30, {})
        short_volume   = safe(short_vol_future, 30, {})

    user_message = _build_user_message(
        advisor_name, firm_name, holdings, market_data, filings,
        insiders, finnhub_news, macro_news, earnings_cal, analyst_data,
        macro_indices, short_volume, briefing_focus,
    )

    response = _get_client().messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
        timeout=120,
    )

    return response.content[0].text


def generate_and_save_briefing(advisor_id: int, flask_app) -> dict:
    """Generate a briefing for an advisor and persist it to the database."""
    from models import db, Advisor, Holding, Briefing

    with flask_app.app_context():
        advisor = db.session.get(Advisor, advisor_id)
        if not advisor:
            raise ValueError(f"Advisor {advisor_id} not found")

        holdings = Holding.query.filter_by(advisor_id=advisor_id).all()
        if not holdings:
            raise ValueError(f"Advisor {advisor_id} has no holdings")

        holdings_data = [
            {
                "ticker":        h.ticker,
                "position_size": float(h.position_size),
                "shares":        float(h.shares) if h.shares is not None else None,
                "notes":         h.notes,
                "client_tag":    h.client_tag,
            }
            for h in holdings
        ]

        content = generate_morning_briefing(
            advisor.name, advisor.firm_name, holdings_data,
            briefing_focus=advisor.briefing_focus,
        )

        briefing = Briefing(
            advisor_id=advisor_id,
            content=content,
            generated_at=datetime.now(timezone.utc),
            delivered=False,
        )
        db.session.add(briefing)
        db.session.commit()

        return briefing.to_dict()
