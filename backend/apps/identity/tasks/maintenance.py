"""
Scheduled identity housekeeping.

One entry point used by the Celery beat schedule and by the
``identity_cleanup`` management command (cron / deployments without beat), so
both do exactly the same thing.
"""

from celery import shared_task

from apps.identity.services.login_attempt import LoginAttemptService
from apps.identity.services.login_history import LoginHistoryService
from apps.identity.services.user_session import UserSessionService


def run_cleanup() -> dict[str, int]:
    from apps.identity.models import TrustedDevice

    expired_devices, _ = TrustedDevice.objects.expired().delete()

    return {
        "sessions_expired": UserSessionService.cleanup(),
        "login_attempts_purged": LoginAttemptService.purge_expired(),
        "login_history_purged": LoginHistoryService.purge_expired(),
        "trusted_devices_purged": expired_devices,
    }


@shared_task(name="identity.cleanup")
def identity_cleanup():
    return run_cleanup()


@shared_task(name="identity.security_alerts")
def security_alerts():
    """Hourly: log (and optionally email) spikes of failed logins, lockouts and privileged changes."""
    from apps.identity.services import security_alerts as alerts

    return len(alerts.run())
