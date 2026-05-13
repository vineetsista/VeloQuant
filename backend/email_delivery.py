import os
import re
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def _briefing_to_html(briefing_content: str, advisor_name: str, firm_name: str, unsubscribe_url: str = "") -> str:
    """Convert plain-text briefing into a styled HTML email."""
    today = datetime.now(timezone.utc).strftime("%A, %B %d, %Y").replace(" 0", " ")

    paragraphs = [p.strip() for p in briefing_content.strip().split("\n\n") if p.strip()]
    blocks_html = []
    i = 0

    while i < len(paragraphs):
        para = paragraphs[i]

        # Section header — ALL CAPS line under 60 chars, no digits
        if re.match(r'^[A-Z][A-Z\s&:/–-]{4,}$', para) and len(para) < 60 and not re.search(r'\d', para):
            blocks_html.append(f"""
            <tr>
              <td style="padding: 24px 0 10px 0; border-bottom: 1px solid #e2e8f0;">
                <div style="
                  font-size: 10px; font-weight: 700; letter-spacing: 0.16em;
                  text-transform: uppercase; color: #4f7cf6;
                  font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
                ">{para}</div>
              </td>
            </tr>""")
            i += 1
            continue

        # Portfolio tone line
        tone_match = re.match(r'^overall portfolio tone:\s*(constructive|cautious|mixed)\s+[—–-]+\s+(.+)', para, re.IGNORECASE)
        if tone_match:
            level = tone_match.group(1).upper()
            detail = tone_match.group(2)
            tone_color = '#10b981' if level == 'CONSTRUCTIVE' else '#f59e0b' if level == 'CAUTIOUS' else '#4f7cf6'
            blocks_html.append(f"""
            <tr>
              <td style="padding: 8px 0 0 0;">
                <div style="
                  background: #f8fafc; border: 1px solid #e2e8f0;
                  border-left: 3px solid {tone_color};
                  padding: 16px 18px; border-radius: 0 8px 8px 0; margin-top: 8px;
                ">
                  <div style="display: flex; align-items: center; gap: 10; margin-bottom: 8px;">
                    <span style="
                      font-size: 10px; font-weight: 800; letter-spacing: 0.1em;
                      color: #fff; background: {tone_color};
                      padding: 2px 10px; border-radius: 4px;
                      font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
                    ">{level}</span>
                    <span style="font-size: 11px; color: #64748b; font-weight: 600;
                      font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
                      margin-left: 8px; text-transform: uppercase; letter-spacing: 0.06em;
                    ">Portfolio Tone</span>
                  </div>
                  <div style="
                    font-size: 14px; line-height: 1.7; color: #334155;
                    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
                  ">{detail}</div>
                </div>
              </td>
            </tr>""")
            i += 1
            continue

        # Structured item: "1. TICKER — Headline"
        structured = re.match(r'^(\d+)\.\s+([A-Z][A-Z./]{0,8})\s+[—–]\s+(.+)', para)
        if structured:
            num = structured.group(1)
            ticker = structured.group(2)
            headline = structured.group(3)
            # Collect body paragraphs that follow (until next numbered item or tone line)
            body_parts = []
            j = i + 1
            while j < len(paragraphs):
                nxt = paragraphs[j].strip()
                if re.match(r'^\d+\.', nxt) or re.match(r'^overall portfolio tone', nxt, re.IGNORECASE):
                    break
                if not re.match(r'^[A-Z][A-Z\s&:/–-]{4,}$', nxt):
                    body_parts.append(nxt.replace('\n', ' '))
                j += 1
            body_html = f'<div style="font-size: 13.5px; line-height: 1.7; color: #334155; font-family: -apple-system, \'Helvetica Neue\', Arial, sans-serif; margin-top: 6px;">{" ".join(body_parts)}</div>' if body_parts else ''
            blocks_html.append(f"""
            <tr>
              <td style="padding: 0 0 20px 0;">
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td width="40" valign="top" style="padding-top: 0;">
                      <div style="
                        width: 28px; height: 28px; border-radius: 50%;
                        background: linear-gradient(135deg, #4f7cf6, #06b6d4);
                        color: white; font-size: 12px; font-weight: 800;
                        text-align: center; line-height: 28px;
                        font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
                      ">{num}</div>
                    </td>
                    <td valign="top">
                      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap;">
                        <span style="
                          display: inline-block;
                          background: rgba(79,124,246,0.1); color: #4f7cf6;
                          font-size: 10px; font-weight: 800; letter-spacing: 0.06em;
                          padding: 2px 8px; border-radius: 4px;
                          font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
                        ">{ticker}</span>
                        <span style="
                          font-size: 14px; font-weight: 700; color: #0f172a; line-height: 1.35;
                          font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
                        ">{headline}</span>
                      </div>
                      {body_html}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>""")
            i = j
            continue

        # Old-style plain numbered item
        numbered = re.match(r'^(\d+)\.\s+(.+)$', para, re.DOTALL)
        if numbered:
            num = numbered.group(1)
            text = numbered.group(2).replace('\n', ' ')
            blocks_html.append(f"""
            <tr>
              <td style="padding: 0 0 16px 0;">
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td width="40" valign="top">
                      <div style="
                        width: 28px; height: 28px; border-radius: 50%;
                        background: linear-gradient(135deg, #4f7cf6, #06b6d4);
                        color: white; font-size: 12px; font-weight: 800;
                        text-align: center; line-height: 28px;
                        font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
                      ">{num}</div>
                    </td>
                    <td style="
                      font-size: 14px; line-height: 1.65; color: #334155;
                      font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
                    ">{text}</td>
                  </tr>
                </table>
              </td>
            </tr>""")
            i += 1
            continue

        # Lead / generic paragraph
        blocks_html.append(f"""
            <tr>
              <td style="padding: 0 0 14px 0;">
                <p style="
                  margin: 0; font-size: 14px; line-height: 1.65; color: #475569;
                  font-style: italic;
                  font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
                ">{para.replace(chr(10), ' ')}</p>
              </td>
            </tr>""")
        i += 1

    items_html = "\n".join(blocks_html)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Morning Briefing — {today}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9;">

