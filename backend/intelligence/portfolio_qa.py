"""Conversational portfolio Q&A — natural-language questions answered against
the advisor's live holdings, market data, recent filings, and briefing history.

Designed to feel like talking to a junior analyst with full context on the book.
"""

import os
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor

import anthropic

from data.polygon import get_portfolio_market_data
from data.edgar import get_new_filings_for_portfolio
from data.finnhub import get_all_company_news, get_earnings_calendar, get_analyst_data

_client = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    return _client


QA_SYSTEM = """You are the chief analyst at the advisor's family office. You have full
context on the advisor's holdings, recent SEC filings, news, earnings calendar, and
the most recent morning briefing. Answer the advisor's question with the same
precision and concision as a Goldman analyst call note.

RULES (non-negotiable):
1. Every numerical claim must come from the data provided. If you don't have the
   data, say so explicitly — never fabricate.
2. Lead with the answer, then the supporting data. Advisors do not have time for
   preamble.
3. Use specific numbers, not adjectives. "+8.2%" not "strong gains".
4. If the answer requires a comparison the data doesn't support, say what's
   missing and how the advisor could get it.
5. When relevant, name the specific tickers in the advisor's book and connect
   the answer to those positions.
6. Format: short paragraphs, bullets where it improves scannability. Never long
   walls of text. Aim for 80–200 words unless the question demands more.
7. If the question is outside scope (general market news, individual security
   recommendations, tax/legal advice), say so politely and suggest a reframing
   that does fit your scope.

ABSOLUTE PROHIBITIONS:
— No investment advice. You analyze; the advisor decides.
— No fabricated quotes, ratings, or events not in the data.
— No "may/could/might" hedging when the data supports a direct read.
— No marketing language ("powerful", "robust", "leading"). Just the facts.

Start the response immediately. No "Great question!", no preamble."""


def _format_holdings(holdings: list[dict], market_data: dict) -> str:
    if not holdings:
        return "No holdings in portfolio."
    lines = []
    for h in holdings:
        t = h["ticker"]
        size = h.get("position_size", 0)
        md = market_data.get(t, {}).get("price", {}) if isinstance(market_data.get(t), dict) else {}
        close = md.get("close")
        pct = md.get("pct_change")
        bits = [f"{t}: ${size:,.0f}"]
        if close is not None:
            bits.append(f"px=${close:.2f}")
        if pct is not None:
            bits.append(f"day={pct:+.2f}%")
        if h.get("client_tag"):
            bits.append(f"client={h['client_tag']}")
        if h.get("notes"):
            note = h["notes"][:80]
            bits.append(f"note=\"{note}\"")
        lines.append("  · " + ", ".join(bits))
    return "\n".join(lines)


def _format_filings(filings: list[dict]) -> str:
    if not filings:
        return "No recent SEC filings in the last 7 days."
    out = []
    for f in filings[:15]:
        out.append(f"  · {f.get('ticker', '?')} {f.get('form', '?')} filed {f.get('filing_date', '?')}: {(f.get('headline') or '')[:120]}")
    return "\n".join(out)


def _format_news(news_by_ticker: dict) -> str:
    if not news_by_ticker:
        return "No recent news pulled."
    out = []
    for tkr, items in news_by_ticker.items():
        if not items:
            continue
        out.append(f"  {tkr}:")
        for n in items[:3]:
            headline = (n.get("headline") or "")[:140]
            out.append(f"    · {headline}")
    return "\n".join(out) or "No news items available."


def _format_earnings(earnings: dict) -> str:
    if not earnings:
        return "No upcoming earnings in the next 21 days."
    out = []
    for tkr, evt in earnings.items():
        if not evt:
            continue
        date = evt.get("date", "?")
        days = evt.get("days_out", "?")
        est = evt.get("eps_estimate")
        out.append(f"  · {tkr}: {date} ({days}d out)" + (f", consensus EPS ${est}" if est else ""))
    return "\n".join(out) or "No earnings scheduled."


def _format_analyst(analyst: dict) -> str:
    if not analyst:
        return "No analyst consensus data."
    out = []
    for tkr, a in analyst.items():
        if not a:
            continue
        buy = a.get("buy", 0) or 0
        hold = a.get("hold", 0) or 0
        sell = a.get("sell", 0) or 0
        target = a.get("target_mean")
        out.append(f"  · {tkr}: {buy}B / {hold}H / {sell}S" + (f", consensus target ${target:.2f}" if target else ""))
    return "\n".join(out) or "No analyst data."


