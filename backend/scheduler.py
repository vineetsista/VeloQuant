import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from email_delivery import (
    send_briefing_email, send_trial_reminder_email,
    send_filing_alert_digest_email, send_price_alert_email,
    send_job_failure_email, send_slack,
)

logger = logging.getLogger(__name__)


def run_morning_jobs(flask_app):
    """
    Generate morning briefings and scan SEC filings for every advisor with holdings.
    Runs at 7:30am ET on weekdays, giving advisors their briefing before market open at 9:30am.
    """
    import os
    from datetime import datetime, timezone
    from models import db, Advisor, Holding, Briefing, PriceAlert, PortfolioSnapshot
    from intelligence.briefing import generate_and_save_briefing
    from intelligence.filing_analyzer import scan_and_analyze_filings
    from data.polygon import get_snapshot_batch

    with flask_app.app_context():
        app_url = os.getenv("APP_URL", "http://localhost:3000")
        advisors = Advisor.query.all()
        logger.info(f"Morning job starting — {len(advisors)} advisor(s) to process")

        for advisor in advisors:
            holdings = Holding.query.filter_by(advisor_id=advisor.id).all()
            if not holdings:
                logger.info(f"Skipping advisor {advisor.id} ({advisor.name}) — no holdings")
                continue

            # Scan new filings first so they are available to the briefing generator
            try:
                logger.info(f"Scanning filings for advisor {advisor.id} ({advisor.name})")
                new_alerts = scan_and_analyze_filings(advisor.id, flask_app, days_back=1)
                if new_alerts:
                    if advisor.filing_alert_email_enabled:
                        try:
                            send_filing_alert_digest_email(
                                advisor.email, advisor.name, advisor.firm_name,
                                new_alerts, app_url,
                            )
                            logger.info(f"Filing digest email sent to {advisor.email} ({len(new_alerts)} alerts)")
                        except Exception as mail_err:
                            logger.error(f"Filing digest email failed for {advisor.email}: {mail_err}")
                    if advisor.slack_webhook_url:
                        try:
                            tickers = ", ".join(sorted(set(a["ticker"] for a in new_alerts)))
                            send_slack(advisor.slack_webhook_url, f"📋 {len(new_alerts)} new SEC filing{'s' if len(new_alerts) != 1 else ''} for your holdings: {tickers}")
                        except Exception:
                            pass
            except Exception as e:
                logger.error(f"Filing scan failed for advisor {advisor.id}: {e}")

            # Generate briefing
            briefing_dict = None
            try:
                logger.info(f"Generating briefing for advisor {advisor.id} ({advisor.name})")
                briefing_dict = generate_and_save_briefing(advisor.id, flask_app)
                logger.info(f"Briefing complete for advisor {advisor.id}")
            except Exception as e:
                logger.error(f"Briefing generation failed for advisor {advisor.id}: {e}")
                if advisor.briefing_email_enabled:
                    try:
                        send_job_failure_email(advisor.email, advisor.name, app_url)
                    except Exception:
                        pass

            # Store daily portfolio snapshot (cached prices, fast)
            try:
                snap_tickers = [h.ticker for h in holdings]
                snap_prices = get_snapshot_batch(snap_tickers)
                total_val = sum(
                    float(h.shares) * snap_prices.get(h.ticker.upper(), {}).get("close", 0)
                    if h.shares and snap_prices.get(h.ticker.upper(), {}).get("close")
                    else float(h.position_size)
                    for h in holdings
                )
                today_date = datetime.now(timezone.utc).date()
                existing = PortfolioSnapshot.query.filter_by(advisor_id=advisor.id, date=today_date).first()
                if not existing and total_val > 0:
                    db.session.add(PortfolioSnapshot(advisor_id=advisor.id, date=today_date, total_value=total_val))
                    db.session.commit()
            except Exception as snap_err:
                logger.error(f"Portfolio snapshot failed for advisor {advisor.id}: {snap_err}")

            # Slack briefing notification
            if briefing_dict and advisor.slack_webhook_url:
                try:
                    from datetime import datetime, timezone as _tz
                    today = datetime.now(_tz.utc).strftime("%A, %b %d")
                    send_slack(advisor.slack_webhook_url, f"◆ Your VeloQuant morning briefing for {today} is ready: {app_url}")
                except Exception:
                    pass

            # Email delivery
            if briefing_dict and advisor.briefing_email_enabled:
                try:
                    advisor.ensure_unsubscribe_token()
                    db.session.commit()
                    sent = send_briefing_email(
                        advisor_email=advisor.email,
                        advisor_name=advisor.name,
                        firm_name=advisor.firm_name,
                        briefing_content=briefing_dict["content"],
                        unsubscribe_token=advisor.unsubscribe_token,
                        app_url=app_url,
                    )
                    if sent:
                        row = db.session.get(Briefing, briefing_dict["id"])
                        if row:
                            row.delivered = True
                            db.session.commit()
                        logger.info(f"Briefing email delivered to {advisor.email}")
                except Exception as e:
                    logger.error(f"Email delivery failed for advisor {advisor.id}: {e}")

        # Check price alerts across all advisors
        try:
            active = PriceAlert.query.filter_by(active=True).all()
            if active:
                tickers = list(set(a.ticker for a in active))
                prices = get_snapshot_batch(tickers)
                triggered_by_advisor = {}  # advisor_id -> [alert.to_dict()]
                for alert in active:
                    p = prices.get(alert.ticker.upper(), {})
                    close = p.get('close')
                    pct = p.get('pct_change')
                    fired = False
                    fired_price = close
                    if alert.alert_type == 'above' and close and close >= float(alert.threshold):
                        fired = True
                    elif alert.alert_type == 'below' and close and close <= float(alert.threshold):
                        fired = True
                    elif alert.alert_type == 'pct_day' and pct is not None and abs(pct) >= float(alert.threshold):
                        fired = True
                        fired_price = pct
                    if fired:
                        alert.active = False
                        alert.triggered_at = datetime.now(timezone.utc)
                        alert.triggered_price = fired_price
                        alert.read = False
                        triggered_by_advisor.setdefault(alert.advisor_id, []).append(alert.to_dict())
                total = sum(len(v) for v in triggered_by_advisor.values())
                if total:
                    db.session.commit()
                    logger.info(f"Price alerts: {total} triggered")
                    # Send per-advisor notification emails
                    for adv_id, adv_alerts in triggered_by_advisor.items():
                        adv = db.session.get(Advisor, adv_id)
                        if not adv:
                            continue
                        if adv.price_alert_email_enabled:
                            try:
                                send_price_alert_email(adv.email, adv.name, adv_alerts, app_url)
                                logger.info(f"Price alert email sent to {adv.email}")
                            except Exception as mail_err:
                                logger.error(f"Price alert email failed for {adv.email}: {mail_err}")
                        if adv.slack_webhook_url:
                            try:
                                tickers = ", ".join(sorted(set(a["ticker"] for a in adv_alerts)))
                                send_slack(adv.slack_webhook_url, f"🔔 Price alert triggered: {tickers} — view your Watchlist: {app_url}/watchlist")
                            except Exception:
                                pass
        except Exception as e:
            logger.error(f"Price alert check failed: {e}")

        logger.info("Morning job finished")


