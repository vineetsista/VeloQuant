import os
import re
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def _briefing_to_html(briefing_content: str, advisor_name: str, firm_name: str) -> str:
    """Convert plain-text briefing into a styled HTML email."""
    today = datetime.now(timezone.utc).strftime("%A, %B %d, %Y").replace(" 0", " ")

    # Parse sections: numbered items and an overall summary line
    blocks_html = []
    paragraphs = [
        p.strip() for p in briefing_content.strip().split("\n\n") if p.strip()
    ]

    for para in paragraphs:
        numbered = re.match(r"^(\d+)\.\s+(.+)$", para, re.DOTALL)
        if numbered:
            num = numbered.group(1)
            text = numbered.group(2).replace("\n", " ")
            blocks_html.append(f"""
            <tr>
              <td style="padding: 0 0 16px 0;">
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td width="36" valign="top" style="padding-top: 2px;">
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
        elif re.search(
            r"\boverall\b|\bportfolio tone\b|\bin sum\b|\bbottom line\b",
            para,
            re.IGNORECASE,
        ):
            blocks_html.append(f"""
            <tr>
              <td style="padding: 0 0 16px 0;">
                <div style="
                  background: #f0f9ff; border-left: 3px solid #4f7cf6;
                  padding: 14px 16px; border-radius: 0 6px 6px 0;
                  font-size: 14px; line-height: 1.65; color: #1e3a5f;
                  font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
                ">{para.replace(chr(10), " ")}</div>
              </td>
            </tr>""")
        else:
            blocks_html.append(f"""
            <tr>
              <td style="padding: 0 0 14px 0;">
                <p style="
                  margin: 0; font-size: 14px; line-height: 1.65; color: #334155;
                  font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
                ">{para.replace(chr(10), " ")}</p>
              </td>
            </tr>""")

    items_html = "\n".join(blocks_html)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Morning Intelligence Briefing — {today}</title>
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
                  ">RIA Intelligence</div>
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
              margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.6;
              font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
            ">
              This briefing was generated by RIA Intelligence and is intended solely for
              {advisor_name} at {firm_name}. Not for distribution.
            </p>
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
            from_email=Email(from_email, "RIA Intelligence"),
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
    <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;">RIA Intelligence</div>
    <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.03em;margin-bottom:4px;">Verify your email</div>
    <div style="font-size:13px;color:#94a3b8;">One click to activate your account</div>
  </td></tr>
  <tr><td style="height:3px;background:linear-gradient(90deg,#4f7cf6,#06b6d4);"></td></tr>
  <tr><td style="padding:36px;">
    <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 24px;">Hi {name},</p>
    <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 32px;">
      Welcome to RIA Intelligence. Click the button below to verify your email address and activate your account.
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
    <p style="margin:0;font-size:11px;color:#94a3b8;">RIA Intelligence · Not investment advice</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>"""
    return _send_transactional_email(
        to_email, "Verify your RIA Intelligence email", html
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
    <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;">RIA Intelligence</div>
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
    <p style="margin:0;font-size:11px;color:#94a3b8;">RIA Intelligence · Not investment advice</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>"""
    return _send_transactional_email(
        to_email, "Reset your RIA Intelligence password", html
    )


def send_briefing_email(
    advisor_email: str, advisor_name: str, firm_name: str, briefing_content: str
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
        subject = f"Morning Intelligence Briefing — {today}"
        html_body = _briefing_to_html(briefing_content, advisor_name, firm_name)

        message = Mail(
            from_email=Email(from_email, "RIA Intelligence"),
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
