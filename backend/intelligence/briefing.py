import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import anthropic

from data.polygon import get_portfolio_market_data, get_upcoming_earnings
from data.edgar import get_new_filings_for_portfolio

_client = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    return _client


SYSTEM_PROMPT = """You are a senior buy-side equity research analyst with 20 years of experience at top-tier investment firms. You prepare pre-market morning briefings for independent financial advisors managing portfolios for wealthy families.

Your briefings are surgical. You identify only what actually matters for the specific portfolio in front of you, explain the precise investment thesis implication, and flag what to monitor. You never write generic market commentary — every item must be tied to a specific holding with a clear explanation of the mechanism.

Your voice is direct, precise, and professional. Not a news summary. Not a chatbot. Not a financial blog. You write for someone who already understands markets and needs signal, not background.

Here is the exact voice and format you produce — study this example and match it:

"Three things that matter for your portfolio this morning: First, JPMorgan reported earnings beating estimates by 4% — the key detail for your position is that net interest income guidance came in above consensus, which directly supports the rate-sensitivity thesis you are running on this name. Second, a new 8-K from Johnson & Johnson filed yesterday contains a litigation update buried on page 12 representing a potential $2B liability that has not appeared in this morning's analyst coverage — worth reviewing before client conversations today. Third, the 10-year yield moved +8 basis points overnight on stronger-than-expected jobs data — this matters specifically for your BRK.B position because Berkshire's insurance float generates meaningful fixed income, and the duration profile of that float becomes more valuable as rates reprice higher."

That specificity. That mechanism. That portfolio-awareness. Nothing generic. Nothing that could appear in a mass-market newsletter."""


def _build_user_message(
    advisor_name: str,
    firm_name: str,
    holdings: list[dict],
    market_data: dict,
    filings: list[dict],
    earnings: dict = None,
    briefing_focus: str = None,
) -> str:
    holdings_lines_parts = []
    for h in holdings:
        line = f"  - {h['ticker']}: ${float(h['position_size']):,.0f} cost basis"
        if h.get('shares'):
            line += f" · {float(h['shares']):,.2f} shares"
        if h.get('client_tag'):
            line += f" · Client: {h['client_tag']}"
        if h.get('notes'):
            line += f"\n    Advisor note: {h['notes']}"
        holdings_lines_parts.append(line)
    holdings_lines = "\n".join(holdings_lines_parts)

    price_lines = []
    news_lines = []
    for ticker, data in market_data.items():
        price = data.get("price", {})
        if "error" not in price:
            pct = price.get("pct_change")
            close = price.get("close")
            prior = price.get("prior_close")
            pct_str = f"{pct:+.2f}%" if pct is not None else "N/A"
            price_lines.append(
                f"  - {ticker}: closed at ${close} ({pct_str} vs prior close ${prior})"
            )
        for article in data.get("news", [])[:3]:
            title = article.get("title", "")
            pub = (article.get("published_utc") or "")[:10]
            publisher = article.get("publisher", "")
            desc = article.get("description", "")
            if title:
                news_lines.append(f"  - [{ticker}] \"{title}\" — {desc[:150] if desc else ''} ({publisher}, {pub})")

    filing_lines = []
    for f in filings:
        if not f.get("text"):
            continue
        # Pass a meaningful excerpt: first 1000 chars captures MD&A/risk factor signal
        excerpt = f["text"][:1000].replace("\n", " ").strip()
        filing_lines.append(
            f"  - [{f['ticker']}] {f.get('company_name', f['ticker'])} — "
            f"{f['form']} filed {f['filing_date']}\n    Excerpt: {excerpt}..."
        )

    earnings_lines = []
    if earnings:
        held = {h["ticker"].upper() for h in holdings}
        for ticker, e in earnings.items():
            if ticker in held and e.get("days_out") is not None and e["days_out"] <= 14:
                d = e["days_out"]
                label = "today (est.)" if d <= 0 else ("tomorrow (est.)" if d == 1 else f"in {d} days (est. {e['next_est']})")
                earnings_lines.append(f"  - {ticker}: reports earnings {label}")

    prices_section = "\n".join(price_lines) if price_lines else "  No price data available"
    news_section = "\n".join(news_lines) if news_lines else "  No recent news"
    filings_section = "\n".join(filing_lines) if filing_lines else "  No new SEC filings in this period"
    earnings_section = "\n".join(earnings_lines) if earnings_lines else "  None within 14 days"

    focus_section = f"\nADVISOR FOCUS FOR TODAY:\n{briefing_focus}\n" if briefing_focus and briefing_focus.strip() else ""

    return f"""Prepare a morning briefing for the following advisor and portfolio.

ADVISOR: {advisor_name}
FIRM: {firm_name}
DATE: {datetime.now().strftime("%A, %B %d, %Y")}

HOLDINGS:
{holdings_lines}

OVERNIGHT PRICE MOVEMENTS:
{prices_section}

RECENT NEWS (last 48 hours):
{news_section}

RECENT SEC FILINGS:
{filings_section}

UPCOMING EARNINGS (within 14 days):
{earnings_section}{focus_section}
---

Write 3-5 briefing items. Hard rules:
1. Every item must reference a specific ticker from this portfolio by name
2. Every item must state the direct implication for THAT position — not the company in general, not the sector, this specific holding
3. For any macro item (rates, Fed, macro data), you must explicitly name the holding and explain the exact transmission mechanism
4. For SEC filings, pull specific content from the excerpt above — reference actual numbers, specific sections, or buried details a busy advisor would miss
5. If live price or news data is unavailable for a holding, write a thesis-driven item: state the current investment thesis for that position, identify the single most important data point or catalyst to monitor this week, and explain exactly why it matters for that holding. This is still high-value signal — never skip a holding just because live data is missing.
6. Format each item exactly as follows — ticker name, em dash, then a 6-10 word headline that captures the specific signal, then a blank line, then 2-4 sentences of analysis:

   1. TICKER — Headline capturing the specific signal here

   Analysis paragraph tied directly to the investment thesis for that position.

7. End with exactly this format on its own line: "Overall portfolio tone: [CONSTRUCTIVE / CAUTIOUS / MIXED] — [one sentence naming the specific holdings and reason driving the tone]"

Start your response immediately with "1." — no preamble, no data disclaimers, no sign-off."""


def generate_morning_briefing(
    advisor_name: str,
    firm_name: str,
    holdings: list[dict],
    days_back_filings: int = 1,
    briefing_focus: str = None,
) -> str:
    """
    Gather market data + filings for the portfolio, then generate a briefing via Claude.
    holdings: list of dicts with keys 'ticker' and 'position_size'
    """
    tickers = [h["ticker"] for h in holdings]

    with ThreadPoolExecutor(max_workers=3) as executor:
        market_future = executor.submit(get_portfolio_market_data, tickers)
        filings_future = executor.submit(get_new_filings_for_portfolio, tickers, days_back=days_back_filings)
        earnings_future = executor.submit(get_upcoming_earnings, tickers)
        try:
            market_data = market_future.result(timeout=25)
        except Exception:
            market_data = {}
        try:
            filings = filings_future.result(timeout=25)
        except Exception:
            filings = []
        try:
            earnings = earnings_future.result(timeout=300)
        except Exception:
            earnings = {}

    user_message = _build_user_message(advisor_name, firm_name, holdings, market_data, filings, earnings, briefing_focus)

    response = _get_client().messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
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
                "ticker": h.ticker,
                "position_size": float(h.position_size),
                "shares": float(h.shares) if h.shares is not None else None,
                "notes": h.notes,
                "client_tag": h.client_tag,
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
