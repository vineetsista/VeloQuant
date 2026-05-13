import os
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()


class Advisor(db.Model):
    __tablename__ = "advisors"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    firm_name = db.Column(db.String(200), nullable=False)
    email = db.Column(db.String(200), nullable=False, unique=True)
    password_hash = db.Column(db.String(256), nullable=True)
    email_verified = db.Column(db.Boolean, nullable=True, default=None)
    verification_token = db.Column(db.String(100), nullable=True)
    reset_token = db.Column(db.String(100), nullable=True)
    reset_token_expires = db.Column(db.DateTime, nullable=True)
    stripe_customer_id = db.Column(db.String(100), nullable=True)
    stripe_subscription_id = db.Column(db.String(100), nullable=True)
    subscription_status = db.Column(db.String(50), nullable=True)  # trialing, active, past_due, canceled, unpaid
    trial_ends_at = db.Column(db.DateTime, nullable=True)
    briefing_email_enabled = db.Column(db.Boolean, nullable=False, default=True, server_default='true')
    api_key = db.Column(db.String(64), nullable=True, unique=True, index=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)

    def has_password(self):
        return self.password_hash is not None

    def generate_verification_token(self):
        self.verification_token = secrets.token_urlsafe(32)
        self.email_verified = False
        return self.verification_token

    def generate_reset_token(self):
        self.reset_token = secrets.token_urlsafe(32)
        self.reset_token_expires = datetime.now(timezone.utc) + timedelta(hours=1)
        return self.reset_token

    def ensure_api_key(self):
        if not self.api_key:
            self.api_key = uuid.uuid4().hex
        return self.api_key

    def is_legacy(self):
        return self.email_verified is None

    def is_admin(self):
        admin_email = os.getenv('ADMIN_EMAIL', '')
        return bool(admin_email) and self.email.lower() == admin_email.lower()

    def is_subscribed(self):
        return self.subscription_status in ('trialing', 'active')

    def trial_days_remaining(self):
        if self.subscription_status != 'trialing' or not self.trial_ends_at:
            return None
        delta = self.trial_ends_at.replace(tzinfo=timezone.utc) - datetime.now(timezone.utc)
        return max(0, delta.days)

    holdings = db.relationship("Holding", backref="advisor", lazy=True, cascade="all, delete-orphan")
    briefings = db.relationship("Briefing", backref="advisor", lazy=True, cascade="all, delete-orphan")
    filing_alerts = db.relationship("FilingAlert", backref="advisor", lazy=True, cascade="all, delete-orphan")
    client_emails = db.relationship("ClientEmail", backref="advisor", lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "firm_name": self.firm_name,
            "email": self.email,
            "email_verified": self.email_verified,
            "is_legacy": self.is_legacy(),
            "subscription_status": self.subscription_status,
            "trial_days_remaining": self.trial_days_remaining(),
            "is_subscribed": self.is_subscribed(),
            "is_admin": self.is_admin(),
            "briefing_email_enabled": self.briefing_email_enabled,
            "created_at": self.created_at.isoformat(),
        }


class Holding(db.Model):
    __tablename__ = "holdings"

    id = db.Column(db.Integer, primary_key=True)
    advisor_id = db.Column(db.Integer, db.ForeignKey("advisors.id"), nullable=False)
    ticker = db.Column(db.String(20), nullable=False)
    position_size = db.Column(db.Numeric(15, 2), nullable=False)
    added_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "advisor_id": self.advisor_id,
            "ticker": self.ticker.upper(),
            "position_size": float(self.position_size),
            "added_at": self.added_at.isoformat(),
        }


class Briefing(db.Model):
    __tablename__ = "briefings"

    id = db.Column(db.Integer, primary_key=True)
    advisor_id = db.Column(db.Integer, db.ForeignKey("advisors.id"), nullable=False)
    content = db.Column(db.Text, nullable=False)
    generated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    delivered = db.Column(db.Boolean, default=False, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "advisor_id": self.advisor_id,
            "content": self.content,
            "generated_at": self.generated_at.isoformat(),
            "delivered": self.delivered,
        }


class FilingAlert(db.Model):
    __tablename__ = "filing_alerts"

    id = db.Column(db.Integer, primary_key=True)
    advisor_id = db.Column(db.Integer, db.ForeignKey("advisors.id"), nullable=False)
    ticker = db.Column(db.String(20), nullable=False)
    filing_type = db.Column(db.String(20), nullable=False)  # 10-K, 10-Q, 8-K
    filing_date = db.Column(db.Date, nullable=False)
    key_insight = db.Column(db.Text, nullable=False)
    read = db.Column(db.Boolean, default=False, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "advisor_id": self.advisor_id,
            "ticker": self.ticker.upper(),
            "filing_type": self.filing_type,
            "filing_date": self.filing_date.isoformat(),
            "key_insight": self.key_insight,
            "read": self.read,
        }


class ClientEmail(db.Model):
    __tablename__ = "client_emails"

    id = db.Column(db.Integer, primary_key=True)
    advisor_id = db.Column(db.Integer, db.ForeignKey("advisors.id"), nullable=False)
    ticker = db.Column(db.String(20), nullable=False)
    trigger_event = db.Column(db.Text, nullable=False)
    draft_content = db.Column(db.Text, nullable=False)
    sent = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "advisor_id": self.advisor_id,
            "ticker": self.ticker.upper(),
            "trigger_event": self.trigger_event,
            "draft_content": self.draft_content,
            "sent": self.sent,
            "created_at": self.created_at.isoformat(),
        }
