"""
Trusted devices (WP 5.9) and KnownDevice removal (WP 5.13, decision A3).

Trust is minted server-side for exactly one user, validated owner-scoped,
fails closed, and is revoked (never edited or hard-deleted) through the API.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.apps import apps as django_apps
from django.test import RequestFactory
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.identity.authentication.device import DeviceTokenService
from apps.identity.choices import SecurityEventType
from apps.identity.models import SecurityEvent, TrustedDevice
from apps.identity.services.mfa import MFATrustedDeviceService
from apps.identity.tests.factories import TrustedDeviceFactory, UserFactory

UA = "Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0 Safari/537.36"


def _request(*, remote="198.51.100.1", forwarded=None, cookie_for=None):
    extra = {
        "REMOTE_ADDR": remote,
        "HTTP_USER_AGENT": UA,
        "HTTP_ACCEPT_LANGUAGE": "en-GB",
    }
    if forwarded:
        extra["HTTP_X_FORWARDED_FOR"] = forwarded
    request = RequestFactory().get("/")
    request.META.update(extra)
    if cookie_for is not None:
        fingerprint = DeviceTokenService.build_fingerprint(request).fingerprint
        request.COOKIES[DeviceTokenService.COOKIE_NAME] = DeviceTokenService.sign(
            fingerprint=fingerprint, user_id=cookie_for.pk
        )
    return request


def _events(user, event_type):
    return SecurityEvent.objects.filter(user=user, event_type=event_type)


@pytest.mark.django_db
class TestRegister:
    def test_writes_the_real_columns_for_the_owner(self):
        user = UserFactory.create()
        request = _request()

        device = MFATrustedDeviceService.register(user=user, request=request)

        device.refresh_from_db()
        assert device.user_id == user.pk
        assert device.is_trusted is True
        assert device.revoked_at is None
        assert device.browser
        assert device.platform
        assert device.user_agent == UA
        assert device.last_login_at is not None
        assert device.expires_at > timezone.now() + timedelta(days=29)

    def test_emits_a_device_added_event(self):
        user = UserFactory.create()

        MFATrustedDeviceService.register(user=user, request=_request())

        assert _events(user, SecurityEventType.TRUSTED_DEVICE_ADDED).count() == 1

    def test_registering_again_renews_a_revoked_device(self):
        user = UserFactory.create()
        request = _request()
        device = MFATrustedDeviceService.register(user=user, request=request)
        MFATrustedDeviceService.revoke(device=device)

        renewed = MFATrustedDeviceService.register(user=user, request=request)

        assert renewed.pk == device.pk
        assert renewed.is_trusted is True
        assert renewed.revoked_at is None

    def test_the_stored_ip_ignores_a_spoofed_forwarded_header(self):
        user = UserFactory.create()

        device = MFATrustedDeviceService.register(
            user=user, request=_request(remote="198.51.100.1", forwarded="6.6.6.6")
        )

        assert device.ip_address == "198.51.100.1"


@pytest.mark.django_db
class TestValidate:
    def test_a_registered_device_with_its_cookie_validates_and_is_touched(self):
        user = UserFactory.create()
        MFATrustedDeviceService.register(user=user, request=_request())
        TrustedDevice.objects.filter(user=user).update(last_login_at=None)

        assert MFATrustedDeviceService.validate(user=user, request=_request(cookie_for=user))

        assert TrustedDevice.objects.get(user=user).last_login_at is not None

    def test_no_cookie_means_not_trusted(self):
        user = UserFactory.create()
        MFATrustedDeviceService.register(user=user, request=_request())

        assert MFATrustedDeviceService.validate(user=user, request=_request()) is False

    def test_a_tampered_cookie_is_rejected(self):
        user = UserFactory.create()
        MFATrustedDeviceService.register(user=user, request=_request())
        request = _request(cookie_for=user)
        request.COOKIES[DeviceTokenService.COOKIE_NAME] += "x"

        assert MFATrustedDeviceService.validate(user=user, request=request) is False

    def test_another_users_cookie_and_row_never_count(self):
        owner = UserFactory.create()
        other = UserFactory.create()
        MFATrustedDeviceService.register(user=owner, request=_request())

        # ``other`` presents a cookie signed for ``other`` on the same browser
        # fingerprint; only ``owner`` has a device row for it.
        assert (
            MFATrustedDeviceService.validate(user=other, request=_request(cookie_for=other))
            is False
        )

    def test_a_cookie_signed_for_someone_else_is_rejected(self):
        owner = UserFactory.create()
        attacker = UserFactory.create()
        MFATrustedDeviceService.register(user=owner, request=_request())
        MFATrustedDeviceService.register(user=attacker, request=_request())

        # The attacker replays the owner's cookie while authenticating as themselves.
        assert (
            MFATrustedDeviceService.validate(user=attacker, request=_request(cookie_for=owner))
            is False
        )

    def test_a_revoked_device_fails_closed_without_raising(self):
        user = UserFactory.create()
        device = MFATrustedDeviceService.register(user=user, request=_request())
        MFATrustedDeviceService.revoke(device=device)

        assert (
            MFATrustedDeviceService.validate(user=user, request=_request(cookie_for=user)) is False
        )

    def test_an_expired_device_fails_closed_without_raising(self):
        user = UserFactory.create()
        MFATrustedDeviceService.register(user=user, request=_request())
        TrustedDevice.objects.filter(user=user).update(
            expires_at=timezone.now() - timedelta(minutes=1)
        )

        assert (
            MFATrustedDeviceService.validate(user=user, request=_request(cookie_for=user)) is False
        )


@pytest.mark.django_db
class TestRevoke:
    def test_revoke_marks_the_row_and_emits_an_event(self):
        user = UserFactory.create()
        device = MFATrustedDeviceService.register(user=user, request=_request())

        MFATrustedDeviceService.revoke(device=device)

        device.refresh_from_db()
        assert device.is_trusted is False
        assert device.revoked_at is not None
        assert _events(user, SecurityEventType.TRUSTED_DEVICE_REMOVED).count() == 1

    def test_revoke_all_only_touches_the_users_live_devices(self):
        user = UserFactory.create()
        other = UserFactory.create()
        TrustedDeviceFactory.create(user=user)
        TrustedDeviceFactory.create(user=user)
        theirs = TrustedDeviceFactory.create(user=other)

        assert MFATrustedDeviceService.revoke_all(user=user) == 2

        assert not TrustedDevice.objects.filter(user=user, revoked_at__isnull=True).exists()
        theirs.refresh_from_db()
        assert theirs.revoked_at is None


@pytest.mark.django_db
class TestApi:
    def _url(self, device):
        return reverse("api:v1:identity:trusted-device-detail", kwargs={"pk": device.pk})

    def test_delete_revokes_and_keeps_the_row(self, staff_client, staff_user):
        device = TrustedDeviceFactory.create(user=staff_user)

        response = staff_client.delete(self._url(device))

        assert response.status_code in (200, 204)
        device.refresh_from_db()
        assert device.revoked_at is not None
        assert device.is_trusted is False
        assert _events(staff_user, SecurityEventType.TRUSTED_DEVICE_REMOVED).exists()

    def test_deleting_twice_is_harmless(self, staff_client, staff_user):
        device = TrustedDeviceFactory.create(user=staff_user)

        staff_client.delete(self._url(device))
        again = staff_client.delete(self._url(device))

        assert again.status_code in (200, 204)
        assert _events(staff_user, SecurityEventType.TRUSTED_DEVICE_REMOVED).count() == 1

    def test_another_users_device_cannot_be_revoked(self, staff_client):
        device = TrustedDeviceFactory.create()

        response = staff_client.delete(self._url(device))

        assert response.status_code == 404
        device.refresh_from_db()
        assert device.revoked_at is None

    def test_a_victim_cannot_be_given_a_planted_trusted_device(self):
        attacker = UserFactory.create()
        victim = UserFactory.create()
        client = APIClient()
        client.force_authenticate(user=attacker)
        before = TrustedDevice.objects.count()

        response = client.post(
            reverse("api:v1:identity:trusted-device-list"),
            {"user": str(victim.pk), "fingerprint": "planted", "is_trusted": True},
            format="json",
        )

        assert response.status_code in (403, 405)
        assert TrustedDevice.objects.count() == before
        assert not TrustedDevice.objects.filter(user=victim).exists()

    def test_list_is_scoped_to_the_owner(self):
        mine = UserFactory.create()
        TrustedDeviceFactory.create(user=mine)
        TrustedDeviceFactory.create()
        client = APIClient()
        client.force_authenticate(user=mine)

        response = client.get(reverse("api:v1:identity:trusted-device-list"))

        body = response.json()
        rows = body if isinstance(body, list) else body.get("results", body.get("data", body))
        assert response.status_code == 200
        assert len(rows) == 1


@pytest.mark.django_db
class TestCleanupAndRemovals:
    def test_known_device_no_longer_exists(self):
        with pytest.raises(LookupError):
            django_apps.get_model("identity", "KnownDevice")

    def test_the_two_trusted_device_services_have_distinct_names(self):
        import apps.identity.authentication as authentication
        from apps.identity.services.trusted_device import TrustedDeviceService

        assert not hasattr(authentication, "TrustedDeviceService")
        assert hasattr(authentication, "DeviceTokenService")
        assert TrustedDeviceService is not DeviceTokenService