def answer_question(
    *,
    question: str,
    advisor_name: str,
    firm_name: str,
    holdings: list[dict],
    latest_briefing: str | None = None,
    history: list[dict] | None = None,
) -> str:
    """Answer a single advisor question with full portfolio context.

    history is an optional list of {role, content} from prior turns of the same
    conversation — Claude will use them for follow-up coherence.
    """
    tickers = [h["ticker"] for h in holdings]
    if not tickers:
        return "You don't have any holdings yet. Add positions in the Holdings tab and I'll be able to answer questions about your book."

    with ThreadPoolExecutor(max_workers=5) as executor:
        market_future   = executor.submit(get_portfolio_market_data, tickers)
        filings_future  = executor.submit(get_new_filings_for_portfolio, tickers, days_back=7)
        news_future     = executor.submit(get_all_company_news, tickers, 3)
        earnings_future = executor.submit(get_earnings_calendar, tickers, 21)
        analyst_future  = executor.submit(get_analyst_data, tickers)

        def safe(future, timeout, default):
            try:
                return future.result(timeout=timeout)
            except Exception:
                return default

        market_data   = safe(market_future,   30, {})
        filings       = safe(filings_future,  30, [])
        news          = safe(news_future,     20, {})
        earnings      = safe(earnings_future, 15, {})
        analyst       = safe(analyst_future,  20, {})

    today = datetime.now(timezone.utc).strftime("%A, %B %d, %Y")
    context = f"""ADVISOR: {advisor_name} at {firm_name}
DATE: {today}

PORTFOLIO HOLDINGS:
{_format_holdings(holdings, market_data)}

RECENT SEC FILINGS (last 7 days):
{_format_filings(filings)}

RECENT NEWS BY TICKER (last 3 days):
{_format_news(news)}

UPCOMING EARNINGS (next 21 days):
{_format_earnings(earnings)}

CURRENT ANALYST CONSENSUS:
{_format_analyst(analyst)}

LATEST MORNING BRIEFING:
{latest_briefing[:4000] if latest_briefing else "No briefing generated yet today."}

ADVISOR'S QUESTION:
{question}
"""

    messages = []
    if history:
        for turn in history[-6:]:  # keep last 3 turns
            role = turn.get("role")
            text = turn.get("content", "")
            if role in ("user", "assistant") and text:
                messages.append({"role": role, "content": text})
    messages.append({"role": "user", "content": context})

    response = _get_client().messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        system=QA_SYSTEM,
        messages=messages,
        timeout=60,
    )
    return response.content[0].text


WEEKLY_SYSTEM = """You write the Friday executive wrap for an independent
wealth advisor. The advisor reads this with their afternoon coffee at 4:15pm
ET; clients are emailing them tonight and over the weekend.

THE PURPOSE: Give the advisor (a) a precise summary of what happened in their
book this week, (b) the key events they should be prepared for next week, and
(c) two to three plain-English talking points they can use over the weekend.

STRUCTURE (use exactly these section headers in CAPS, separated by blank lines):

THIS WEEK IN YOUR BOOK
[2–3 sentences naming the specific holdings that drove performance up or down,
with the magnitude in percent and dollars where available. End with a one-line
verdict: was this a constructive week, a cautious one, or mixed.]

WHAT MOVED THE NEEDLE
[Bulleted list — 3 to 5 items — of the most material events. Each bullet starts
with "•", names the ticker, gives a one-line specific finding (filing,
earnings beat/miss, analyst move, insider transaction). Include numbers, not
adjectives.]

NEXT WEEK'S CATALYSTS
[Bulleted list — 3 to 4 items — of upcoming earnings, dividends, ex-dates, or
known events for the portfolio in the next 5 trading days. Always include the
date.]

WEEKEND CLIENT TALKING POINTS
[2–3 short paragraphs the advisor could paste into an email or use over a
phone call. Plain English, no jargon, no hedge language. Reference specific
holdings the client owns.]

RULES:
— Numbers must come from the data provided. Never fabricate.
— No general market commentary. Only what affects this book.
— No marketing adjectives. Just observation and mechanism.
— No "I" voice. Use "your portfolio" / "your positions".
"""


def weekly_summary(
    *,
    advisor_name: str,
    firm_name: str,
    holdings: list[dict],
    week_briefings: list[str] | None = None,
    snapshots: list[dict] | None = None,
) -> str:
    """Generate the Friday executive wrap email body."""
    tickers = [h["ticker"] for h in holdings]
    if not tickers:
        return "No holdings — cannot generate weekly summary."

    with ThreadPoolExecutor(max_workers=4) as executor:
        market_future   = executor.submit(get_portfolio_market_data, tickers)
        filings_future  = executor.submit(get_new_filings_for_portfolio, tickers, days_back=5)
        earnings_future = executor.submit(get_earnings_calendar, tickers, 7)
        analyst_future  = executor.submit(get_analyst_data, tickers)

        def safe(future, timeout, default):
            try:
                return future.result(timeout=timeout)
            except Exception:
                return default

        market_data = safe(market_future,   30, {})
        filings     = safe(filings_future,  30, [])
        earnings    = safe(earnings_future, 15, {})
        analyst     = safe(analyst_future,  20, {})

    week_perf = ""
    if snapshots and len(snapshots) >= 2:
        first = snapshots[0].get("total_value", 0)
        last  = snapshots[-1].get("total_value", 0)
        if first > 0:
            delta_dollar = last - first
            delta_pct = (delta_dollar / first) * 100
            week_perf = f"Portfolio value moved from ${first:,.0f} to ${last:,.0f} this week ({delta_pct:+.2f}%, {delta_dollar:+,.0f} dollars)."

    today = datetime.now(timezone.utc).strftime("%A, %B %d, %Y")
    briefing_context = ""
    if week_briefings:
        briefing_context = "\n\nBRIEFINGS GENERATED THIS WEEK (most recent first):\n"
        for b in week_briefings[:3]:
            briefing_context += b[:2500] + "\n\n---\n\n"

    context = f"""ADVISOR: {advisor_name} at {firm_name}
DATE: {today} (end-of-week wrap)

PORTFOLIO PERFORMANCE THIS WEEK:
{week_perf or "Insufficient snapshot data for week-over-week comparison."}

CURRENT HOLDINGS:
{_format_holdings(holdings, market_data)}

SEC FILINGS THIS WEEK:
{_format_filings(filings)}

EARNINGS IN THE NEXT 7 DAYS:
{_format_earnings(earnings)}

ANALYST CONSENSUS SNAPSHOT:
{_format_analyst(analyst)}
{briefing_context}

Write the Friday executive wrap per the format above. Start immediately with
"THIS WEEK IN YOUR BOOK" — no preamble.
"""

    response = _get_client().messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2500,
        system=WEEKLY_SYSTEM,
        messages=[{"role": "user", "content": context}],
        timeout=90,
    )
    return response.content[0].text


