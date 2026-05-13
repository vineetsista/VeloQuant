import os
from datetime import datetime, timezone, date

import anthropic

from data.edgar import get_new_filings_for_portfolio

_client = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    return _client


SYSTEM_PROMPT = """You are a forensic equity analyst specializing in SEC filing analysis. Your job is to read regulatory filings and surface the 2-3 sentences that a busy portfolio manager would miss but should not.

You focus exclusively on information that is:
- Materially different from what was disclosed in the prior filing
- Buried in footnotes, legal proceedings, risk factors, or management discussion sections
- Related to: forward guidance changes, revenue or margin signals, new risk factors, litigation exposure, related-party transactions, inventory or supply chain signals, executive compensation changes that signal confidence or concern, or capital allocation shifts

You do not summarize what the filing is about. You extract the specific signal that matters for someone holding this stock. If there is no material new signal in the filing, you say so directly in one sentence. You never pad, speculate, or add generic commentary. Every word you write must be directly sourced from the filing text provided."""


def _build_analysis_prompt(ticker: str, company_name: str, form_type: str, filing_date: str, filing_text: str) -> str:
    return f"""Analyze this SEC filing and extract only what materially matters for an investor holding {ticker}.

COMPANY: {company_name}
TICKER: {ticker}
FILING TYPE: {form_type}
FILING DATE: {filing_date}

FILING TEXT:
{filing_text}

---

Extract the 2-3 most important sentences from this filing that:
1. Represent new, material information not already priced in or widely reported
2. Come from a specific section of the document (cite where: e.g., "In the Risk Factors section...", "In Note 7 to the financial statements...", "In the MD&A section...")
3. Have a clear implication for the investment thesis on {ticker}

Focus especially on: guidance language changes, litigation updates with dollar amounts, new or modified risk factors, inventory or margin signals, related-party transactions, and any language in the forward-looking statements that differs from prior filings.

If there is no material new signal in this filing, respond with exactly: "No material new signal in this {form_type} beyond standard disclosures."

Output only the insight — 2-3 sentences maximum. No preamble, no sign-off."""


def analyze_filing(ticker: str, company_name: str, form_type: str, filing_date: str, filing_text: str) -> str:
    """Run a single filing through Claude and return the key insight."""
    prompt = _build_analysis_prompt(ticker, company_name, form_type, filing_date, filing_text)

    response = _get_client().messages.create(
        model="claude-sonnet-4-6",
        max_tokens=400,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    return response.content[0].text.strip()


def scan_and_analyze_filings(advisor_id: int, flask_app, days_back: int = 7) -> list[dict]:
    """
    Fetch recent filings for all of an advisor's holdings, analyze each one,
    and save new FilingAlerts to the database. Returns the list of new alerts created.
    """
    from models import db, Advisor, Holding, FilingAlert

    with flask_app.app_context():
        advisor = db.session.get(Advisor, advisor_id)
        if not advisor:
            raise ValueError(f"Advisor {advisor_id} not found")

        holdings = Holding.query.filter_by(advisor_id=advisor_id).all()
        if not holdings:
            return []

        tickers = [h.ticker for h in holdings]
        filings = get_new_filings_for_portfolio(tickers, days_back=days_back)

        new_alerts = []
        for filing in filings:
            if not filing.get("text") or "error" in filing:
                continue

            ticker = filing["ticker"]
            form_type = filing["form"]
            filing_date_str = filing["filing_date"]

            # Parse filing date
            try:
                filing_date = datetime.strptime(filing_date_str, "%Y-%m-%d").date()
            except ValueError:
                continue

            # Skip if we already have an alert for this filing
            existing = FilingAlert.query.filter_by(
                advisor_id=advisor_id,
                ticker=ticker,
                filing_type=form_type,
                filing_date=filing_date,
            ).first()
            if existing:
                continue

            # Analyze the filing
            try:
                insight = analyze_filing(
                    ticker=ticker,
                    company_name=filing.get("company_name", ticker),
                    form_type=form_type,
                    filing_date=filing_date_str,
                    filing_text=filing["text"],
                )
            except Exception as e:
                insight = f"Analysis failed: {e}"

            alert = FilingAlert(
                advisor_id=advisor_id,
                ticker=ticker,
                filing_type=form_type,
                filing_date=filing_date,
                key_insight=insight,
                read=False,
            )
            db.session.add(alert)
            new_alerts.append(alert)

        db.session.commit()
        return [a.to_dict() for a in new_alerts]