def run_weekly_wrap(flask_app):
    """
    Friday afternoon executive wrap. Sends a Friday 4:00pm ET email summarizing
    the week, what's coming next week, and prepared client talking points.
    """
    import os
    from datetime import datetime, timezone, timedelta
    from models import db, Advisor, Holding, Briefing, PortfolioSnapshot
    from intelligence.portfolio_qa import weekly_summary
    from email_delivery import send_weekly_wrap_email

    with flask_app.app_context():
        app_url = os.getenv("APP_URL", "http://localhost:3000")
        advisors = Advisor.query.all()
        logger.info(f"Weekly wrap starting — {len(advisors)} advisor(s) to evaluate")

        now = datetime.now(timezone.utc)
        week_ago = now - timedelta(days=7)
        sent = 0
        for advisor in advisors:
            # Skip advisors who turned the briefing email off
            if not advisor.briefing_email_enabled:
                continue
            holdings = Holding.query.filter_by(advisor_id=advisor.id).all()
            if not holdings:
                continue

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

            briefings = (
                Briefing.query.filter_by(advisor_id=advisor.id)
                .filter(Briefing.generated_at >= week_ago)
                .order_by(Briefing.generated_at.desc())
                .limit(5)
                .all()
            )
            briefing_texts = [b.content for b in briefings]

            snapshots = (
                PortfolioSnapshot.query.filter_by(advisor_id=advisor.id)
                .filter(PortfolioSnapshot.date >= week_ago.date())
                .order_by(PortfolioSnapshot.date.asc())
                .all()
            )
            snap_data = [{"date": s.date.isoformat(), "total_value": float(s.total_value)} for s in snapshots]

            try:
                content = weekly_summary(
                    advisor_name=advisor.name,
                    firm_name=advisor.firm_name or "",
                    holdings=holdings_data,
                    week_briefings=briefing_texts,
                    snapshots=snap_data,
                )
            except Exception as e:
                logger.error(f"Weekly wrap generation failed for advisor {advisor.id}: {e}")
                continue

            try:
                advisor.ensure_unsubscribe_token()
                db.session.commit()
                ok = send_weekly_wrap_email(
                    advisor_email=advisor.email,
                    advisor_name=advisor.name,
                    firm_name=advisor.firm_name,
                    wrap_content=content,
                    unsubscribe_token=advisor.unsubscribe_token,
                    app_url=app_url,
                )
                if ok:
                    sent += 1
                    logger.info(f"Weekly wrap email sent to {advisor.email}")
            except Exception as e:
                logger.error(f"Weekly wrap email failed for advisor {advisor.id}: {e}")

        logger.info(f"Weekly wrap finished — {sent} email(s) sent")


