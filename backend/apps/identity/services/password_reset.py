from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

from apps.core.logging.logger import get_logger
from apps.identity.models import (
    PasswordResetToken,
    User,
)
from apps.identity.services.password import PasswordService

_logger = get_logger("identity.password_reset")


class PasswordResetService:
    """
    Single-use password reset flow.

    ``request_reset`` never reveals whether an account exists. The raw token is
    delivered by email only; the database stores a SHA-256 digest. Issuing a new
    token revokes all outstanding tokens for the user.
    """

    TOKEN_BYTES = 32
    TOKEN_LIFETIME = timedelta(hours=1)

    @classmethod
    def _hash(cls, token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    @classmethod
    @transaction.atomic
    def request_reset(cls, *, email: str, request=None):
        """
        Issue a reset token for a usable account.

        Returns the raw token (for internal/test callers) or ``None`` when no
        usable account matches. The public API must ignore the return value.
        """

        normalized = (email or "").strip().lower()

        if not normalized:
            return None

        user = User.objects.filter(
            email__iexact=normalized,
            is_active=True,
            is_deleted=False,
        ).first()

        if user is None:
            return None

        # One live token per user: a second request invalidates the first.
        PasswordResetToken.objects.filter(
            user=user,
            used_at__isnull=True,
        ).update(used_at=timezone.now())

        raw_token = secrets.token_urlsafe(cls.TOKEN_BYTES)

        PasswordResetToken.objects.create(
            user=user,
            token_hash=cls._hash(raw_token),
            expires_at=timezone.now() + cls.TOKEN_LIFETIME,
            requested_ip=cls._client_ip(request),
        )

        cls._send_email(user=user, token=raw_token)

        return raw_token

    @classmethod
    @transaction.atomic
    def confirm_reset(cls, *, token: str, new_password: str, request=None):
        """
        Consume a token and set the new password.

        The token row is locked while the password is changed so concurrent
        submissions cannot both succeed. ``PasswordService`` revokes every
        session and records the audit event.
        """

        token_hash = cls._hash(token or "")

        reset = (
            PasswordResetToken.objects.select_for_update()
            .filter(
                token_hash=token_hash,
                used_at__isnull=True,
            )
            .first()
        )

        if reset is None or reset.is_expired:
            raise ValidationError("Invalid or expired password reset token.")

        PasswordService.set_password(
            user=reset.user,
            new_password=new_password,
            request=request,
            origin="reset",
        )

        reset.used_at = timezone.now()

        reset.save(
            update_fields=[
                "used_at",
                "updated_at",
            ],
        )

        return reset.user

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @classmethod
    def _client_ip(cls, request):
        if request is None:
            return None

        from apps.identity.authentication.utils import AuthenticationUtils

        return AuthenticationUtils.get_client_ip(request) or None

    @classmethod
    def _send_email(cls, *, user, token: str) -> None:
        base_url = getattr(settings, "FRONTEND_BASE_URL", "") or ""

        action = (
            f"{base_url.rstrip('/')}/reset-password?token={token}"
            if base_url
            else token
        )

        try:
            send_mail(
                subject="Reset your StudioHub password",
                message=(
                    "Use the following link to reset your StudioHub password:\n\n"
                    f"{action}\n\n"
                    "This link expires in 1 hour. If you did not request a "
                    "password reset, you can safely ignore this email."
                ),
                from_email=getattr(
                    settings,
                    "DEFAULT_FROM_EMAIL",
                    "noreply@studiohub.local",
                ),
                recipient_list=[user.email],
                fail_silently=False,
            )
        except Exception:
            # Delivery failures must not disclose account existence and must
            # not roll back the token record (the user can request another).
            _logger.exception(
                "password_reset_email_failed",
                user_id=str(user.pk),
            )
