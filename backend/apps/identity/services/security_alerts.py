"""
Security alerts (TPN review TM-011).

Looks at the last window of login attempts and security events and reports what an operator should
see: a spike of failed logins, many failures from one address, lockouts, and privileged changes
(role or permission changes, MFA removed, users deleted, anything marked critical or suspicious).

Each alert is a structured ``security_alert`` log line, so any log collector can route it, and, when
``SECURITY_ALERT_EMAILS`` is set, one summary email with counts only (no addresses or names). Run hourly
by Celery beat (``identity.security_alerts``) or by ``manage.py security_alerts``.

Thresholds are Django settings with the defaults below.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.conf import settings
from django.core.mail import send_mail
from django.db.models import Count
from django.utils import timezone

from apps.core.logging.logger import get_logger
from apps.identity.choices import SecurityEventType
from apps.identity.models import LoginAttempt, SecurityEvent

logger = get_logger("security_alerts")

DEFAULT_WINDOW_MINUTES = 60
DEFAULT_FAILED_LOGINS = 50
DEFAULT_FAILED_LOGINS_ONE_ADDRESS = 20
DEFAULT_LOCKOUTS = 5

LOCKOUT_EVENTS = (
    SecurityEventType.ACCOUNT_LOCKED,
    SecurityEventType.LOGIN_LOCKED,
    SecurityEventType.MFA_LOCKED,
)

# Changes to who can do what, or to the protection of an account. Any occurrence is reported.
PRIVILEGED_EVENTS = (
    SecurityEventType.ROLE_CHANGED,
    SecurityEventType.PERMISSION_CHANGED,
    SecurityEventType.MFA_DISABLED,
    SecurityEventType.USER_DELETED,
    SecurityEventType.IP_BLOCKED,
    SecurityEventType.SUSPICIOUS_ACTIVITY,
)


def _setting(name: str, default: int) -> int:
    return int(getattr(settings, name, default) or default)


def evaluate(*, window_minutes: int | None = None, now: Any = None) -> list[dict[str, Any]]:
    """The alerts for the window ending ``now``; each is ``{"rule", "count", ...}``."""
    now = now or timezone.now()
    window = window_minutes or _setting("SECURITY_ALERT_WINDOW_MINUTES", DEFAULT_WINDOW_MINUTES)
    since = now - timedelta(minutes=window)
    alerts: list[dict[str, Any]] = []

    failures = LoginAttempt.objects.filter(
        success=False, attempted_at__gte=since, attempted_at__lte=now
    )

    total = failures.count()
    if total >= _setting("SECURITY_ALERT_FAILED_LOGINS", DEFAULT_FAILED_LOGINS):
        alerts.append({"rule": "failed_login_spike", "count": total})

    per_address = _setting(
        "SECURITY_ALERT_FAILED_LOGINS_ONE_ADDRESS", DEFAULT_FAILED_LOGINS_ONE_ADDRESS
    )
    noisy = (
        failures.values("ip_address")
        .annotate(n=Count("id"))
        .filter(n__gte=per_address)
        .order_by("-n")[:5]
    )
    for row in noisy:
        alerts.append(
            {
                "rule": "failed_logins_one_address",
                "count": row["n"],
                "ip_address": row["ip_address"],
            }
        )

    events = SecurityEvent.objects.filter(occurred_at__gte=since, occurred_at__lte=now)

    lockouts = events.filter(event_type__in=LOCKOUT_EVENTS).count()
    if lockouts >= _setting("SECURITY_ALERT_LOCKOUTS", DEFAULT_LOCKOUTS):
        alerts.append({"rule": "lockouts", "count": lockouts})

    privileged = (
        events.filter(event_type__in=PRIVILEGED_EVENTS)
        .values("event_type")
        .annotate(n=Count("id"))
        .order_by("event_type")
    )
    for row in privileged:
        alerts.append(
            {"rule": "privileged_change", "event_type": row["event_type"], "count": row["n"]}
        )

    critical = events.filter(is_critical=True).exclude(event_type__in=PRIVILEGED_EVENTS).count()
    if critical:
        alerts.append({"rule": "critical_events", "count": critical})

    return alerts


def run(*, window_minutes: int | None = None, send_email: bool = True) -> list[dict[str, Any]]:
    """Evaluate, log every alert, and email a summary when addresses are configured."""
    window = window_minutes or _setting("SECURITY_ALERT_WINDOW_MINUTES", DEFAULT_WINDOW_MINUTES)
    alerts = evaluate(window_minutes=window)

    for alert in alerts:
        logger.warning("security_alert", window_minutes=window, **alert)

    recipients = [r for r in getattr(settings, "SECURITY_ALERT_EMAILS", ()) if r]
    if alerts and recipients and send_email:
        lines = [
            f"- {a['rule']}"
            + (f" ({a['event_type']})" if "event_type" in a else "")
            + f": {a['count']}"
            for a in alerts
        ]
        try:
            send_mail(
                subject=f"[StudioHub] {len(alerts)} security alert(s) in the last {window} minutes",
                message="\n".join(
                    [
                        f"Security alerts for the last {window} minutes:",
                        *lines,
                        "",
                        "Details are in the application log (event: security_alert).",
                    ]
                ),
                from_email=None,
                recipient_list=recipients,
            )
        except Exception:  # noqa: BLE001 - alerting must never break the schedule
            logger.exception("security_alert_email_failed")

    return alerts