def run_trial_reminders(flask_app):
    """Send reminder emails to advisors whose trials expire in 3 days or 1 day."""
    import os
    from models import db, Advisor
    from datetime import datetime, timezone, timedelta

    with flask_app.app_context():
        app_url = os.getenv("APP_URL", "http://localhost:3000")
        now = datetime.now(timezone.utc)
        advisors = Advisor.query.filter_by(subscription_status="trialing").all()

        for advisor in advisors:
            if not advisor.trial_ends_at:
                continue
            trial_end = advisor.trial_ends_at.replace(tzinfo=timezone.utc)
            delta = trial_end - now
            days = delta.days

            if days in (3, 1, 0):
                try:
                    sent = send_trial_reminder_email(
                        advisor.email, advisor.name, days, app_url
                    )
                    if sent:
                        logger.info(f"Trial reminder ({days}d) sent to {advisor.email}")
                except Exception as e:
                    logger.error(f"Trial reminder failed for {advisor.email}: {e}")


def start_scheduler(flask_app):
    """
    Start the background scheduler.
    Returns the scheduler instance so the caller can shut it down on exit.
    """
    scheduler = BackgroundScheduler(timezone="US/Eastern")

    scheduler.add_job(
        func=run_morning_jobs,
        args=[flask_app],
        trigger=CronTrigger(
            day_of_week="mon-fri",
            hour=7,
            minute=30,
            timezone="US/Eastern",
        ),
        id="morning_briefing",
        name="Morning Briefing Generator",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    scheduler.add_job(
        func=run_trial_reminders,
        args=[flask_app],
        trigger=CronTrigger(
            hour=6,
            minute=0,
            timezone="US/Eastern",
        ),
        id="trial_reminders",
        name="Trial Expiry Reminders",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    scheduler.add_job(
        func=run_weekly_wrap,
        args=[flask_app],
        trigger=CronTrigger(
            day_of_week="fri",
            hour=16,
            minute=15,
            timezone="US/Eastern",
        ),
        id="weekly_wrap",
        name="Friday Executive Wrap",
        replace_existing=True,
        misfire_grace_time=7200,
    )

    scheduler.start()
    logger.info("Scheduler started — morning briefings 7:30am ET, trial reminders 6:00am ET, weekly wrap Fridays 4:15pm ET")
    return scheduler
