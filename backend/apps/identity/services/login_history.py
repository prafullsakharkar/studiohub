from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from apps.identity.choices import LoginMethod, LoginStatus
from apps.identity.models import LoginHistory

DEFAULT_RETENTION_DAYS = 365


class LoginHistoryService:
    """
    Records and ages out the identity-owned login history.

    One row is written per session created (success). Failed attempts are
    recorded in the login-attempt ledger, which carries the username, IP,
    user agent and precise reason and has its own retention. Rows are
    append-only; the only deletion path is ``purge_expired``.
    """

    @classmethod
    def create(
        cls,
        *,
        user,
        session=None,
        ip_address="",
        user_agent="",
        browser="",
        browser_version="",
        operating_system="",
        device_name="",
        device_type="",
        status=LoginStatus.SUCCESS,
        login_method=LoginMethod.PASSWORD,
        **_ignored,
    ):
        session_id = ""
        if session is not None:
            session_id = str(getattr(session, "id", "") or "")

        return LoginHistory.objects.create(
            user=user,
            session_id=session_id,
            login_method=login_method,
            status=status,
            ip_address=ip_address or None,
            user_agent=user_agent,
            browser=browser,
            browser_version=browser_version,
            operating_system=operating_system,
            device_name=device_name,
            device_type=device_type,
        )

    @classmethod
    def purge_expired(
        cls,
        *,
        retention_days=None,
    ) -> int:
        """Delete history older than the retention window (default 365 days)."""

        if retention_days is None:
            retention_days = getattr(
                settings,
                "IDENTITY_LOGIN_HISTORY_RETENTION_DAYS",
                DEFAULT_RETENTION_DAYS,
            )

        cutoff = timezone.now() - timedelta(days=retention_days)

        deleted, _ = LoginHistory.objects.filter(
            created_at__lt=cutoff,
        ).delete()

        return deleted
