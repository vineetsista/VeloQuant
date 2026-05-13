import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from email_delivery import send_briefing_email

logger = logging.getLogger(__name__)


def run_morning_jobs(flask_app):
    """
    Generate morning briefings and scan SEC filings for every advisor with holdings.
    Runs at 7:30am ET on weekdays, giving advisors their briefing before market open at 9:30am.
    """
    from models import db, Advisor, Holding, Briefing
    from intelligence.briefing import generate_and_save_briefing
    from intelligence.filing_analyzer import scan_and_analyze_filings

    with flask_app.app_context():
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
            if briefing_dict:
                try:
                    sent = send_briefing_email(
                        advisor_email=advisor.email,
                        advisor_name=advisor.name,
                        firm_name=advisor.firm_name,
                        briefing_content=briefing_dict["content"],
                    )
                    if sent:
                        row = db.session.get(Briefing, briefing_dict["id"])
                        if row:
                            row.delivered = True
                            db.session.commit()
                        logger.info(f"Briefing email delivered to {advisor.email}")
                except Exception as e:
                    logger.error(f"Email delivery failed for advisor {advisor.id}: {e}")

        logger.info("Morning job finished")


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
        misfire_grace_time=3600,  # if server was down at 7:30, run within 1 hour
    )

    scheduler.start()
    logger.info("Scheduler started — morning briefings scheduled for 7:30am ET on weekdays")
    return scheduler
