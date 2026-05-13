import os
from datetime import datetime, timezone

import anthropic

_client = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    return _client


SYSTEM_PROMPT = """You are a financial advisor writing a brief, reassuring email to a wealthy client. Your client is intelligent and successful but is not a finance professional — they do not know what net interest income or duration exposure means. They trust you to manage their money and they want to feel informed, not lectured.

Your emails are known for three things:
1. Plain English — no jargon, no financial acronyms, no ticker symbols in the body
2. Brevity — the client should be able to read and understand this in 60 seconds
3. Calm confidence — you are not panicking, you are not overselling, you are informing them of something relevant and telling them what you are watching

You never use phrases like "volatility," "headwinds," "macro environment," "risk-off," or any other finance speak. You write like a trusted advisor talking to a smart friend who happens to own this stock.

Format:
Subject: [one clear sentence, no jargon]

[2-3 short paragraphs]
[sign-off placeholder: Best regards, [Advisor Name]]"""


def generate_client_email(
    advisor_name: str,
    firm_name: str,
    ticker: str,
    company_name: str,
    trigger_event: str,
    position_size: float,
) -> str:
    """
    Generate a draft client email for a specific market event affecting a holding.
    Returns the full email text including subject line.
    """
    prompt = f"""Write a draft client email about the following event affecting their portfolio.

ADVISOR: {advisor_name}, {firm_name}
COMPANY: {company_name} (the client knows it as "{company_name}", do not use the ticker symbol)
CLIENT'S POSITION VALUE: approximately ${position_size:,.0f}
DATE: {datetime.now().strftime("%B %d, %Y")}

WHAT HAPPENED:
{trigger_event}

---

Write the email. Requirements:
- Subject line must be specific and plain-English (e.g. "Update on your Apple investment" not "Portfolio Alert")
- First paragraph: what happened, in plain English, one sentence maximum
- Second paragraph: what this means for their specific holding — be direct about whether this is concerning, positive, or neutral, and why
- Third paragraph (optional, only if relevant): what you are monitoring or what action if any is being considered — keep this brief and confident, not alarming
- Sign off with: Best regards, {advisor_name}
- Total length: under 150 words
- Zero financial jargon

Output the subject line first, then the email body."""

    response = _get_client().messages.create(
        model="claude-sonnet-4-6",
        max_tokens=500,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    return response.content[0].text.strip()


def generate_and_save_email(advisor_id: int, ticker: str, trigger_event: str, flask_app) -> dict:
    """Generate a client email draft and save it to the database."""
    from models import db, Advisor, Holding, ClientEmail

    with flask_app.app_context():
        advisor = db.session.get(Advisor, advisor_id)
        if not advisor:
            raise ValueError(f"Advisor {advisor_id} not found")

        holding = Holding.query.filter_by(advisor_id=advisor_id, ticker=ticker.upper()).first()
        if not holding:
            raise ValueError(f"No holding found for {ticker} under advisor {advisor_id}")

        # Use ticker as company name fallback — frontend can pass real name
        company_name = ticker.upper()

        draft = generate_client_email(
            advisor_name=advisor.name,
            firm_name=advisor.firm_name,
            ticker=ticker,
            company_name=company_name,
            trigger_event=trigger_event,
            position_size=float(holding.position_size),
        )

        email = ClientEmail(
            advisor_id=advisor_id,
            ticker=ticker.upper(),
            trigger_event=trigger_event,
            draft_content=draft,
            sent=False,
            created_at=datetime.now(timezone.utc),
        )
        db.session.add(email)
        db.session.commit()

        return email.to_dict()
