import os
import logging

logging.basicConfig(level=logging.INFO)
from flask import Flask, jsonify, request, send_from_directory, g
from flask_cors import CORS
from flask_migrate import Migrate
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv
from models import (
    db,
    Advisor,
    Holding,
    Briefing,
    FilingAlert,
    ClientEmail,
    PriceAlert,
    PortfolioSnapshot,
    ClientContact,
)
from data.edgar import get_recent_filings, get_cik
from data.polygon import (
    get_portfolio_market_data,
    get_overnight_change,
    get_prices_batch,
    get_snapshot_batch,
    get_upcoming_earnings,
    get_upcoming_dividends,
)
from intelligence.briefing import generate_morning_briefing
from intelligence.filing_analyzer import scan_and_analyze_filings
from intelligence.email_generator import generate_client_email
from scheduler import start_scheduler, run_morning_jobs
from email_delivery import (
    send_verification_email,
    send_password_reset_email,
    send_welcome_email,
    send_trial_reminder_email,
    send_payment_failed_email,
    send_email_change_email,
    send_job_failure_email,
)

load_dotenv()


def create_app():
    static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
    app = Flask(__name__, static_folder=None)

    # Railway provides DATABASE_URL as postgres:// — SQLAlchemy needs postgresql://
    database_url = os.getenv("DATABASE_URL", "postgresql://localhost/ria_intelligence")
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    CORS(app)
    db.init_app(app)
    Migrate(app, db)

    limiter = Limiter(
        key_func=get_remote_address,
        app=app,
        default_limits=[],
        storage_uri="memory://",
    )

    @app.errorhandler(429)
    def ratelimit_handler(e):
        return jsonify(
            {"error": "Too many requests. Please wait before trying again."}
        ), 429

    # Routes that don't require an API key
    _PUBLIC_ENDPOINTS = {
        "health",
        "create_advisor",
        "get_advisor_by_email",
        "verify_email",
        "resend_verification",
        "forgot_password",
        "reset_password",
        "verify_email_change",
        "unsubscribe",
        "stripe_webhook",
        "demo_generate",
        "get_market_indices",
        "contact",
        "static",
        "serve_react",
    }

    @app.before_request
    def authenticate():
        if request.endpoint in _PUBLIC_ENDPOINTS:
            return None
        if request.endpoint is None:
            return None  # will 404 normally
        api_key = request.headers.get("X-API-Key")
        if not api_key:
            return jsonify({"error": "Authentication required"}), 401
        advisor = Advisor.query.filter_by(api_key=api_key).first()
        if not advisor:
            return jsonify({"error": "Invalid or expired API key"}), 401
        g.advisor = advisor

    def _assert_own(advisor_id):
        """Return a 403 response if the authenticated advisor doesn't own this resource."""
        if g.advisor.id != int(advisor_id) and not g.advisor.is_admin():
            return jsonify({"error": "Access denied"}), 403
        return None

    with app.app_context():
        db.create_all()
        # Idempotent schema migrations for columns added after initial deploy
        try:
            db.session.execute(
                db.text(
                    "ALTER TABLE advisors ADD COLUMN IF NOT EXISTS briefing_email_enabled BOOLEAN NOT NULL DEFAULT TRUE"
                )
            )
            db.session.execute(
                db.text(
                    "ALTER TABLE advisors ADD COLUMN IF NOT EXISTS filing_alert_email_enabled BOOLEAN NOT NULL DEFAULT TRUE"
                )
            )
            db.session.execute(
                db.text(
                    "ALTER TABLE advisors ADD COLUMN IF NOT EXISTS price_alert_email_enabled BOOLEAN NOT NULL DEFAULT TRUE"
                )
            )
            db.session.execute(
                db.text(
                    "ALTER TABLE advisors ADD COLUMN IF NOT EXISTS api_key VARCHAR(64)"
                )
            )
            db.session.execute(
                db.text(
                    "ALTER TABLE advisors ADD COLUMN IF NOT EXISTS unsubscribe_token VARCHAR(64)"
                )
            )
            db.session.execute(
                db.text(
                    "ALTER TABLE advisors ADD COLUMN IF NOT EXISTS pending_email VARCHAR(200)"
                )
            )
            db.session.execute(
                db.text(
                    "ALTER TABLE advisors ADD COLUMN IF NOT EXISTS email_change_token VARCHAR(100)"
                )
            )
            db.session.execute(
                db.text(
                    "ALTER TABLE holdings ADD COLUMN IF NOT EXISTS shares NUMERIC(15,6)"
                )
            )
            db.session.execute(
                db.text("ALTER TABLE holdings ADD COLUMN IF NOT EXISTS notes TEXT")
            )
            db.session.execute(
                db.text(
                    "ALTER TABLE holdings ADD COLUMN IF NOT EXISTS client_tag VARCHAR(100)"
                )
            )
            db.session.execute(
                db.text(
                    "ALTER TABLE advisors ADD COLUMN IF NOT EXISTS slack_webhook_url VARCHAR(512)"
                )
            )
            db.session.execute(
                db.text(
                    "ALTER TABLE advisors ADD COLUMN IF NOT EXISTS briefing_focus VARCHAR(500)"
                )
            )
            db.session.execute(
                db.text("""
                CREATE TABLE IF NOT EXISTS portfolio_snapshots (
                    id SERIAL PRIMARY KEY,
                    advisor_id INTEGER NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,
                    date DATE NOT NULL,
                    total_value NUMERIC(15,2) NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    CONSTRAINT uq_snapshot_advisor_date UNIQUE (advisor_id, date)
                )
            """)
            )
            db.session.execute(
                db.text(
                    "ALTER TABLE filing_alerts ADD COLUMN IF NOT EXISTS edgar_url VARCHAR(512)"
                )
            )
            db.session.execute(
                db.text("""
                CREATE TABLE IF NOT EXISTS price_alerts (
                    id SERIAL PRIMARY KEY,
                    advisor_id INTEGER NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,
                    ticker VARCHAR(20) NOT NULL,
                    alert_type VARCHAR(20) NOT NULL,
                    threshold NUMERIC(10,4) NOT NULL,
                    active BOOLEAN NOT NULL DEFAULT TRUE,
                    triggered_at TIMESTAMP,
                    triggered_price NUMERIC(10,4),
                    read BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """)
            )
            db.session.execute(
                db.text("""
                CREATE TABLE IF NOT EXISTS client_contacts (
                    id SERIAL PRIMARY KEY,
                    advisor_id INTEGER NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,
                    name VARCHAR(200) NOT NULL,
                    email VARCHAR(200) NOT NULL,
                    client_tag VARCHAR(100),
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """)
            )
            db.session.commit()
        except Exception:
            db.session.rollback()
        # Unique indexes
        try:
            db.session.execute(
                db.text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ix_advisors_api_key ON advisors (api_key)"
                )
            )
            db.session.execute(
                db.text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ix_advisors_unsubscribe_token ON advisors (unsubscribe_token)"
                )
            )
            db.session.commit()
        except Exception:
            db.session.rollback()

    # ── Health ────────────────────────────────────────────────────────────────

    @app.route("/health")
    def health():
        try:
            db.session.execute(db.text("SELECT 1"))
            return jsonify({"status": "ok", "db": "connected"})
        except Exception as e:
            return jsonify({"status": "error", "db": str(e)}), 500

    # ── Advisors ──────────────────────────────────────────────────────────────

    @app.route("/api/advisors", methods=["POST"])
    @limiter.limit("10 per hour")
    def create_advisor():
        data = request.get_json()
        if not all(k in data for k in ("name", "firm_name", "email")):
            return jsonify({"error": "name, firm_name, and email are required"}), 400

        if Advisor.query.filter_by(email=data["email"]).first():
            return jsonify({"error": "Email already registered"}), 409

        advisor = Advisor(
            name=data["name"], firm_name=data["firm_name"], email=data["email"]
        )
        if data.get("password"):
            advisor.set_password(data["password"])
        token = advisor.generate_verification_token()
        advisor.ensure_api_key()
        db.session.add(advisor)
        db.session.commit()
        app_url = os.getenv("APP_URL", "http://localhost:3000")
        send_verification_email(advisor.email, advisor.name, token, app_url)
        result = advisor.to_dict()
        result["api_key"] = advisor.api_key
        return jsonify(result), 201

    @app.route("/api/advisors/<int:advisor_id>")
    def get_advisor(advisor_id):
        if err := _assert_own(advisor_id):
            return err
        advisor = db.get_or_404(Advisor, advisor_id)
        return jsonify(advisor.to_dict())

    @app.route("/api/advisors/by-email", methods=["POST"])
    @limiter.limit("20 per hour; 5 per minute")
    def get_advisor_by_email():
        data = request.get_json() or {}
        email = data.get("email", "").strip().lower()
        password = data.get("password", "")
        if not email:
            return jsonify({"error": "email required"}), 400
        advisor = Advisor.query.filter_by(email=email).first()
        if not advisor:
            return jsonify({"error": "No account found with that email address"}), 404
        if advisor.has_password() and not advisor.check_password(password):
            return jsonify({"error": "Incorrect password"}), 401
        # Generate API key if advisor doesn't have one yet (existing accounts)
        if not advisor.api_key:
            advisor.ensure_api_key()
            db.session.commit()
        result = advisor.to_dict()
        result["api_key"] = advisor.api_key
        return jsonify(result)

    # ── Email Verification ────────────────────────────────────────────────────

    @app.route("/api/verify-email/<token>", methods=["POST"])
    def verify_email(token):
        advisor = Advisor.query.filter_by(verification_token=token).first()
        if not advisor:
            return jsonify({"error": "Invalid or expired verification link"}), 400
        first_verify = not advisor.email_verified
        advisor.email_verified = True
        advisor.verification_token = None
        db.session.commit()
        if first_verify:
            app_url = os.getenv("APP_URL", "http://localhost:3000")
            send_welcome_email(advisor.email, advisor.name, advisor.firm_name, app_url)
        return jsonify({"message": "Email verified", "advisor": advisor.to_dict()})

    @app.route("/api/resend-verification", methods=["POST"])
    def resend_verification():
        data = request.get_json() or {}
        email = data.get("email", "").strip().lower()
        advisor = Advisor.query.filter_by(email=email).first()
        if advisor and not advisor.email_verified:
            token = advisor.generate_verification_token()
            db.session.commit()
            app_url = os.getenv("APP_URL", "http://localhost:3000")
            send_verification_email(advisor.email, advisor.name, token, app_url)
        return jsonify(
            {
                "message": "If that account exists and is unverified, a new email was sent"
            }
        )

    @app.route("/api/forgot-password", methods=["POST"])
    @limiter.limit("5 per hour")
    def forgot_password():
        data = request.get_json() or {}
        email = data.get("email", "").strip().lower()
        advisor = Advisor.query.filter_by(email=email).first()
        if advisor:
            token = advisor.generate_reset_token()
            db.session.commit()
            app_url = os.getenv("APP_URL", "http://localhost:3000")
            send_password_reset_email(advisor.email, advisor.name, token, app_url)
        return jsonify(
            {"message": "If that email is registered, a reset link was sent"}
        )

    @app.route("/api/reset-password/<token>", methods=["POST"])
    def reset_password(token):
        from datetime import datetime, timezone

        data = request.get_json() or {}
        new_password = data.get("password", "")
        if len(new_password) < 8:
            return jsonify({"error": "Password must be at least 8 characters"}), 400
        advisor = Advisor.query.filter_by(reset_token=token).first()
        if not advisor:
            return jsonify({"error": "Invalid or expired reset link"}), 400
        if advisor.reset_token_expires and advisor.reset_token_expires < datetime.now(
            timezone.utc
        ):
            return jsonify(
                {"error": "Reset link has expired. Please request a new one"}
            ), 400
        advisor.set_password(new_password)
        advisor.reset_token = None
        advisor.reset_token_expires = None
        db.session.commit()
        return jsonify({"message": "Password updated successfully"})

    @app.route("/api/contact", methods=["POST"])
    @limiter.limit("10 per hour")
    def contact():
        import sendgrid
        from sendgrid.helpers.mail import Mail

        data = request.get_json() or {}
        name = data.get("name", "").strip()
        email = data.get("email", "").strip()
        subject = data.get("subject", "").strip()
        message = data.get("message", "").strip()
        if not name or not email or not subject or not message:
            return jsonify({"error": "All fields are required"}), 400
        sg_key = os.getenv("SENDGRID_API_KEY")
        to_addr = os.getenv("SUPPORT_EMAIL", os.getenv("SENDGRID_FROM_EMAIL", ""))
        if sg_key and to_addr:
            try:
                sg = sendgrid.SendGridAPIClient(api_key=sg_key)
                body = f"From: {name} <{email}>\nSubject: {subject}\n\n{message}"
                mail = Mail(
                    from_email=os.getenv("SENDGRID_FROM_EMAIL", to_addr),
                    to_emails=to_addr,
                    subject=f"[RIA Support] {subject} — {name}",
                    plain_text_content=body,
                )
                mail.reply_to = email
                sg.send(mail)
            except Exception as exc:
                logging.error("Contact email failed: %s", exc)
        return jsonify({"message": "Message received"})

    @app.route("/api/unsubscribe/<token>", methods=["GET", "POST"])
    def unsubscribe(token):
        advisor = Advisor.query.filter_by(unsubscribe_token=token).first()
        if not advisor:
            return jsonify({"error": "Invalid unsubscribe link"}), 404
        advisor.briefing_email_enabled = False
        db.session.commit()
        return jsonify({"message": "Unsubscribed successfully", "name": advisor.name})

    def _require_subscription(advisor):
        """Return a 402 error response if advisor has no active subscription, else None."""
        if advisor.is_legacy():
            return None  # legacy accounts always pass
        if advisor.is_subscribed():
            return None
        return jsonify(
            {
                "error": "subscription_required",
                "message": "Your free trial has ended. Please subscribe to continue.",
            }
        ), 402

    # ── Holdings ──────────────────────────────────────────────────────────────

    @app.route("/api/advisors/<int:advisor_id>/holdings", methods=["GET"])
    def get_holdings(advisor_id):
        if err := _assert_own(advisor_id):
            return err
        holdings = Holding.query.filter_by(advisor_id=advisor_id).all()
        # Lazy backfill shares for holdings that predate this feature
        needs_backfill = [h for h in holdings if h.shares is None]
        if needs_backfill:
            try:
                prices = get_snapshot_batch([h.ticker for h in needs_backfill])
                for h in needs_backfill:
                    close = prices.get(h.ticker.upper(), {}).get("close")
                    if close and close > 0:
                        h.shares = float(h.position_size) / close
                db.session.commit()
            except Exception:
                db.session.rollback()
        return jsonify([h.to_dict() for h in holdings])

    @app.route("/api/advisors/<int:advisor_id>/holdings", methods=["POST"])
    def add_holding(advisor_id):
        if err := _assert_own(advisor_id):
            return err
        data = request.get_json()
        if not all(k in data for k in ("ticker", "position_size")):
            return jsonify({"error": "ticker and position_size are required"}), 400

        try:
            ps = float(data["position_size"])
            if ps <= 0:
                return jsonify({"error": "Position size must be greater than zero"}), 400
        except (TypeError, ValueError):
            return jsonify({"error": "position_size must be a valid number"}), 400

        ticker = data["ticker"].upper().strip()

        def _set_shares(h):
            try:
                prices = get_snapshot_batch([ticker])
                close = prices.get(ticker, {}).get("close")
                if close and close > 0:
                    h.shares = float(h.position_size) / close
            except Exception:
                pass

        existing = Holding.query.filter_by(advisor_id=advisor_id, ticker=ticker).first()
        if existing:
            existing.position_size = data["position_size"]
            _set_shares(existing)
            db.session.commit()
            return jsonify(existing.to_dict())

        holding = Holding(
            advisor_id=advisor_id,
            ticker=ticker,
            position_size=data["position_size"],
            client_tag=(data.get("client_tag") or "").strip() or None,
        )
        db.session.add(holding)
        db.session.flush()
        _set_shares(holding)
        db.session.commit()
        return jsonify(holding.to_dict()), 201

    @app.route(
        "/api/advisors/<int:advisor_id>/holdings/<int:holding_id>/client",
        methods=["PATCH"],
    )
    def update_holding_client(advisor_id, holding_id):
        if err := _assert_own(advisor_id):
            return err
        holding = Holding.query.filter_by(
            id=holding_id, advisor_id=advisor_id
        ).first_or_404()
        data = request.get_json(silent=True) or {}
        holding.client_tag = (data.get("client_tag") or "").strip() or None
        db.session.commit()
        return jsonify(holding.to_dict())

    @app.route(
        "/api/advisors/<int:advisor_id>/holdings/<int:holding_id>", methods=["DELETE"]
    )
    def delete_holding(advisor_id, holding_id):
        if err := _assert_own(advisor_id):
            return err
        holding = Holding.query.filter_by(
            id=holding_id, advisor_id=advisor_id
        ).first_or_404()
        db.session.delete(holding)
        db.session.commit()
        return jsonify({"deleted": holding_id})

    @app.route("/api/validate-ticker/<ticker>")
    def validate_ticker(ticker):
        import requests as _req

        api_key = os.getenv("POLYGON_API_KEY", "")
        ticker = ticker.upper().strip()
        if not ticker or not api_key:
            return jsonify({"valid": False, "name": None})
        try:
            r = _req.get(
                f"https://api.polygon.io/v3/reference/tickers/{ticker}",
                params={"apiKey": api_key},
                timeout=5,
            )
            if r.status_code == 200:
                data = r.json().get("results", {})
                return jsonify({"valid": bool(data), "name": data.get("name")})
        except Exception:
            pass
        return jsonify({"valid": False, "name": None})

    # ── Briefings ─────────────────────────────────────────────────────────────

    @app.route("/api/advisors/<int:advisor_id>/briefings")
    def get_briefings(advisor_id):
        if err := _assert_own(advisor_id):
            return err
        limit = request.args.get("limit", 10, type=int)
        briefings = (
            Briefing.query.filter_by(advisor_id=advisor_id)
            .order_by(Briefing.generated_at.desc())
            .limit(limit)
            .all()
        )
        return jsonify([b.to_dict() for b in briefings])

    @app.route("/api/advisors/<int:advisor_id>/briefings/latest")
    def get_latest_briefing(advisor_id):
        if err := _assert_own(advisor_id):
            return err
        briefing = (
            Briefing.query.filter_by(advisor_id=advisor_id)
            .order_by(Briefing.generated_at.desc())
            .first()
        )
        if not briefing:
            return jsonify({"error": "No briefings found"}), 404
        return jsonify(briefing.to_dict())

    @app.route("/api/briefings/<int:briefing_id>", methods=["DELETE"])
    def delete_briefing(briefing_id):
        briefing = db.get_or_404(Briefing, briefing_id)
        if err := _assert_own(briefing.advisor_id):
            return err
        db.session.delete(briefing)
        db.session.commit()
        return jsonify({"deleted": briefing_id})

    @app.route("/api/briefings/<int:briefing_id>/send", methods=["POST"])
    def send_briefing_on_demand(briefing_id):
        briefing = db.get_or_404(Briefing, briefing_id)
        if err := _assert_own(briefing.advisor_id):
            return err
        advisor = db.get_or_404(Advisor, briefing.advisor_id)
        success = send_briefing_email(
            advisor.email, advisor.name, advisor.firm_name, briefing.content
        )
        if success:
            briefing.delivered = True
            db.session.commit()
            return jsonify(briefing.to_dict())
        return jsonify(
            {"error": "Failed to send email. Check SendGrid configuration."}
        ), 500

    # ── Filing Alerts ─────────────────────────────────────────────────────────

    @app.route("/api/advisors/<int:advisor_id>/filing-alerts")
    def get_filing_alerts(advisor_id):
        if err := _assert_own(advisor_id):
            return err
        unread_only = request.args.get("unread", "false").lower() == "true"
        query = FilingAlert.query.filter_by(advisor_id=advisor_id)
        if unread_only:
            query = query.filter_by(read=False)
        alerts = query.order_by(FilingAlert.filing_date.desc()).all()
        return jsonify([a.to_dict() for a in alerts])

    @app.route("/api/filing-alerts/<int:alert_id>/read", methods=["PATCH"])
    def mark_alert_read(alert_id):
        alert = db.get_or_404(FilingAlert, alert_id)
        if err := _assert_own(alert.advisor_id):
            return err
        alert.read = True
        db.session.commit()
        return jsonify(alert.to_dict())

    # ── Client Emails ─────────────────────────────────────────────────────────

    @app.route("/api/advisors/<int:advisor_id>/client-emails")
    def get_client_emails(advisor_id):
        if err := _assert_own(advisor_id):
            return err
        unsent_only = request.args.get("unsent", "false").lower() == "true"
        query = ClientEmail.query.filter_by(advisor_id=advisor_id)
        if unsent_only:
            query = query.filter_by(sent=False)
        emails = query.order_by(ClientEmail.created_at.desc()).all()
        return jsonify([e.to_dict() for e in emails])

    @app.route("/api/client-emails/<int:email_id>/send", methods=["PATCH"])
    def mark_email_sent(email_id):
        email = db.get_or_404(ClientEmail, email_id)
        if err := _assert_own(email.advisor_id):
            return err
        email.sent = True
        db.session.commit()
        return jsonify(email.to_dict())

    @app.route("/api/client-emails/<int:email_id>", methods=["DELETE"])
    def delete_client_email(email_id):
        email = db.get_or_404(ClientEmail, email_id)
        if err := _assert_own(email.advisor_id):
            return err
        db.session.delete(email)
        db.session.commit()
        return jsonify({"deleted": True})

    @app.route("/api/filing-alerts/<int:alert_id>", methods=["DELETE"])
    def delete_filing_alert(alert_id):
        alert = db.get_or_404(FilingAlert, alert_id)
        if err := _assert_own(alert.advisor_id):
            return err
        db.session.delete(alert)
        db.session.commit()
        return jsonify({"deleted": True})

    # ── Client Contacts ───────────────────────────────────────────────────────

    @app.route("/api/advisors/<int:advisor_id>/contacts")
    def get_contacts(advisor_id):
        if err := _assert_own(advisor_id):
            return err
        contacts = (
            ClientContact.query.filter_by(advisor_id=advisor_id)
            .order_by(ClientContact.name)
            .all()
        )
        return jsonify([c.to_dict() for c in contacts])

    @app.route("/api/advisors/<int:advisor_id>/contacts", methods=["POST"])
    def create_contact(advisor_id):
        if err := _assert_own(advisor_id):
            return err
        data = request.get_json() or {}
        name = data.get("name", "").strip()
        email_addr = data.get("email", "").strip().lower()
        if not name or not email_addr:
            return jsonify({"error": "name and email are required"}), 400
        contact = ClientContact(
            advisor_id=advisor_id,
            name=name,
            email=email_addr,
            client_tag=data.get("client_tag", "").strip() or None,
        )
        db.session.add(contact)
        db.session.commit()
        return jsonify(contact.to_dict()), 201

    @app.route(
        "/api/advisors/<int:advisor_id>/contacts/<int:contact_id>", methods=["PATCH"]
    )
    def update_contact(advisor_id, contact_id):
        if err := _assert_own(advisor_id):
            return err
        contact = ClientContact.query.filter_by(
            id=contact_id, advisor_id=advisor_id
        ).first_or_404()
        data = request.get_json() or {}
        if "name" in data:
            contact.name = data["name"].strip()
        if "email" in data:
            contact.email = data["email"].strip().lower()
        if "client_tag" in data:
            contact.client_tag = data["client_tag"].strip() or None
        db.session.commit()
        return jsonify(contact.to_dict())

    @app.route(
        "/api/advisors/<int:advisor_id>/contacts/<int:contact_id>", methods=["DELETE"]
    )
    def delete_contact(advisor_id, contact_id):
        if err := _assert_own(advisor_id):
            return err
        contact = ClientContact.query.filter_by(
            id=contact_id, advisor_id=advisor_id
        ).first_or_404()
        db.session.delete(contact)
        db.session.commit()
        return jsonify({"deleted": True})

    # ── EDGAR (test) ──────────────────────────────────────────────────────────

    @app.route("/api/advisors/<int:advisor_id>/scan-filings")
    def scan_filings(advisor_id):
        if err := _assert_own(advisor_id):
            return err
        advisor = db.get_or_404(Advisor, advisor_id)
        days_back = request.args.get("days", 7, type=int)
        holdings = Holding.query.filter_by(advisor_id=advisor_id).all()
        tickers = [h.ticker for h in holdings]

        results = []
        for ticker in tickers:
            filings = get_recent_filings(ticker, days_back=days_back)
            results.extend(filings)

        return jsonify(
            {
                "advisor": advisor.name,
                "tickers": tickers,
                "filings_found": len(results),
                "filings": results,
            }
        )

    @app.route("/api/edgar/cik/<ticker>")
    def lookup_cik(ticker):
        cik = get_cik(ticker.upper())
        if not cik:
            return jsonify({"error": f"No CIK found for {ticker.upper()}"}), 404
        return jsonify({"ticker": ticker.upper(), "cik": cik})

    # ── Profile Update ────────────────────────────────────────────────────────

    @app.route("/api/advisors/<int:advisor_id>/profile", methods=["PATCH"])
    def update_profile(advisor_id):
        if err := _assert_own(advisor_id):
            return err
        advisor = db.get_or_404(Advisor, advisor_id)
        data = request.get_json() or {}
        if "name" in data and data["name"].strip():
            advisor.name = data["name"].strip()
        if "firm_name" in data and data["firm_name"].strip():
            advisor.firm_name = data["firm_name"].strip()
        db.session.commit()
        return jsonify(advisor.to_dict())

    @app.route("/api/advisors/<int:advisor_id>/email-preferences", methods=["PATCH"])
    def update_email_preferences(advisor_id):
        if err := _assert_own(advisor_id):
            return err
        advisor = db.get_or_404(Advisor, advisor_id)
        data = request.get_json() or {}
        if "briefing_email_enabled" in data:
            advisor.briefing_email_enabled = bool(data["briefing_email_enabled"])
        if "filing_alert_email_enabled" in data:
            advisor.filing_alert_email_enabled = bool(
                data["filing_alert_email_enabled"]
            )
        if "price_alert_email_enabled" in data:
            advisor.price_alert_email_enabled = bool(data["price_alert_email_enabled"])
        if "briefing_focus" in data:
            focus = (data["briefing_focus"] or "").strip()
            advisor.briefing_focus = focus[:500] if focus else None
        db.session.commit()
        return jsonify(advisor.to_dict())

    @app.route("/api/advisors/<int:advisor_id>/portfolio-snapshots")
    def get_portfolio_snapshots(advisor_id):
        if err := _assert_own(advisor_id):
            return err
        days = min(int(request.args.get("days", 30)), 365)
        from datetime import date, timedelta

        cutoff = date.today() - timedelta(days=days)
        snaps = (
            PortfolioSnapshot.query.filter(
                PortfolioSnapshot.advisor_id == advisor_id,
                PortfolioSnapshot.date >= cutoff,
            )
            .order_by(PortfolioSnapshot.date.asc())
            .all()
        )
        return jsonify([s.to_dict() for s in snaps])

    @app.route("/api/advisors/<int:advisor_id>/holdings/52w")
    def get_52w_ranges(advisor_id):
        if err := _assert_own(advisor_id):
            return err
        from data.polygon import get_52w_ranges as _get_52w

        holdings = Holding.query.filter_by(advisor_id=advisor_id).all()
        tickers = list(set(h.ticker.upper() for h in holdings))
        try:
            data = _get_52w(tickers)
            return jsonify(data)
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route("/api/advisors/<int:advisor_id>/slack", methods=["PATCH"])
    def update_slack_webhook(advisor_id):
        if err := _assert_own(advisor_id):
            return err
        advisor = db.get_or_404(Advisor, advisor_id)
        data = request.get_json() or {}
        url = (data.get("webhook_url") or "").strip()
        if url and not url.startswith("https://hooks.slack.com/"):
            return jsonify({"error": "Invalid Slack webhook URL"}), 400
        advisor.slack_webhook_url = url or None
        db.session.commit()
        return jsonify(advisor.to_dict())

    @app.route("/api/advisors/<int:advisor_id>/slack/test", methods=["POST"])
    def test_slack_webhook(advisor_id):
        if err := _assert_own(advisor_id):
            return err
        advisor = db.get_or_404(Advisor, advisor_id)
        if not advisor.slack_webhook_url:
            return jsonify({"error": "No Slack webhook configured"}), 400
        from email_delivery import send_slack

        ok = send_slack(
            advisor.slack_webhook_url,
            f"✅ VeloQuant test notification — Slack is connected for {advisor.name} ({advisor.firm_name})",
        )
        if not ok:
            return jsonify(
                {"error": "Slack delivery failed — check your webhook URL"}
            ), 502
        return jsonify({"message": "Test notification sent"})

    @app.route("/api/advisors/<int:advisor_id>/change-password", methods=["POST"])
    def change_password(advisor_id):
        if err := _assert_own(advisor_id):
            return err
        advisor = db.get_or_404(Advisor, advisor_id)
        data = request.get_json() or {}
        current = data.get("current_password", "")
        new_pw = data.get("new_password", "")
        if len(new_pw) < 8:
            return jsonify({"error": "Password must be at least 8 characters"}), 400
        if advisor.has_password() and not advisor.check_password(current):
            return jsonify({"error": "Current password is incorrect"}), 401
        advisor.set_password(new_pw)
        db.session.commit()
        return jsonify({"message": "Password updated"})

    @app.route("/api/advisors/<int:advisor_id>/rotate-api-key", methods=["POST"])
    def rotate_api_key(advisor_id):
        if err := _assert_own(advisor_id):
            return err
        advisor = db.get_or_404(Advisor, advisor_id)
        new_key = advisor.rotate_api_key()
        db.session.commit()
        return jsonify({"api_key": new_key})

    @app.route("/api/advisors/<int:advisor_id>/request-email-change", methods=["POST"])
    @limiter.limit("5 per hour")
    def request_email_change(advisor_id):
        if err := _assert_own(advisor_id):
            return err
        advisor = db.get_or_404(Advisor, advisor_id)
        data = request.get_json() or {}
        new_email = data.get("email", "").strip().lower()
        if not new_email or "@" not in new_email:
            return jsonify({"error": "Valid email address required"}), 400
        if new_email == advisor.email.lower():
            return jsonify({"error": "That is already your email address"}), 400
        if Advisor.query.filter_by(email=new_email).first():
            return jsonify({"error": "That email address is already registered"}), 409
        token = advisor.request_email_change(new_email)
        db.session.commit()
        app_url = os.getenv("APP_URL", "http://localhost:3000")
        send_email_change_email(new_email, advisor.name, token, app_url)
        return jsonify({"message": "Verification email sent to new address"})

    @app.route("/api/verify-email-change/<token>", methods=["POST"])
    def verify_email_change(token):
        advisor = Advisor.query.filter_by(email_change_token=token).first()
        if not advisor or not advisor.pending_email:
            return jsonify({"error": "Invalid or expired link"}), 400
        new_email = advisor.pending_email
        if Advisor.query.filter(
            Advisor.email == new_email, Advisor.id != advisor.id
        ).first():
            advisor.pending_email = None
            advisor.email_change_token = None
            db.session.commit()
            return jsonify({"error": "That email address is already in use"}), 409
        advisor.email = new_email
        advisor.pending_email = None
        advisor.email_change_token = None
        db.session.commit()
        return jsonify({"message": "Email address updated successfully"})

    @app.route("/api/advisors/<int:advisor_id>", methods=["DELETE"])
    def delete_advisor(advisor_id):
        if err := _assert_own(advisor_id):
            return err
        advisor = db.get_or_404(Advisor, advisor_id)
        db.session.delete(advisor)
        db.session.commit()
        return jsonify({"deleted": advisor_id})

    # ── Market Data (test) ────────────────────────────────────────────────────

    @app.route("/api/market/price/<ticker>")
    def get_price(ticker):
        try:
            data = get_overnight_change(ticker)
            return jsonify(data)
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route("/api/advisors/<int:advisor_id>/market-data")
    def get_advisor_market_data(advisor_id):
        if err := _assert_own(advisor_id):
            return err
        holdings = Holding.query.filter_by(advisor_id=advisor_id).all()
        tickers = [h.ticker for h in holdings]
        try:
            data = get_portfolio_market_data(tickers)
            return jsonify(data)
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route("/api/advisors/<int:advisor_id>/earnings")
    def get_advisor_earnings(advisor_id):
        if err := _assert_own(advisor_id):
            return err
        holdings = Holding.query.filter_by(advisor_id=advisor_id).all()
        tickers = [h.ticker for h in holdings]
        if not tickers:
            return jsonify({})
        try:
            data = get_upcoming_earnings(tickers)
            return jsonify(data)
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route("/api/advisors/<int:advisor_id>/dividends")
    def get_advisor_dividends(advisor_id):
        if err := _assert_own(advisor_id):
            return err
        holdings = Holding.query.filter_by(advisor_id=advisor_id).all()
        tickers = [h.ticker for h in holdings]
        if not tickers:
            return jsonify({})
        try:
            data = get_upcoming_dividends(tickers)
            return jsonify(data)
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route(
        "/api/advisors/<int:advisor_id>/holdings/<int:holding_id>/notes",
        methods=["PATCH"],
    )
    def update_holding_notes(advisor_id, holding_id):
        if err := _assert_own(advisor_id):
            return err
        holding = Holding.query.filter_by(
            id=holding_id, advisor_id=advisor_id
        ).first_or_404()
        data = request.get_json(silent=True) or {}
        holding.notes = (data.get("notes") or "").strip() or None
        db.session.commit()
        return jsonify(holding.to_dict())

    @app.route("/api/market/prices")
    def get_market_prices():
        tickers_str = request.args.get("tickers", "")
        tickers = [t.strip().upper() for t in tickers_str.split(",") if t.strip()][:20]
        if not tickers:
            return jsonify({})
        try:
            data = get_snapshot_batch(tickers)
            return jsonify(data)
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    _indices_cache: dict = {"data": None, "ts": 0.0}

    @app.route("/api/market/indices")
    def get_market_indices():
        import time
        now = time.time()
        if _indices_cache["data"] and now - _indices_cache["ts"] < 900:
            return jsonify(_indices_cache["data"])
        indices = ["SPY", "QQQ", "DIA", "IWM", "TLT", "GLD", "VIX"]
        try:
            data = get_prices_batch(indices)
            _indices_cache["data"] = data
            _indices_cache["ts"] = now
            return jsonify(data)
        except Exception as e:
            if _indices_cache["data"]:
                return jsonify(_indices_cache["data"])
            return jsonify({"error": str(e)}), 500

    # ── Briefing Generation ───────────────────────────────────────────────────

    @app.route("/api/advisors/<int:advisor_id>/generate-briefing", methods=["POST"])
    def generate_briefing(advisor_id):
        if err := _assert_own(advisor_id):
            return err
        advisor = db.get_or_404(Advisor, advisor_id)
        gate = _require_subscription(advisor)
        if gate:
            return gate
        holdings = Holding.query.filter_by(advisor_id=advisor_id).all()
        if not holdings:
            return jsonify(
                {
                    "error": "No holdings found — add holdings before generating a briefing"
                }
            ), 400

        days_back = request.get_json(silent=True) or {}
        days_back_filings = days_back.get("days_back_filings", 1)

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

        try:
            content = generate_morning_briefing(
                advisor.name,
                advisor.firm_name,
                holdings_data,
                days_back_filings,
                briefing_focus=advisor.briefing_focus,
            )
        except Exception as e:
            return jsonify({"error": str(e)}), 500

        from datetime import datetime, timezone

        briefing = Briefing(
            advisor_id=advisor_id,
            content=content,
            generated_at=datetime.now(timezone.utc),
            delivered=False,
        )
        db.session.add(briefing)
        db.session.commit()

        # Save a portfolio snapshot so the 30-day trend sparkline has data
        try:
            from datetime import date as _date
            prices = get_snapshot_batch([h["ticker"] for h in holdings_data])
            total_snap = 0.0
            for h in holdings_data:
                close = prices.get(h["ticker"].upper(), {}).get("close")
                if h["shares"] and close:
                    total_snap += h["shares"] * close
                else:
                    total_snap += h["position_size"]
            if total_snap > 0:
                today = _date.today()
                existing_snap = PortfolioSnapshot.query.filter_by(
                    advisor_id=advisor_id, date=today
                ).first()
                if existing_snap:
                    existing_snap.total_value = total_snap
                else:
                    db.session.add(
                        PortfolioSnapshot(
                            advisor_id=advisor_id,
                            date=today,
                            total_value=total_snap,
                        )
                    )
                db.session.commit()
        except Exception:
            pass  # Never fail the briefing response due to snapshot errors

        return jsonify(briefing.to_dict()), 201

    # ── Filing Analysis ───────────────────────────────────────────────────────

    @app.route("/api/advisors/<int:advisor_id>/analyze-filings", methods=["POST"])
    def analyze_filings(advisor_id):
        if err := _assert_own(advisor_id):
            return err
        advisor = db.get_or_404(Advisor, advisor_id)
        gate = _require_subscription(advisor)
        if gate:
            return gate
        body = request.get_json(silent=True) or {}
        days_back = body.get("days_back", 7)

        try:
            new_alerts = scan_and_analyze_filings(advisor_id, app, days_back=days_back)
            return jsonify({"new_alerts": len(new_alerts), "alerts": new_alerts})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    # ── Price Alerts (Watchlist) ──────────────────────────────────────────────

    @app.route("/api/advisors/<int:advisor_id>/price-alerts", methods=["GET"])
    def get_price_alerts(advisor_id):
        if err := _assert_own(advisor_id):
            return err
        alerts = (
            PriceAlert.query.filter_by(advisor_id=advisor_id)
            .order_by(PriceAlert.created_at.desc())
            .all()
        )
        return jsonify([a.to_dict() for a in alerts])

    @app.route("/api/advisors/<int:advisor_id>/price-alerts", methods=["POST"])
    def create_price_alert(advisor_id):
        if err := _assert_own(advisor_id):
            return err
        data = request.get_json()
        if not all(k in data for k in ("ticker", "alert_type", "threshold")):
            return jsonify(
                {"error": "ticker, alert_type, and threshold are required"}
            ), 400
        if data["alert_type"] not in ("above", "below", "pct_day"):
            return jsonify(
                {"error": "alert_type must be above, below, or pct_day"}
            ), 400
        alert = PriceAlert(
            advisor_id=advisor_id,
            ticker=data["ticker"].upper().strip(),
            alert_type=data["alert_type"],
            threshold=data["threshold"],
        )
        db.session.add(alert)
        db.session.commit()
        return jsonify(alert.to_dict()), 201

    @app.route(
        "/api/advisors/<int:advisor_id>/price-alerts/<int:alert_id>", methods=["DELETE"]
    )
    def delete_price_alert(advisor_id, alert_id):
        if err := _assert_own(advisor_id):
            return err
        alert = PriceAlert.query.filter_by(
            id=alert_id, advisor_id=advisor_id
        ).first_or_404()
        db.session.delete(alert)
        db.session.commit()
        return jsonify({"ok": True})

    @app.route("/api/price-alerts/<int:alert_id>/read", methods=["PATCH"])
    def mark_price_alert_read(alert_id):
        alert = db.get_or_404(PriceAlert, alert_id)
        if err := _assert_own(alert.advisor_id):
            return err
        alert.read = True
        db.session.commit()
        return jsonify(alert.to_dict())

    @app.route(
        "/api/advisors/<int:advisor_id>/price-alerts/mark-all-read", methods=["POST"]
    )
    def mark_all_price_alerts_read(advisor_id):
        if err := _assert_own(advisor_id):
            return err
        PriceAlert.query.filter_by(
            advisor_id=advisor_id, active=False, read=False
        ).update({"read": True})
        db.session.commit()
        return jsonify({"ok": True})

    @app.route("/api/price-alerts/<int:alert_id>/reactivate", methods=["POST"])
    def reactivate_price_alert(alert_id):
        alert = db.get_or_404(PriceAlert, alert_id)
        if err := _assert_own(alert.advisor_id):
            return err
        if alert.active:
            return jsonify({"error": "Alert is already active"}), 400
        alert.active = True
        alert.triggered_at = None
        alert.triggered_price = None
        alert.read = True
        db.session.commit()
        return jsonify(alert.to_dict())

    # ── Client Email Generation ───────────────────────────────────────────────

    @app.route("/api/advisors/<int:advisor_id>/generate-client-email", methods=["POST"])
    def generate_email(advisor_id):
        if err := _assert_own(advisor_id):
            return err
        advisor = db.get_or_404(Advisor, advisor_id)
        gate = _require_subscription(advisor)
        if gate:
            return gate
        data = request.get_json()

        if not data or not data.get("ticker") or not data.get("trigger_event"):
            return jsonify({"error": "ticker and trigger_event are required"}), 400

        ticker = data["ticker"].upper().strip()
        trigger_event = data["trigger_event"]
        company_name = data.get("company_name", ticker)
        position_size = 0.0

        holding = Holding.query.filter_by(advisor_id=advisor_id, ticker=ticker).first()
        if holding:
            position_size = float(holding.position_size)

        try:
            draft = generate_client_email(
                advisor_name=advisor.name,
                firm_name=advisor.firm_name,
                ticker=ticker,
                company_name=company_name,
                trigger_event=trigger_event,
                position_size=position_size,
            )
        except Exception as e:
            return jsonify({"error": str(e)}), 500

        from datetime import datetime, timezone

        email = ClientEmail(
            advisor_id=advisor_id,
            ticker=ticker,
            trigger_event=trigger_event,
            draft_content=draft,
            sent=False,
            created_at=datetime.now(timezone.utc),
        )
        db.session.add(email)
        db.session.commit()

        return jsonify(email.to_dict()), 201

    # ── Demo Mode ─────────────────────────────────────────────────────────────

    @app.route("/api/demo/generate", methods=["POST"])
    def demo_generate():
        data = request.get_json()
        if not data or not data.get("tickers"):
            return jsonify({"error": "tickers required"}), 400

        raw = data["tickers"]
        if isinstance(raw, str):
            tickers = [t.strip().upper() for t in raw.split(",") if t.strip()]
        else:
            tickers = [t.strip().upper() for t in raw if t.strip()]

        if not tickers:
            return jsonify({"error": "Enter at least one ticker"}), 400
        if len(tickers) > 10:
            return jsonify({"error": "Enter up to 10 tickers"}), 400

        holdings_data = [{"ticker": t, "position_size": 100000} for t in tickers]

        try:
            content = generate_morning_briefing(
                advisor_name="Your Portfolio",
                firm_name="Demo",
                holdings=holdings_data,
                days_back_filings=3,
            )
            return jsonify({"briefing": content, "tickers": tickers})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    # ── Stripe ────────────────────────────────────────────────────────────────

    @app.route("/api/stripe/create-checkout", methods=["POST"])
    def create_checkout():
        import stripe

        stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
        data = request.get_json() or {}
        advisor_id = data.get("advisor_id")
        if not advisor_id:
            return jsonify({"error": "advisor_id required"}), 400
        advisor = db.get_or_404(Advisor, advisor_id)
        app_url = os.getenv("APP_URL", "http://localhost:3000")

        # Create or reuse Stripe customer
        if not advisor.stripe_customer_id:
            customer = stripe.Customer.create(
                email=advisor.email,
                name=advisor.name,
                metadata={"advisor_id": advisor.id, "firm_name": advisor.firm_name},
            )
            advisor.stripe_customer_id = customer.id
            db.session.commit()

        annual = bool(data.get("annual"))
        price_id = (
            os.getenv("STRIPE_ANNUAL_PRICE_ID")
            if annual
            else os.getenv("STRIPE_PRICE_ID")
        )
        session = stripe.checkout.Session.create(
            customer=advisor.stripe_customer_id,
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            mode="subscription",
            subscription_data={"trial_period_days": 14},
            success_url=f"{app_url}/?checkout=success",
            cancel_url=f"{app_url}/?checkout=canceled",
            allow_promotion_codes=True,
        )
        return jsonify({"url": session.url})

    @app.route("/api/stripe/create-portal", methods=["POST"])
    def create_portal():
        import stripe

        stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
        data = request.get_json() or {}
        advisor_id = data.get("advisor_id")
        if not advisor_id:
            return jsonify({"error": "advisor_id required"}), 400
        advisor = db.get_or_404(Advisor, advisor_id)
        if not advisor.stripe_customer_id:
            return jsonify({"error": "No billing account found"}), 400
        app_url = os.getenv("APP_URL", "http://localhost:3000")
        session = stripe.billing_portal.Session.create(
            customer=advisor.stripe_customer_id,
            return_url=f"{app_url}/",
        )
        return jsonify({"url": session.url})

    @app.route("/api/stripe/webhook", methods=["POST"])
    def stripe_webhook():
        import stripe

        stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
        webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
        payload = request.get_data()
        sig = request.headers.get("Stripe-Signature")
        if webhook_secret:
            try:
                event = stripe.Webhook.construct_event(payload, sig, webhook_secret)
            except Exception as e:
                logging.warning(f"Stripe webhook signature rejected: {e}")
                return jsonify({"error": "Invalid signature"}), 400
        else:
            import json

            try:
                event = json.loads(payload)
            except Exception:
                return jsonify({"error": "Invalid payload"}), 400

        obj = event["data"]["object"]

        def _sg(o, key, default=None):
            try:
                v = o[key]
                return v if v is not None else default
            except Exception:
                return getattr(o, key, default)

        if event["type"] == "checkout.session.completed":
            sub_id = _sg(obj, "subscription")
            customer_id = _sg(obj, "customer")
            if sub_id and customer_id:
                advisor = Advisor.query.filter_by(
                    stripe_customer_id=customer_id
                ).first()
                if advisor:
                    sub = stripe.Subscription.retrieve(sub_id)  # type: ignore
                    advisor.stripe_subscription_id = sub_id
                    advisor.subscription_status = sub.status
                    trial_end = getattr(sub, "trial_end", None)
                    if trial_end:
                        from datetime import datetime, timezone

                        advisor.trial_ends_at = datetime.fromtimestamp(
                            trial_end, tz=timezone.utc
                        )
                    db.session.commit()

        elif event["type"] in (
            "customer.subscription.updated",
            "customer.subscription.deleted",
        ):
            customer_id = _sg(obj, "customer")
            advisor = Advisor.query.filter_by(stripe_customer_id=customer_id).first()
            if advisor:
                advisor.subscription_status = _sg(obj, "status")
                advisor.stripe_subscription_id = _sg(obj, "id")
                trial_end = _sg(obj, "trial_end")
                if trial_end:
                    from datetime import datetime, timezone

                    advisor.trial_ends_at = datetime.fromtimestamp(
                        trial_end, tz=timezone.utc
                    )
                db.session.commit()

        elif event["type"] == "invoice.payment_failed":
            customer_id = _sg(obj, "customer")
            advisor = Advisor.query.filter_by(stripe_customer_id=customer_id).first()
            if advisor:
                advisor.subscription_status = "past_due"
                db.session.commit()
                app_url = os.getenv("APP_URL", "http://localhost:3000")
                send_payment_failed_email(advisor.email, advisor.name, app_url)

        return jsonify({"received": True})

    # ── Admin ─────────────────────────────────────────────────────────────────

    def _require_admin():
        if not g.advisor.is_admin():
            return None, (jsonify({"error": "Unauthorized"}), 403)
        return g.advisor, None

    @app.route("/api/admin/stats")
    def admin_stats():
        _, err = _require_admin()
        if err:
            return err
        from datetime import datetime, timezone, timedelta

        advisors = Advisor.query.all()
        active = sum(1 for a in advisors if a.subscription_status == "active")
        trialing = sum(1 for a in advisors if a.subscription_status == "trialing")
        legacy = sum(1 for a in advisors if a.is_legacy())
        past_due = sum(1 for a in advisors if a.subscription_status == "past_due")
        canceled = sum(1 for a in advisors if a.subscription_status == "canceled")
        # Signup trend: signups per day for the last 30 days
        now = datetime.now(timezone.utc)
        trend = {}
        for i in range(29, -1, -1):
            d = (now - timedelta(days=i)).strftime("%Y-%m-%d")
            trend[d] = 0
        for a in advisors:
            if a.created_at:
                d = a.created_at.strftime("%Y-%m-%d")
                if d in trend:
                    trend[d] += 1
        return jsonify(
            {
                "total_users": len(advisors),
                "active": active,
                "trialing": trialing,
                "legacy": legacy,
                "past_due": past_due,
                "canceled": canceled,
                "mrr": active * 299,
                "arr": active * 299 * 12,
                "total_briefings": Briefing.query.count(),
                "total_alerts": FilingAlert.query.count(),
                "total_emails": ClientEmail.query.count(),
                "signup_trend": [{"date": d, "count": c} for d, c in trend.items()],
            }
        )

    @app.route("/api/admin/advisors")
    def admin_list_advisors():
        _, err = _require_admin()
        if err:
            return err
        advisors = Advisor.query.order_by(Advisor.created_at.desc()).all()
        result = []
        for a in advisors:
            last = (
                Briefing.query.filter_by(advisor_id=a.id)
                .order_by(Briefing.generated_at.desc())
                .first()
            )
            d = a.to_dict()
            d["briefing_count"] = Briefing.query.filter_by(advisor_id=a.id).count()
            d["holding_count"] = Holding.query.filter_by(advisor_id=a.id).count()
            d["last_briefing_at"] = last.generated_at.isoformat() if last else None
            result.append(d)
        return jsonify(result)

    @app.route(
        "/api/admin/advisors/<int:target_id>/generate-briefing", methods=["POST"]
    )
    def admin_generate_briefing_for(target_id):
        _, err = _require_admin()
        if err:
            return err
        target = db.get_or_404(Advisor, target_id)
        holdings = Holding.query.filter_by(advisor_id=target_id).all()
        if not holdings:
            return jsonify({"error": "User has no holdings"}), 400
        try:
            from intelligence.briefing import generate_and_save_briefing

            briefing_dict = generate_and_save_briefing(target_id, app)
            return jsonify({"status": "generated", "briefing_id": briefing_dict["id"]})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route("/api/admin/advisors/<int:target_id>/grant-legacy", methods=["PATCH"])
    def admin_grant_legacy(target_id):
        _, err = _require_admin()
        if err:
            return err
        target = db.get_or_404(Advisor, target_id)
        if target.is_legacy():
            target.email_verified = True  # revoke legacy
        else:
            target.email_verified = None  # grant legacy
            # Cancel the Stripe subscription so the card is never charged
            if target.stripe_subscription_id:
                try:
                    import stripe
                    stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
                    stripe.Subscription.cancel(target.stripe_subscription_id)
                except Exception as e:
                    logging.warning(f"Could not cancel Stripe sub for legacy user {target_id}: {e}")
            target.subscription_status = None
            target.stripe_subscription_id = None
        db.session.commit()
        return jsonify(target.to_dict())

    @app.route("/api/admin/advisors/<int:target_id>/sync-stripe", methods=["POST"])
    def admin_sync_stripe(target_id):
        _, err = _require_admin()
        if err:
            return err
        import stripe

        stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
        target = db.get_or_404(Advisor, target_id)
        if not target.stripe_subscription_id:
            return jsonify({"error": "No Stripe subscription on this account"}), 400
        try:
            sub = stripe.Subscription.retrieve(target.stripe_subscription_id)
            target.subscription_status = sub["status"]
            if sub.get("trial_end"):
                from datetime import datetime, timezone

                target.trial_ends_at = datetime.fromtimestamp(
                    sub["trial_end"], tz=timezone.utc
                )
            db.session.commit()
            return jsonify(target.to_dict())
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route("/api/admin/advisors/<int:target_id>", methods=["DELETE"])
    def admin_delete_advisor(target_id):
        _, err = _require_admin()
        if err:
            return err
        target = db.get_or_404(Advisor, target_id)
        db.session.delete(target)
        db.session.commit()
        return jsonify({"deleted": target_id})

    @app.route("/api/admin/run-morning-jobs", methods=["POST"])
    def trigger_morning_jobs():
        _, err = _require_admin()
        if err:
            return err
        try:
            run_morning_jobs(app)
            return jsonify({"status": "done"})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    # Serve React app for all non-API routes (must be the last route)
    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_react(path):
        if path.startswith("api/"):
            return jsonify({"error": "Not found"}), 404
        full_path = os.path.join(static_dir, path)
        if path and os.path.isfile(full_path):
            return send_from_directory(static_dir, path)
        index = os.path.join(static_dir, "index.html")
        if os.path.isfile(index):
            return send_from_directory(static_dir, "index.html")
        return jsonify({"message": "VeloQuant API"}), 200

    # Start scheduler once (guard against Flask reloader double-start)
    if not app.debug or os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        start_scheduler(app)

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
