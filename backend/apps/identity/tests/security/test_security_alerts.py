"""Security alerts (TPN review TM-011): spikes and privileged changes are reported."""

from __future__ import annotations

from datetime import timedelta
from io import StringIO

import pytest
from django.core import mail
from django.core.management import call_command
from django.utils import timezone

from apps.identity.choices import SecurityEventType
from apps.identity.models import LoginAttempt, SecurityEvent
from apps.identity.services import security_alerts
from apps.identity.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


def failed(ip="203.0.113.5", when=None, n=1):
    for _ in range(n):
        LoginAttempt.objects.create(
            username="someone", ip_address=ip, success=False, attempted_at=when or timezone.now()
        )


def event(kind, when=None, critical=False):
    return SecurityEvent.objects.create(
        event_type=kind, occurred_at=when or timezone.now(), is_critical=critical
    )


def rules(alerts):
    return sorted((a["rule"], a.get("event_type", ""), a["count"]) for a in alerts)


class TestRules:
    def test_a_quiet_system_raises_nothing(self):
        failed(n=3)
        event(SecurityEventType.LOGIN_SUCCESS)

        assert security_alerts.evaluate() == []

    def test_a_spike_of_failed_logins(self, settings):
        settings.SECURITY_ALERT_FAILED_LOGINS = 10
        for i in range(10):
            failed(ip=f"203.0.113.{i + 1}")

        assert [a["rule"] for a in security_alerts.evaluate()] == ["failed_login_spike"]

    def test_many_failures_from_one_address(self, settings):
        settings.SECURITY_ALERT_FAILED_LOGINS_ONE_ADDRESS = 5
        failed(ip="198.51.100.7", n=6)
        failed(ip="198.51.100.8", n=2)

        alerts = security_alerts.evaluate()

        assert rules(alerts) == [("failed_logins_one_address", "", 6)]
        assert alerts[0]["ip_address"] == "198.51.100.7"

    def test_lockouts(self, settings):
        settings.SECURITY_ALERT_LOCKOUTS = 2
        event(SecurityEventType.ACCOUNT_LOCKED)
        event(SecurityEventType.MFA_LOCKED)

        assert rules(security_alerts.evaluate()) == [("lockouts", "", 2)]

    @pytest.mark.parametrize(
        "kind",
        [
            SecurityEventType.ROLE_CHANGED,
            SecurityEventType.PERMISSION_CHANGED,
            SecurityEventType.MFA_DISABLED,
            SecurityEventType.USER_DELETED,
            SecurityEventType.SUSPICIOUS_ACTIVITY,
        ],
    )
    def test_any_privileged_change_is_reported(self, kind):
        event(kind)

        assert rules(security_alerts.evaluate()) == [("privileged_change", kind.value, 1)]

    def test_another_critical_event_is_reported_once(self):
        event(SecurityEventType.ACCOUNT_DEACTIVATED, critical=True)

        assert rules(security_alerts.evaluate()) == [("critical_events", "", 1)]

    def test_only_the_window_counts(self, settings):
        # Rows stamp themselves "now", so move the evaluation clock instead of the rows.
        settings.SECURITY_ALERT_FAILED_LOGINS = 3
        failed(n=5)
        event(SecurityEventType.ROLE_CHANGED)
        later = timezone.now() + timedelta(hours=3)

        assert security_alerts.evaluate(now=later) == []
        assert security_alerts.evaluate(now=later, window_minutes=300) != []

    def test_successful_logins_are_not_failures(self, settings):
        settings.SECURITY_ALERT_FAILED_LOGINS = 2
        for _ in range(5):
            LoginAttempt.objects.create(
                username="u", ip_address="203.0.113.9", success=True, attempted_at=timezone.now()
            )

        assert security_alerts.evaluate() == []


class TestDelivery:
    def test_alerts_are_logged_as_structured_lines(self, monkeypatch):
        logged = []
        monkeypatch.setattr(
            security_alerts.logger, "warning", lambda msg, **kw: logged.append((msg, kw))
        )
        event(SecurityEventType.ROLE_CHANGED)

        security_alerts.run()

        assert logged == [
            (
                "security_alert",
                {
                    "window_minutes": 60,
                    "rule": "privileged_change",
                    "event_type": "role_changed",
                    "count": 1,
                },
            )
        ]

    def test_a_summary_is_mailed_with_counts_only(self, settings):
        settings.SECURITY_ALERT_EMAILS = ("security@example.org",)
        settings.SECURITY_ALERT_FAILED_LOGINS_ONE_ADDRESS = 2
        failed(ip="198.51.100.7", n=3)

        security_alerts.run()

        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == ["security@example.org"]
        body = mail.outbox[0].body
        assert "failed_logins_one_address: 3" in body
        assert "198.51.100.7" not in body

    def test_no_mail_without_recipients(self, settings):
        settings.SECURITY_ALERT_EMAILS = ()
        event(SecurityEventType.ROLE_CHANGED)

        security_alerts.run()

        assert mail.outbox == []

    def test_no_mail_without_alerts(self, settings):
        settings.SECURITY_ALERT_EMAILS = ("security@example.org",)

        assert security_alerts.run() == []
        assert mail.outbox == []

    def test_a_mail_failure_does_not_stop_the_run(self, settings, monkeypatch):
        settings.SECURITY_ALERT_EMAILS = ("security@example.org",)
        event(SecurityEventType.ROLE_CHANGED)

        def boom(**kwargs):
            raise OSError("relay down")

        monkeypatch.setattr(security_alerts, "send_mail", boom)

        assert len(security_alerts.run()) == 1


class TestEntryPoints:
    def test_the_command_prints_and_dry_run_does_not_log(self, monkeypatch):
        logged = []
        monkeypatch.setattr(security_alerts.logger, "warning", lambda *a, **k: logged.append(1))
        event(SecurityEventType.MFA_DISABLED)
        out = StringIO()

        call_command("security_alerts", "--dry-run", stdout=out)

        assert "rule=privileged_change, event_type=mfa_disabled, count=1" in out.getvalue()
        assert "1 alert(s)." in out.getvalue()
        assert logged == []

    def test_the_task_and_schedule_exist(self, settings):
        from apps.identity.tasks.maintenance import security_alerts as task

        UserFactory.create()
        assert task.name == "identity.security_alerts"
        assert settings.CELERY_BEAT_SCHEDULE["identity-security-alerts"]["task"] == (
            "identity.security_alerts"
        )