DEEP_DIVE_SYSTEM = """You are writing a one-page analyst memo on a single equity
for an independent wealth advisor. The advisor is reviewing whether to add to,
hold, or trim this position. Your memo will be read in three minutes.

STRUCTURE (use exactly these section headers in CAPS, separated by blank lines):

THE POSITION
[One paragraph: current price, day change, market cap context, the advisor's
holding size, and the single most important thing happening with this name right
now.]

RECENT CATALYSTS
[Bulleted list of the 3–5 most material developments in the last 14 days:
filings, earnings, analyst moves, insider activity, news. Each bullet starts
with "•" and includes specific numbers and dates.]

THE NUMBERS
[One paragraph anchoring the position: revenue trajectory, margin trend,
analyst consensus and target, short interest if elevated, upcoming earnings
date. Specific numbers only — no adjectives.]

WHAT TO WATCH
[2–3 bullets: the specific catalysts and risks in the next 30–90 days the
advisor should monitor. Each bullet must be actionable, not vague.]

CLIENT TALKING POINTS
[2–3 plain-English sentences the advisor could use verbatim with a client who
asks about this position today.]

RULES:
— Every number must come from the data provided.
— No hedging language. Commit to a read.
— No general advice ("review your asset allocation"). Be specific to this name.
— No marketing adjectives. Just data and mechanism.
"""


def deep_dive(
    *,
    ticker: str,
    advisor_name: str,
    holding: dict | None = None,
) -> str:
    """Generate a one-page analyst memo on a single equity."""
    ticker = ticker.upper().strip()

    with ThreadPoolExecutor(max_workers=5) as executor:
        market_future   = executor.submit(get_portfolio_market_data, [ticker])
        filings_future  = executor.submit(get_new_filings_for_portfolio, [ticker], days_back=14)
        news_future     = executor.submit(get_all_company_news, [ticker], 7)
        earnings_future = executor.submit(get_earnings_calendar, [ticker], 60)
        analyst_future  = executor.submit(get_analyst_data, [ticker])

        def safe(future, timeout, default):
            try:
                return future.result(timeout=timeout)
            except Exception:
                return default

        market_data = safe(market_future,   30, {})
        filings     = safe(filings_future,  30, [])
        news        = safe(news_future,     20, {})
        earnings    = safe(earnings_future, 15, {})
        analyst     = safe(analyst_future,  20, {})

    md = market_data.get(ticker, {}).get("price", {}) if isinstance(market_data.get(ticker), dict) else {}
    holding_line = ""
    if holding:
        size = holding.get("position_size", 0)
        shares = holding.get("shares")
        client = holding.get("client_tag")
        bits = [f"Position size: ${size:,.0f}"]
        if shares is not None:
            bits.append(f"{shares} shares")
        if client:
            bits.append(f"Client tag: {client}")
        holding_line = " | ".join(bits)

    today = datetime.now(timezone.utc).strftime("%A, %B %d, %Y")
    context = f"""TICKER: {ticker}
ADVISOR: {advisor_name}
DATE: {today}

MARKET SNAPSHOT:
  Price: ${md.get('close', 'n/a')} ({md.get('pct_change', 0):+.2f}% today)
  {holding_line}

RECENT SEC FILINGS (last 14 days):
{_format_filings(filings)}

RECENT NEWS (last 7 days):
{_format_news(news)}

UPCOMING EARNINGS:
{_format_earnings(earnings)}

ANALYST CONSENSUS:
{_format_analyst(analyst)}

Write the one-page deep-dive memo on {ticker} per the format above. Start
immediately with "THE POSITION" — no preamble.
"""

    response = _get_client().messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        system=DEEP_DIVE_SYSTEM,
        messages=[{"role": "user", "content": context}],
        timeout=90,
    )
    return response.content[0].text
