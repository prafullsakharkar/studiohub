from __future__ import annotations

import hashlib
from datetime import timedelta

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

from apps.identity.authentication.jwt import JWTService
from apps.identity.choices import SessionStatus
from apps.identity.models import PasswordResetToken, UserSession
from apps.identity.services.password_reset import PasswordResetService
from apps.identity.tests.factories import UserFactory


@pytest.mark.django_db
class TestPasswordResetRequest:
    def test_request_creates_hashed_single_use_token_and_emails_user(self, mailoutbox):
        user = UserFactory.create(email="reset@example.com", is_active=True)

        raw = PasswordResetService.request_reset(email="RESET@Example.COM")

        assert raw

        token = PasswordResetToken.objects.get(user=user)
        assert token.token_hash == hashlib.sha256(raw.encode("utf-8")).hexdigest()
        assert token.token_hash != raw
        assert token.used_at is None
        assert token.is_usable

        assert len(mailoutbox) == 1
        assert mailoutbox[0].to == [user.email]
        assert raw in mailoutbox[0].body

    def test_unknown_email_is_indistinguishable_and_sends_nothing(self, mailoutbox):
        assert PasswordResetService.request_reset(email="nobody@example.com") is None
        assert PasswordResetToken.objects.count() == 0
        assert mailoutbox == []

    def test_second_request_invalidates_first_token(self, mailoutbox):
        user = UserFactory.create(email="rotate@example.com", is_active=True)

        first = PasswordResetService.request_reset(email=user.email)
        second = PasswordResetService.request_reset(email=user.email)

        assert first != second
        assert PasswordResetToken.objects.filter(user=user).count() == 2
        assert (
            PasswordResetToken.objects.filter(
                user=user,
                used_at__isnull=True,
            ).count()
            == 1
        )

        with pytest.raises(ValidationError):
            PasswordResetService.confirm_reset(
                token=first,
                new_password="first-new-pass-1",
            )

        PasswordResetService.confirm_reset(
            token=second,
            new_password="second-new-pass-1",
        )

    def test_inactive_or_soft_deleted_user_gets_no_token(self, mailoutbox):
        inactive = UserFactory.create(email="inactive@example.com", is_active=False)
        deleted = UserFactory.create(email="deleted@example.com", is_active=True)
        deleted.is_deleted = True
        deleted.save(update_fields=["is_deleted"])

        assert PasswordResetService.request_reset(email=inactive.email) is None
        assert PasswordResetService.request_reset(email=deleted.email) is None
        assert PasswordResetToken.objects.count() == 0
        assert mailoutbox == []


@pytest.mark.django_db
class TestPasswordResetConfirm:
    def test_confirm_sets_password_consumes_token_and_revokes_sessions(self):
        user = UserFactory.create(email="confirm@example.com", is_active=True)
        refresh = RefreshToken.for_user(user)
        UserSession.objects.create(
            user=user,
            session_key=refresh["jti"],
            refresh_token_jti=refresh["jti"],
            access_token_jti="acc-jti",
            status=SessionStatus.ACTIVE,
            expires_at=JWTService.get_expiration(refresh),
        )

        raw = PasswordResetService.request_reset(email=user.email)
        PasswordResetService.confirm_reset(
            token=raw,
            new_password="brand-new-pass-1",
        )

        user.refresh_from_db()
        assert user.check_password("brand-new-pass-1")
        assert not UserSession.objects.active().by_user(user).exists()

        token = PasswordResetToken.objects.get(user=user)
        assert token.used_at is not None
        assert not token.is_usable

    def test_expired_token_is_rejected(self):
        user = UserFactory.create(email="expired@example.com", is_active=True)
        raw = PasswordResetService.request_reset(email=user.email)

        PasswordResetToken.objects.filter(user=user).update(
            expires_at=timezone.now() - timedelta(seconds=1),
        )

        with pytest.raises(ValidationError):
            PasswordResetService.confirm_reset(
                token=raw,
                new_password="too-late-pass-1",
            )

        user.refresh_from_db()
        assert not user.check_password("too-late-pass-1")

    def test_reused_token_is_rejected(self):
        user = UserFactory.create(email="reuse@example.com", is_active=True)
        raw = PasswordResetService.request_reset(email=user.email)

        PasswordResetService.confirm_reset(
            token=raw,
            new_password="first-use-pass-1",
        )

        with pytest.raises(ValidationError):
            PasswordResetService.confirm_reset(
                token=raw,
                new_password="second-use-pass-1",
            )

        user.refresh_from_db()
        assert user.check_password("first-use-pass-1")

    def test_unknown_token_is_rejected(self):
        with pytest.raises(ValidationError):
            PasswordResetService.confirm_reset(
                token="not-a-real-token",
                new_password="whatever-pass-1",
            )
