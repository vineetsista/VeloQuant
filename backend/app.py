import os
import logging
logging.basicConfig(level=logging.INFO)
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_migrate import Migrate
from dotenv import load_dotenv
from models import db, Advisor, Holding, Briefing, FilingAlert, ClientEmail
from data.edgar import get_recent_filings, get_cik
from data.polygon import get_portfolio_market_data, get_overnight_change, get_prices_batch
from intelligence.briefing import generate_morning_briefing
from intelligence.filing_analyzer import scan_and_analyze_filings
from intelligence.email_generator import generate_client_email
from scheduler import start_scheduler, run_morning_jobs
from email_delivery import send_verification_email, send_password_reset_email

load_dotenv()


def create_app():
    static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')
    app = Flask(__name__, static_folder=static_dir, static_url_path='')

    # Railway provides DATABASE_URL as postgres:// — SQLAlchemy needs postgresql://
    database_url = os.getenv("DATABASE_URL", "postgresql://localhost/ria_intelligence")
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    CORS(app)
    db.init_app(app)
    Migrate(app, db)

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
    def create_advisor():
        data = request.get_json()
        if not all(k in data for k in ("name", "firm_name", "email")):
            return jsonify({"error": "name, firm_name, and email are required"}), 400

        if Advisor.query.filter_by(email=data["email"]).first():
            return jsonify({"error": "Email already registered"}), 409

        advisor = Advisor(name=data["name"], firm_name=data["firm_name"], email=data["email"])
        if data.get("password"):
            advisor.set_password(data["password"])
        token = advisor.generate_verification_token()
        db.session.add(advisor)
        db.session.commit()
        app_url = os.getenv("APP_URL", "http://localhost:3000")
        send_verification_email(advisor.email, advisor.name, token, app_url)
        return jsonify(advisor.to_dict()), 201

    @app.route("/api/advisors/<int:advisor_id>")
    def get_advisor(advisor_id):
        advisor = db.get_or_404(Advisor, advisor_id)
        return jsonify(advisor.to_dict())

    @app.route("/api/advisors/by-email", methods=["POST"])
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
        return jsonify(advisor.to_dict())

    # ── Email Verification ────────────────────────────────────────────────────

    @app.route("/api/verify-email/<token>", methods=["POST"])
    def verify_email(token):
        advisor = Advisor.query.filter_by(verification_token=token).first()
        if not advisor:
            return jsonify({"error": "Invalid or expired verification link"}), 400
        advisor.email_verified = True
        advisor.verification_token = None
        db.session.commit()
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
        return jsonify({"message": "If that account exists and is unverified, a new email was sent"})

    @app.route("/api/forgot-password", methods=["POST"])
    def forgot_password():
        data = request.get_json() or {}
        email = data.get("email", "").strip().lower()
        advisor = Advisor.query.filter_by(email=email).first()
        if advisor:
            token = advisor.generate_reset_token()
            db.session.commit()
            app_url = os.getenv("APP_URL", "http://localhost:3000")
            send_password_reset_email(advisor.email, advisor.name, token, app_url)
        return jsonify({"message": "If that email is registered, a reset link was sent"})

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
        if advisor.reset_token_expires and advisor.reset_token_expires < datetime.now(timezone.utc):
            return jsonify({"error": "Reset link has expired. Please request a new one"}), 400
        advisor.set_password(new_password)
        advisor.reset_token = None
        advisor.reset_token_expires = None
        db.session.commit()
        return jsonify({"message": "Password updated successfully"})

    def _require_subscription(advisor):
        """Return a 402 error response if advisor has no active subscription, else None."""
        if advisor.is_legacy():
            return None  # legacy accounts always pass
        if advisor.is_subscribed():
            return None
        return jsonify({
            "error": "subscription_required",
            "message": "Your free trial has ended. Please subscribe to continue.",
        }), 402

    # ── Holdings ──────────────────────────────────────────────────────────────

    @app.route("/api/advisors/<int:advisor_id>/holdings", methods=["GET"])
    def get_holdings(advisor_id):
        db.get_or_404(Advisor, advisor_id)
        holdings = Holding.query.filter_by(advisor_id=advisor_id).all()
        return jsonify([h.to_dict() for h in holdings])

    @app.route("/api/advisors/<int:advisor_id>/holdings", methods=["POST"])
    def add_holding(advisor_id):
        db.get_or_404(Advisor, advisor_id)
        data = request.get_json()
        if not all(k in data for k in ("ticker", "position_size")):
            return jsonify({"error": "ticker and position_size are required"}), 400

        ticker = data["ticker"].upper().strip()
        existing = Holding.query.filter_by(advisor_id=advisor_id, ticker=ticker).first()
        if existing:
            existing.position_size = data["position_size"]
            db.session.commit()
            return jsonify(existing.to_dict())

        holding = Holding(advisor_id=advisor_id, ticker=ticker, position_size=data["position_size"])
        db.session.add(holding)
        db.session.commit()
        return jsonify(holding.to_dict()), 201

    @app.route("/api/advisors/<int:advisor_id>/holdings/<int:holding_id>", methods=["DELETE"])
    def delete_holding(advisor_id, holding_id):
        holding = Holding.query.filter_by(id=holding_id, advisor_id=advisor_id).first_or_404()
        db.session.delete(holding)
        db.session.commit()
        return jsonify({"deleted": holding_id})

    # ── Briefings ─────────────────────────────────────────────────────────────

    @app.route("/api/advisors/<int:advisor_id>/briefings")
    def get_briefings(advisor_id):
        db.get_or_404(Advisor, advisor_id)
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
        db.get_or_404(Advisor, advisor_id)
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
        db.session.delete(briefing)
        db.session.commit()
        return jsonify({"deleted": briefing_id})

    @app.route("/api/briefings/<int:briefing_id>/send", methods=["POST"])
    def send_briefing_on_demand(briefing_id):
        briefing = db.get_or_404(Briefing, briefing_id)
        advisor = db.get_or_404(Advisor, briefing.advisor_id)
        success = send_briefing_email(advisor.email, advisor.name, advisor.firm_name, briefing.content)
        if success:
            briefing.delivered = True
            db.session.commit()
            return jsonify(briefing.to_dict())
        return jsonify({"error": "Failed to send email. Check SendGrid configuration."}), 500

    # ── Filing Alerts ─────────────────────────────────────────────────────────

    @app.route("/api/advisors/<int:advisor_id>/filing-alerts")
    def get_filing_alerts(advisor_id):
        db.get_or_404(Advisor, advisor_id)
        unread_only = request.args.get("unread", "false").lower() == "true"
        query = FilingAlert.query.filter_by(advisor_id=advisor_id)
        if unread_only:
            query = query.filter_by(read=False)
        alerts = query.order_by(FilingAlert.filing_date.desc()).all()
        return jsonify([a.to_dict() for a in alerts])

    @app.route("/api/filing-alerts/<int:alert_id>/read", methods=["PATCH"])
    def mark_alert_read(alert_id):
        alert = db.get_or_404(FilingAlert, alert_id)
        alert.read = True
        db.session.commit()
        return jsonify(alert.to_dict())

    # ── Client Emails ─────────────────────────────────────────────────────────

    @app.route("/api/advisors/<int:advisor_id>/client-emails")
    def get_client_emails(advisor_id):
        db.get_or_404(Advisor, advisor_id)
        unsent_only = request.args.get("unsent", "false").lower() == "true"
        query = ClientEmail.query.filter_by(advisor_id=advisor_id)
        if unsent_only:
            query = query.filter_by(sent=False)
        emails = query.order_by(ClientEmail.created_at.desc()).all()
        return jsonify([e.to_dict() for e in emails])

    @app.route("/api/client-emails/<int:email_id>/send", methods=["PATCH"])
    def mark_email_sent(email_id):
        email = db.get_or_404(ClientEmail, email_id)
        email.sent = True
        db.session.commit()
        return jsonify(email.to_dict())

    # ── EDGAR (test) ──────────────────────────────────────────────────────────

    @app.route("/api/advisors/<int:advisor_id>/scan-filings")
    def scan_filings(advisor_id):
        advisor = db.get_or_404(Advisor, advisor_id)
        days_back = request.args.get("days", 7, type=int)
        holdings = Holding.query.filter_by(advisor_id=advisor_id).all()
        tickers = [h.ticker for h in holdings]

        results = []
        for ticker in tickers:
            filings = get_recent_filings(ticker, days_back=days_back)
            results.extend(filings)

        return jsonify({"advisor": advisor.name, "tickers": tickers, "filings_found": len(results), "filings": results})

    @app.route("/api/edgar/cik/<ticker>")
    def lookup_cik(ticker):
        cik = get_cik(ticker.upper())
        if not cik:
            return jsonify({"error": f"No CIK found for {ticker.upper()}"}), 404
        return jsonify({"ticker": ticker.upper(), "cik": cik})

    # ── Profile Update ────────────────────────────────────────────────────────

    @app.route("/api/advisors/<int:advisor_id>/profile", methods=["PATCH"])
    def update_profile(advisor_id):
        advisor = db.get_or_404(Advisor, advisor_id)
        data = request.get_json() or {}
        if "name" in data and data["name"].strip():
            advisor.name = data["name"].strip()
        if "firm_name" in data and data["firm_name"].strip():
            advisor.firm_name = data["firm_name"].strip()
        db.session.commit()
        return jsonify(advisor.to_dict())

    @app.route("/api/advisors/<int:advisor_id>/change-password", methods=["POST"])
    def change_password(advisor_id):
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

    @app.route("/api/advisors/<int:advisor_id>", methods=["DELETE"])
    def delete_advisor(advisor_id):
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
        db.get_or_404(Advisor, advisor_id)
        holdings = Holding.query.filter_by(advisor_id=advisor_id).all()
        tickers = [h.ticker for h in holdings]
        try:
            data = get_portfolio_market_data(tickers)
            return jsonify(data)
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route("/api/market/indices")
    def get_market_indices():
        # Prices only — no news — and cached for 15 min so repeated page
        # loads don't blast the Polygon rate limit.
        indices = ["SPY", "QQQ", "DIA", "IWM", "TLT", "GLD", "VIX"]
        try:
            data = get_prices_batch(indices)
            return jsonify(data)
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    # ── Briefing Generation ───────────────────────────────────────────────────

    @app.route("/api/advisors/<int:advisor_id>/generate-briefing", methods=["POST"])
    def generate_briefing(advisor_id):
        advisor = db.get_or_404(Advisor, advisor_id)
        gate = _require_subscription(advisor)
        if gate:
            return gate
        holdings = Holding.query.filter_by(advisor_id=advisor_id).all()
        if not holdings:
            return jsonify({"error": "No holdings found — add holdings before generating a briefing"}), 400

        days_back = request.get_json(silent=True) or {}
        days_back_filings = days_back.get("days_back_filings", 1)

        holdings_data = [
            {"ticker": h.ticker, "position_size": float(h.position_size)}
            for h in holdings
        ]

        try:
            content = generate_morning_briefing(
                advisor.name, advisor.firm_name, holdings_data, days_back_filings
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

        return jsonify(briefing.to_dict()), 201

    # ── Filing Analysis ───────────────────────────────────────────────────────

    @app.route("/api/advisors/<int:advisor_id>/analyze-filings", methods=["POST"])
    def analyze_filings(advisor_id):
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

    # ── Client Email Generation ───────────────────────────────────────────────

    @app.route("/api/advisors/<int:advisor_id>/generate-client-email", methods=["POST"])
    def generate_email(advisor_id):
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

        session = stripe.checkout.Session.create(
            customer=advisor.stripe_customer_id,
            payment_method_types=["card"],
            line_items=[{"price": os.getenv("STRIPE_PRICE_ID"), "quantity": 1}],
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
        try:
            event = stripe.Webhook.construct_event(payload, sig, webhook_secret)
        except Exception:
            return jsonify({"error": "Invalid signature"}), 400

        obj = event["data"]["object"]

        if event["type"] == "checkout.session.completed":
            sub_id = obj.get("subscription")
            customer_id = obj.get("customer")
            if sub_id and customer_id:
                advisor = Advisor.query.filter_by(stripe_customer_id=customer_id).first()
                if advisor:
                    sub = stripe.Subscription.retrieve(sub_id)  # type: ignore
                    advisor.stripe_subscription_id = sub_id
                    advisor.subscription_status = sub["status"]
                    if sub.get("trial_end"):
                        from datetime import datetime, timezone
                        advisor.trial_ends_at = datetime.fromtimestamp(sub["trial_end"], tz=timezone.utc)
                    db.session.commit()

        elif event["type"] in ("customer.subscription.updated", "customer.subscription.deleted"):
            customer_id = obj.get("customer")
            advisor = Advisor.query.filter_by(stripe_customer_id=customer_id).first()
            if advisor:
                advisor.subscription_status = obj.get("status")
                advisor.stripe_subscription_id = obj.get("id")
                if obj.get("trial_end"):
                    from datetime import datetime, timezone
                    advisor.trial_ends_at = datetime.fromtimestamp(obj["trial_end"], tz=timezone.utc)
                db.session.commit()

        elif event["type"] == "invoice.payment_failed":
            customer_id = obj.get("customer")
            advisor = Advisor.query.filter_by(stripe_customer_id=customer_id).first()
            if advisor:
                advisor.subscription_status = "past_due"
                db.session.commit()

        return jsonify({"received": True})

    # ── Admin ─────────────────────────────────────────────────────────────────

    def _require_admin():
        advisor_id = request.args.get('advisor_id') or (request.get_json(silent=True) or {}).get('advisor_id')
        if not advisor_id:
            return None, (jsonify({"error": "Unauthorized"}), 403)
        admin = Advisor.query.get(int(advisor_id))
        if not admin or not admin.is_admin():
            return None, (jsonify({"error": "Unauthorized"}), 403)
        return admin, None

    @app.route("/api/admin/stats")
    def admin_stats():
        _, err = _require_admin()
        if err: return err
        advisors = Advisor.query.all()
        active   = sum(1 for a in advisors if a.subscription_status == 'active')
        trialing = sum(1 for a in advisors if a.subscription_status == 'trialing')
        legacy   = sum(1 for a in advisors if a.is_legacy())
        past_due = sum(1 for a in advisors if a.subscription_status == 'past_due')
        canceled = sum(1 for a in advisors if a.subscription_status == 'canceled')
        return jsonify({
            "total_users":      len(advisors),
            "active":           active,
            "trialing":         trialing,
            "legacy":           legacy,
            "past_due":         past_due,
            "canceled":         canceled,
            "mrr":              active * 299,
            "arr":              active * 299 * 12,
            "total_briefings":  Briefing.query.count(),
            "total_alerts":     FilingAlert.query.count(),
            "total_emails":     ClientEmail.query.count(),
        })

    @app.route("/api/admin/advisors")
    def admin_list_advisors():
        _, err = _require_admin()
        if err: return err
        advisors = Advisor.query.order_by(Advisor.created_at.desc()).all()
        result = []
        for a in advisors:
            last = (Briefing.query.filter_by(advisor_id=a.id)
                    .order_by(Briefing.generated_at.desc()).first())
            d = a.to_dict()
            d['briefing_count'] = Briefing.query.filter_by(advisor_id=a.id).count()
            d['holding_count']  = Holding.query.filter_by(advisor_id=a.id).count()
            d['last_briefing_at'] = last.generated_at.isoformat() if last else None
            result.append(d)
        return jsonify(result)

    @app.route("/api/admin/advisors/<int:target_id>/grant-legacy", methods=["PATCH"])
    def admin_grant_legacy(target_id):
        _, err = _require_admin()
        if err: return err
        target = db.get_or_404(Advisor, target_id)
        if target.is_legacy():
            target.email_verified = True   # revoke legacy
        else:
            target.email_verified = None   # grant legacy
            target.subscription_status = None
            target.stripe_subscription_id = None
        db.session.commit()
        return jsonify(target.to_dict())

    @app.route("/api/admin/advisors/<int:target_id>/sync-stripe", methods=["POST"])
    def admin_sync_stripe(target_id):
        _, err = _require_admin()
        if err: return err
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
                target.trial_ends_at = datetime.fromtimestamp(sub["trial_end"], tz=timezone.utc)
            db.session.commit()
            return jsonify(target.to_dict())
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route("/api/admin/advisors/<int:target_id>", methods=["DELETE"])
    def admin_delete_advisor(target_id):
        _, err = _require_admin()
        if err: return err
        target = db.get_or_404(Advisor, target_id)
        db.session.delete(target)
        db.session.commit()
        return jsonify({"deleted": target_id})

    @app.route("/api/admin/run-morning-jobs", methods=["POST"])
    def trigger_morning_jobs():
        _, err = _require_admin()
        if err: return err
        try:
            run_morning_jobs(app)
            return jsonify({"status": "done"})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    # Serve React app for all non-API routes (must be the last route)
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_react(path):
        if path.startswith('api/'):
            return jsonify({"error": "Not found"}), 404
        full_path = os.path.join(static_dir, path)
        if path and os.path.isfile(full_path):
            return send_from_directory(static_dir, path)
        index = os.path.join(static_dir, 'index.html')
        if os.path.isfile(index):
            return send_from_directory(static_dir, 'index.html')
        return jsonify({"message": "RIA Intelligence API"}), 200

    # Start scheduler once (guard against Flask reloader double-start)
    if not app.debug or os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        start_scheduler(app)

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
