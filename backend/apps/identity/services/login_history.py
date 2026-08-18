from __future__ import annotations

from apps.identity.choices import LoginMethod, LoginStatus


class LoginHistoryService:
    """
    Records login history on the canonical ``apps.audit.LoginHistory`` model.

    Identity owns the authentication flow; audit owns the login-history audit
    record. The audit model is intentionally richer (login type, MFA, device
    and session information) and is served through the audit API.
    """

    model_name = "audit.LoginHistory"

    @classmethod
    def create(
        cls,
        *,
        user,
        session=None,
        organization=None,
        ip_address="",
        user_agent="",
        browser="",
        browser_version="",
        operating_system="",
        device_name="",
        device_type="",
        login_at,
        status=LoginStatus.SUCCESS,
        login_method=LoginMethod.PASSWORD,
    ):
        from apps.audit.models import LoginHistory

        session_id = ""
        if session is not None:
            session_id = str(getattr(session, "id", "") or "")

        return LoginHistory.objects.create(
            user=user,
            organization=organization,
            session_id=session_id,
            login_method=login_method,
            status=status,
            ip_address=ip_address,
            user_agent=user_agent,
            browser=browser,
            browser_version=browser_version,
            operating_system=operating_system,
            device_name=device_name,
            device_type=device_type,
            failure_reason="",
            location="",
        )
