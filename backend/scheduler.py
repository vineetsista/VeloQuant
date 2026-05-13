import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from email_delivery import send_briefing_email, send_trial_reminder_email

logger = logging.getLogger(__name__)


def run_morning_jobs(flask_app):
    """
    Generate morning briefings and scan SEC filings for every advisor with holdings.
    Runs at 7:30am ET on weekdays, giving advisors their briefing before market open at 9:30am.
    """
    import os
    from datetime import datetime, timezone
    from models import db, Advisor, Holding, Briefing, PriceAlert
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
                scan_and_analyze_filings(advisor.id, flask_app, days_back=1)
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
                triggered = 0
                for alert in active:
                    p = prices.get(alert.ticker.upper(), {})
                    close = p.get('close')
                    pct = p.get('pct_change')
                    fired = False
                    if alert.alert_type == 'above' and close and close >= float(alert.threshold):
                        fired = True
                    elif alert.alert_type == 'below' and close and close <= float(alert.threshold):
                        fired = True
                    elif alert.alert_type == 'pct_day' and pct is not None and abs(pct) >= float(alert.threshold):
                        fired = True
                    if fired:
                        alert.active = False
                        alert.triggered_at = datetime.now(timezone.utc)
                        alert.triggered_price = close
                        alert.read = False
                        triggered += 1
                if triggered:
                    db.session.commit()
                    logger.info(f"Price alerts: {triggered} triggered")
        except Exception as e:
            logger.error(f"Price alert check failed: {e}")

        logger.info("Morning job finished")


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

            if days in (3, 1):
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

    scheduler.start()
    logger.info("Scheduler started — morning briefings at 7:30am ET, trial reminders at 6:00am ET")
    return scheduler