<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f1f5f9;">
  <tr>
    <td align="center" style="padding: 32px 16px;">

      <!-- Card -->
      <table cellpadding="0" cellspacing="0" border="0" width="600"
             style="max-width: 600px; background: #ffffff; border-radius: 12px;
                    box-shadow: 0 4px 24px rgba(0,0,0,0.08); overflow: hidden;">

        <!-- Header -->
        <tr>
          <td style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); padding: 32px 36px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td>
                  <div style="
                    display: inline-block; width: 36px; height: 36px;
                    background: linear-gradient(135deg, #4f7cf6, #06b6d4);
                    border-radius: 8px; text-align: center; line-height: 36px;
                    font-size: 18px; color: white; font-weight: 900;
                    margin-bottom: 16px;
                  ">◆</div>
                  <div style="
                    font-size: 11px; font-weight: 700; letter-spacing: 0.15em;
                    text-transform: uppercase; color: #94a3b8;
                    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
                    margin-bottom: 6px;
                  ">VeloQuant</div>
                  <div style="
                    font-size: 22px; font-weight: 800; color: #ffffff;
                    letter-spacing: -0.03em; line-height: 1.2;
                    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
                    margin-bottom: 4px;
                  ">Morning Briefing</div>
                  <div style="
                    font-size: 13px; color: #94a3b8;
                    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
                  ">{today} &nbsp;·&nbsp; Prepared for {advisor_name}, {firm_name}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Divider bar -->
        <tr>
          <td style="height: 3px; background: linear-gradient(90deg, #4f7cf6, #06b6d4);"></td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding: 32px 36px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              {items_html}
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="
            background: #f8fafc; border-top: 1px solid #e2e8f0;
            padding: 20px 36px; text-align: center;
          ">
            <p style="
              margin: 0 0 8px; font-size: 11px; color: #94a3b8; line-height: 1.6;
              font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
            ">
              This briefing was generated by VeloQuant and is intended solely for
              {advisor_name} at {firm_name}. Not for distribution.
            </p>
            {f'<p style="margin:0;font-size:11px;color:#94a3b8;font-family:-apple-system,sans-serif;"><a href="{unsubscribe_url}" style="color:#94a3b8;">Unsubscribe from daily briefings</a></p>' if unsubscribe_url else ''}
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>"""


def _send_transactional_email(to_email: str, subject: str, html_body: str) -> bool:
    api_key = os.getenv("SENDGRID_API_KEY")
    from_email = os.getenv("BRIEFING_FROM_EMAIL")
    if not api_key or not from_email:
        logger.warning("SendGrid not configured — skipping transactional email")
        return False
    try:
        import sendgrid
        from sendgrid.helpers.mail import Mail, Email, To, HtmlContent

        message = Mail(
            from_email=Email(from_email, "VeloQuant"),
            to_emails=To(to_email),
            subject=subject,
            html_content=HtmlContent(html_body),
        )
        sg = sendgrid.SendGridAPIClient(api_key=api_key)
        response = sg.send(message)
        return response.status_code in (200, 202)
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False


def send_verification_email(to_email: str, name: str, token: str, app_url: str) -> bool:
    verify_url = f"{app_url}/verify-email?token={token}"
    html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table width="560" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:32px 36px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;">VeloQuant</div>
    <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.03em;margin-bottom:4px;">Verify your email</div>
    <div style="font-size:13px;color:#94a3b8;">One click to activate your account</div>
  </td></tr>
  <tr><td style="height:3px;background:linear-gradient(90deg,#4f7cf6,#06b6d4);"></td></tr>
  <tr><td style="padding:36px;">
    <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 24px;">Hi {name},</p>
    <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 32px;">
      Welcome to VeloQuant. Click the button below to verify your email address and activate your account.
      Your first morning briefing will be ready tomorrow at 7:30am ET.
    </p>
    <div style="text-align:center;margin-bottom:32px;">
      <a href="{verify_url}" style="display:inline-block;background:linear-gradient(135deg,#4f7cf6,#06b6d4);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;letter-spacing:-0.01em;">
        Verify My Email →
      </a>
    </div>
    <p style="font-size:12px;color:#94a3b8;line-height:1.6;margin:0;">
      This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
    </p>
  </td></tr>
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#94a3b8;">VeloQuant · Not investment advice</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>"""
    return _send_transactional_email(
        to_email, "Verify your VeloQuant email", html
    )


def send_password_reset_email(
    to_email: str, name: str, token: str, app_url: str
) -> bool:
    reset_url = f"{app_url}/reset-password?token={token}"
    html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table width="560" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:32px 36px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;">VeloQuant</div>
    <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.03em;margin-bottom:4px;">Reset your password</div>
    <div style="font-size:13px;color:#94a3b8;">Link expires in 1 hour</div>
  </td></tr>
  <tr><td style="height:3px;background:linear-gradient(90deg,#4f7cf6,#06b6d4);"></td></tr>
  <tr><td style="padding:36px;">
    <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 24px;">Hi {name},</p>
    <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 32px;">
      We received a request to reset your password. Click the button below to set a new one.
      This link is valid for 1 hour.
    </p>
    <div style="text-align:center;margin-bottom:32px;">
      <a href="{reset_url}" style="display:inline-block;background:linear-gradient(135deg,#4f7cf6,#06b6d4);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;letter-spacing:-0.01em;">
        Reset My Password →
      </a>
    </div>
    <p style="font-size:12px;color:#94a3b8;line-height:1.6;margin:0;">
      If you didn't request this, you can safely ignore this email. Your password won't change.
    </p>
  </td></tr>
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#94a3b8;">VeloQuant · Not investment advice</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>"""
    return _send_transactional_email(
        to_email, "Reset your VeloQuant password", html
    )


def send_briefing_email(
    advisor_email: str, advisor_name: str, firm_name: str, briefing_content: str,
    unsubscribe_token: str = "", app_url: str = "",
) -> bool:
    """
    Send the morning briefing to the advisor via SendGrid.
    Returns True on success, False if SendGrid is not configured or send fails.
    """
    api_key = os.getenv("SENDGRID_API_KEY")
    from_email = os.getenv("BRIEFING_FROM_EMAIL")

    if not api_key or not from_email:
        logger.warning(
            "SendGrid not configured — skipping email delivery (set SENDGRID_API_KEY and BRIEFING_FROM_EMAIL)"
        )
        return False

    try:
        import sendgrid
        from sendgrid.helpers.mail import Mail, Email, To, Content, HtmlContent

        today = datetime.now(timezone.utc).strftime("%A, %B %d").replace(" 0", " ")
        subject = f"Morning Briefing — {today}"
        unsubscribe_url = f"{app_url}/unsubscribe/{unsubscribe_token}" if unsubscribe_token and app_url else ""
        html_body = _briefing_to_html(briefing_content, advisor_name, firm_name, unsubscribe_url)

        message = Mail(
            from_email=Email(from_email, "VeloQuant"),
            to_emails=To(advisor_email),
            subject=subject,
            html_content=HtmlContent(html_body),
        )

        sg = sendgrid.SendGridAPIClient(api_key=api_key)
        response = sg.send(message)

        if response.status_code in (200, 202):
            logger.info(
                f"Briefing email sent to {advisor_email} (status {response.status_code})"
            )
            return True
        else:
            logger.error(
                f"SendGrid returned status {response.status_code} for {advisor_email}"
            )
            return False

    except Exception as e:
        logger.error(f"Failed to send briefing email to {advisor_email}: {e}")
        return False


def send_welcome_email(to_email: str, name: str, firm_name: str, app_url: str) -> bool:
    html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table width="560" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:32px 36px;">
    <div style="display:inline-block;width:36px;height:36px;background:linear-gradient(135deg,#4f7cf6,#06b6d4);border-radius:8px;text-align:center;line-height:36px;font-size:18px;color:white;font-weight:900;margin-bottom:16px;">◆</div>
    <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;">VeloQuant</div>
    <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.03em;margin-bottom:4px;">Welcome aboard, {name}.</div>
    <div style="font-size:13px;color:#94a3b8;">Your 14-day free trial has started</div>
  </td></tr>
  <tr><td style="height:3px;background:linear-gradient(90deg,#4f7cf6,#06b6d4);"></td></tr>
  <tr><td style="padding:36px;">
    <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 20px;">Hi {name},</p>
    <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 24px;">
      Your VeloQuant account for <strong>{firm_name}</strong> is ready. Here's what happens next:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;">
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#4f7cf6,#06b6d4);color:#fff;font-size:12px;font-weight:800;text-align:center;line-height:28px;flex-shrink:0;">1</div>
          <div style="font-size:14px;color:#334155;line-height:1.6;padding-top:4px;"><strong>Add your holdings</strong> — enter ticker symbols and position sizes to personalize your briefings.</div>
        </div>
      </td></tr>
      <tr><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;">
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#4f7cf6,#06b6d4);color:#fff;font-size:12px;font-weight:800;text-align:center;line-height:28px;flex-shrink:0;">2</div>
          <div style="font-size:14px;color:#334155;line-height:1.6;padding-top:4px;"><strong>Get your first briefing</strong> — click "Generate Briefing" on the dashboard, or wait for tomorrow at 7:30am ET.</div>
        </div>
      </td></tr>
      <tr><td style="padding:12px 0;">
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#4f7cf6,#06b6d4);color:#fff;font-size:12px;font-weight:800;text-align:center;line-height:28px;flex-shrink:0;">3</div>
          <div style="font-size:14px;color:#334155;line-height:1.6;padding-top:4px;"><strong>Monitor SEC filings</strong> — we'll alert you to 10-K, 10-Q, and 8-K filings for every position.</div>
        </div>
      </td></tr>
    </table>
    <div style="text-align:center;margin-bottom:28px;">
      <a href="{app_url}" style="display:inline-block;background:linear-gradient(135deg,#4f7cf6,#06b6d4);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;letter-spacing:-0.01em;">
        Open Your Dashboard →
      </a>
    </div>
    <p style="font-size:12px;color:#94a3b8;line-height:1.6;margin:0;text-align:center;">
      Your 14-day free trial gives you full access. No charge until the trial ends.
    </p>
  </td></tr>
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#94a3b8;">VeloQuant · Not investment advice</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>"""
    return _send_transactional_email(to_email, f"Welcome to VeloQuant, {name}", html)


def send_trial_reminder_email(to_email: str, name: str, days_remaining: int, app_url: str) -> bool:
    if days_remaining == 0:
        urgency = "ending today"
    elif days_remaining == 1:
        urgency = "ending tomorrow"
    else:
        urgency = f"ending in {days_remaining} days"
    cta_color = "#ef4444" if days_remaining <= 1 else "#f59e0b"
    html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table width="560" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:32px 36px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;">VeloQuant</div>
    <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.03em;margin-bottom:4px;">Your trial is {urgency}</div>
    <div style="font-size:13px;color:#94a3b8;">Subscribe to keep your morning briefings</div>
  </td></tr>
  <tr><td style="height:3px;background:linear-gradient(90deg,{cta_color},{cta_color}99);"></td></tr>
  <tr><td style="padding:36px;">
    <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 20px;">Hi {name},</p>
    <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 24px;">
      Your VeloQuant free trial is <strong>{urgency}</strong>.
      After it ends, you'll lose access to your daily morning briefings, SEC filing alerts, and client email drafts.
    </p>
    <div style="background:#fff8f0;border:1px solid {cta_color}33;border-left:3px solid {cta_color};border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:28px;">
      <div style="font-size:13px;font-weight:700;color:{cta_color};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">
        {'⚠ Last chance' if days_remaining <= 1 else 'Trial ending soon'}
      </div>
      <div style="font-size:14px;color:#334155;line-height:1.6;">
        Subscribe now for $299/month and keep your morning intelligence briefings going without interruption.
      </div>
    </div>
    <div style="text-align:center;margin-bottom:28px;">
      <a href="{app_url}/settings" style="display:inline-block;background:linear-gradient(135deg,#4f7cf6,#06b6d4);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;letter-spacing:-0.01em;">
        Subscribe Now →
      </a>
    </div>
    <p style="font-size:12px;color:#94a3b8;line-height:1.6;margin:0;text-align:center;">
      Cancel anytime. No questions asked.
    </p>
  </td></tr>
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#94a3b8;">VeloQuant · Not investment advice</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>"""
    return _send_transactional_email(to_email, f"Your VeloQuant trial is {urgency}", html)


def send_filing_alert_digest_email(
    to_email: str, name: str, firm_name: str, alerts: list, app_url: str
) -> bool:
    count = len(alerts)
    today = datetime.now(timezone.utc).strftime("%A, %B %d").replace(" 0", " ")
    rows_html = ""
    for a in alerts[:10]:  # cap at 10 in email
        filing_type = a.get("filing_type", "")
        ticker = a.get("ticker", "").upper()
        insight = a.get("key_insight", "")
        if len(insight) > 200:
            insight = insight[:197] + "…"
        type_colors = {
            "10-K": "#4f7cf6", "10-Q": "#06b6d4",
            "8-K": "#f59e0b", "DEF 14A": "#10b981",
        }
        color = type_colors.get(filing_type, "#64748b")
        rows_html += f"""
        <tr>
          <td style="padding: 16px 0; border-bottom: 1px solid #f1f5f9;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap;">
              <span style="display:inline-block;background:rgba(79,124,246,0.1);color:#4f7cf6;font-size:10px;font-weight:800;letter-spacing:0.06em;padding:2px 8px;border-radius:4px;font-family:-apple-system,sans-serif;">{ticker}</span>
              <span style="display:inline-block;background:{color}18;color:{color};font-size:10px;font-weight:700;padding:2px 8px;border-radius:12px;font-family:-apple-system,sans-serif;">{filing_type}</span>
            </div>
            <div style="font-size:13px;line-height:1.65;color:#475569;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;">{insight}</div>
          </td>
        </tr>"""
    more = f'<p style="font-size:12px;color:#94a3b8;text-align:center;margin:8px 0 0;">+{count - 10} more alerts in the app</p>' if count > 10 else ""
    html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table width="600" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:32px 36px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;">VeloQuant</div>
    <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.03em;margin-bottom:4px;">{count} new SEC filing{'' if count == 1 else 's'}</div>
    <div style="font-size:13px;color:#94a3b8;">{today} &nbsp;·&nbsp; {firm_name}</div>
  </td></tr>
  <tr><td style="height:3px;background:linear-gradient(90deg,#4f7cf6,#06b6d4);"></td></tr>
  <tr><td style="padding:32px 36px;">
    <p style="font-size:14px;color:#334155;line-height:1.7;margin:0 0 20px;">Hi {name},</p>
    <p style="font-size:14px;color:#334155;line-height:1.7;margin:0 0 24px;">
      New SEC filings were detected for your portfolio holdings today.
    </p>
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      {rows_html}
    </table>
    {more}
    <div style="text-align:center;margin-top:28px;">
      <a href="{app_url}/filing-alerts" style="display:inline-block;background:linear-gradient(135deg,#4f7cf6,#06b6d4);color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px;">
        View All Alerts →
      </a>
    </div>
  </td></tr>
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#94a3b8;">VeloQuant · Not investment advice · <a href="{app_url}/settings" style="color:#94a3b8;">Manage notifications</a></p>
  </td></tr>
</table>
</td></tr></table>
</body></html>"""
    subject = f"{count} new SEC filing{'s' if count != 1 else ''} for your portfolio — {today}"
    return _send_transactional_email(to_email, subject, html)


def send_price_alert_email(to_email: str, name: str, triggered: list, app_url: str) -> bool:
    count = len(triggered)
    tickers = ", ".join(sorted(set(a.get("ticker", "") for a in triggered)))
    rows_html = ""
    for a in triggered:
        ticker = a.get("ticker", "").upper()
        alert_type = a.get("alert_type", "")
        threshold = float(a.get("threshold", 0))
        price = float(a.get("triggered_price", 0)) if a.get("triggered_price") else None
        if alert_type == "above":
            condition = f"Rose above ${threshold:,.2f}"
            price_str = f"${price:,.2f}" if price else "—"
        elif alert_type == "below":
            condition = f"Fell below ${threshold:,.2f}"
            price_str = f"${price:,.2f}" if price else "—"
        else:
            condition = f"Day move exceeded ±{threshold:.1f}%"
            price_str = f"±{price:.2f}%" if price else "—"
        rows_html += f"""
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #f1f5f9;">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <span style="display:inline-block;background:rgba(79,124,246,0.1);color:#4f7cf6;font-size:11px;font-weight:800;letter-spacing:0.06em;padding:3px 10px;border-radius:4px;font-family:-apple-system,sans-serif;">{ticker}</span>
              <span style="font-size:13px;font-weight:600;color:#334155;font-family:-apple-system,sans-serif;">{condition}</span>
              <span style="font-size:13px;color:#10d97b;font-weight:700;font-family:-apple-system,sans-serif;margin-left:auto;">{price_str}</span>
            </div>
          </td>
        </tr>"""
    html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table width="600" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:32px 36px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;">VeloQuant</div>
    <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.03em;margin-bottom:4px;">Price alert{'s' if count != 1 else ''} triggered</div>
    <div style="font-size:13px;color:#f59e0b;">{tickers}</div>
  </td></tr>
  <tr><td style="height:3px;background:linear-gradient(90deg,#f59e0b,#ef4444);"></td></tr>
  <tr><td style="padding:32px 36px;">
    <p style="font-size:14px;color:#334155;line-height:1.7;margin:0 0 20px;">Hi {name},</p>
    <p style="font-size:14px;color:#334155;line-height:1.7;margin:0 0 24px;">
      {count} of your Watchlist alert{'s have' if count != 1 else ' has'} triggered based on yesterday's closing prices.
    </p>
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      {rows_html}
    </table>
    <div style="text-align:center;margin-top:28px;">
      <a href="{app_url}/watchlist" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px;">
        View Watchlist →
      </a>
    </div>
  </td></tr>
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#94a3b8;">VeloQuant · Not investment advice · <a href="{app_url}/settings" style="color:#94a3b8;">Manage notifications</a></p>
  </td></tr>
</table>
</td></tr></table>
</body></html>"""
    subject = f"Price alert triggered: {tickers}"
    return _send_transactional_email(to_email, subject, html)


def send_email_change_email(to_email: str, name: str, token: str, app_url: str) -> bool:
    verify_url = f"{app_url}/verify-email-change?token={token}"
    html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table width="560" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:32px 36px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;">VeloQuant</div>
    <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.03em;margin-bottom:4px;">Confirm your new email</div>
    <div style="font-size:13px;color:#94a3b8;">One click to update your address</div>
  </td></tr>
  <tr><td style="height:3px;background:linear-gradient(90deg,#4f7cf6,#06b6d4);"></td></tr>
  <tr><td style="padding:36px;">
    <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 24px;">Hi {name},</p>
    <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 32px;">
      We received a request to change your VeloQuant email address to <strong>{to_email}</strong>.
      Click the button below to confirm this change.
    </p>
    <div style="text-align:center;margin-bottom:32px;">
      <a href="{verify_url}" style="display:inline-block;background:linear-gradient(135deg,#4f7cf6,#06b6d4);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;letter-spacing:-0.01em;">
        Confirm New Email →
      </a>
    </div>
    <p style="font-size:12px;color:#94a3b8;line-height:1.6;margin:0;">
      This link expires in 24 hours. If you didn't request this change, you can safely ignore this email — your current address will remain unchanged.
    </p>
  </td></tr>
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#94a3b8;">VeloQuant · Not investment advice</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>"""
    return _send_transactional_email(to_email, "Confirm your new email address — VeloQuant", html)


def send_payment_failed_email(to_email: str, name: str, app_url: str) -> bool:
    html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table width="560" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:32px 36px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;">VeloQuant</div>
    <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.03em;margin-bottom:4px;">Payment failed</div>
    <div style="font-size:13px;color:#ef4444;">Action required to keep your access</div>
  </td></tr>
  <tr><td style="height:3px;background:#ef4444;"></td></tr>
  <tr><td style="padding:36px;">
    <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 20px;">Hi {name},</p>
    <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 24px;">
      We were unable to process your payment for VeloQuant. Please update your payment method to avoid losing access to your morning briefings.
    </p>
    <div style="background:#fff5f5;border:1px solid #ef444433;border-left:3px solid #ef4444;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:28px;">
      <div style="font-size:13px;font-weight:700;color:#ef4444;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">⚠ Action required</div>
      <div style="font-size:14px;color:#334155;line-height:1.6;">
        Update your payment method in the billing portal to restore full access. We'll retry the charge automatically once updated.
      </div>
    </div>
    <div style="text-align:center;margin-bottom:28px;">
      <a href="{app_url}/settings" style="display:inline-block;background:#ef4444;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;letter-spacing:-0.01em;">
        Update Payment Method →
      </a>
    </div>
    <p style="font-size:12px;color:#94a3b8;line-height:1.6;margin:0;text-align:center;">
      Questions? Reply to this email and we'll help right away.
    </p>
  </td></tr>
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#94a3b8;">VeloQuant · Not investment advice</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>"""
    return _send_transactional_email(to_email, "Action required: payment failed for VeloQuant", html)


def send_slack(webhook_url: str, text: str) -> bool:
    """Post a plain-text message to a Slack incoming webhook."""
    try:
        import urllib.request
        import json as _json
        payload = _json.dumps({"text": text}).encode()
        req = urllib.request.Request(webhook_url, data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except Exception as e:
        logger.error(f"Slack webhook failed: {e}")
        return False


def send_job_failure_email(to_email: str, name: str, app_url: str) -> bool:
    """Notify an advisor that today's morning briefing failed to generate."""
    first_name = name.split()[0] if name else "there"
    html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table width="560" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:28px 36px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;">VeloQuant</div>
    <div style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.03em;margin-bottom:4px;">Briefing not generated today</div>
    <div style="font-size:13px;color:#94a3b8;">A technical issue prevented your morning briefing</div>
  </td></tr>
  <tr><td style="height:3px;background:#f59e0b;"></td></tr>
  <tr><td style="padding:32px 36px;">
    <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 20px;">Hi {first_name},</p>
    <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 24px;">
      We ran into a technical issue this morning and were unable to generate your daily briefing. We're sorry for the interruption.
    </p>
    <div style="background:#fffbeb;border:1px solid #f59e0b33;border-left:3px solid #f59e0b;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:28px;">
      <div style="font-size:13px;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">What to do</div>
      <div style="font-size:14px;color:#334155;line-height:1.6;">
        You can generate today's briefing manually — just open your dashboard and click <strong>Generate Briefing</strong>.
      </div>
    </div>
    <div style="text-align:center;margin-bottom:28px;">
      <a href="{app_url}" style="display:inline-block;background:linear-gradient(135deg,#4f7cf6,#06b6d4);color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:700;font-size:14px;letter-spacing:-0.01em;">
        Generate Briefing Now →
      </a>
    </div>
    <p style="font-size:12px;color:#94a3b8;line-height:1.6;margin:0;text-align:center;">
      Tomorrow's briefing will run as normal at 7:30am ET. We apologize for the inconvenience.
    </p>
  </td></tr>
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#94a3b8;">VeloQuant · Not investment advice</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>"""
    return _send_transactional_email(to_email, "Your morning briefing wasn't generated today — VeloQuant", html)
