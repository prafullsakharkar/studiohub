"""
Client IP resolution and IP blacklist enforcement (WP 5.8 / 5.11).

The IP used for lockout, throttling, audit and blacklist decisions is
REMOTE_ADDR unless the direct peer is a configured trusted proxy. A spoofed
X-Forwarded-For must never bypass (or trigger) an IP control.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.core.cache import cache
from django.test import RequestFactory
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.core.utils.client_ip import client_ip_from_meta, get_client_ip
from apps.identity.choices import SecurityEventType
from apps.identity.models import IPBlacklist, LoginAttempt, SecurityEvent
from apps.identity.services.ip_blacklist import IPBlacklistService
from apps.identity.tests.factories import IPBlacklistFactory, UserFactory

PASSWORD = "Correct-horse-battery-9!"
LOGIN = "api:v1:auth-compat:auth-login"


@pytest.fixture(autouse=True)
def _clean_cache():
    cache.clear()
    yield
    cache.clear()


def _meta(remote, forwarded=None):
    meta = {"REMOTE_ADDR": remote}
    if forwarded is not None:
        meta["HTTP_X_FORWARDED_FOR"] = forwarded
    return meta


class TestClientIpResolution:
    def test_default_ignores_x_forwarded_for(self, settings):
        settings.TRUSTED_PROXY_IPS = ()

        assert client_ip_from_meta(_meta("198.51.100.7", "6.6.6.6")) == "198.51.100.7"

    def test_untrusted_peer_cannot_set_the_client_ip(self, settings):
        settings.TRUSTED_PROXY_IPS = ("10.0.0.1",)

        assert client_ip_from_meta(_meta("198.51.100.7", "6.6.6.6")) == "198.51.100.7"

    def test_trusted_proxy_yields_the_address_it_saw(self, settings):
        settings.TRUSTED_PROXY_IPS = ("10.0.0.1",)

        # A client-supplied "6.6.6.6" sits to the left of what the proxy appended.
        assert client_ip_from_meta(_meta("10.0.0.1", "6.6.6.6, 203.0.113.9")) == "203.0.113.9"

    def test_chain_of_trusted_proxies_uses_the_first_untrusted_hop(self, settings):
        settings.TRUSTED_PROXY_IPS = ("10.0.0.0/8",)

        meta = _meta("10.0.0.1", "6.6.6.6, 203.0.113.9, 10.0.0.2")

        assert client_ip_from_meta(meta) == "203.0.113.9"

    def test_all_hops_trusted_returns_the_originating_address(self, settings):
        settings.TRUSTED_PROXY_IPS = ("10.0.0.0/8",)

        assert client_ip_from_meta(_meta("10.0.0.1", "10.1.1.1, 10.0.0.2")) == "10.1.1.1"

    def test_malformed_header_fails_closed_to_the_peer(self, settings):
        settings.TRUSTED_PROXY_IPS = ("10.0.0.1",)

        for header in ("not-an-ip", "203.0.113.9, garbage", "'; DROP TABLE x;--"):
            assert client_ip_from_meta(_meta("10.0.0.1", header)) == "10.0.0.1"

    def test_missing_header_from_a_trusted_peer_returns_the_peer(self, settings):
        settings.TRUSTED_PROXY_IPS = ("10.0.0.1",)

        assert client_ip_from_meta(_meta("10.0.0.1")) == "10.0.0.1"

    def test_ipv6_and_mapped_addresses(self, settings):
        settings.TRUSTED_PROXY_IPS = ("fd00::/8", "10.0.0.1")

        assert client_ip_from_meta(_meta("fd00::1", "2001:db8::5")) == "2001:db8::5"
        assert client_ip_from_meta(_meta("10.0.0.1", "::ffff:203.0.113.9")) == "203.0.113.9"

    def test_missing_meta_is_none(self):
        assert client_ip_from_meta({}) is None
        assert get_client_ip(object()) is None

    def test_works_for_request_objects(self, settings):
        settings.TRUSTED_PROXY_IPS = ("10.0.0.1",)
        request = RequestFactory().get(
            "/", REMOTE_ADDR="10.0.0.1", HTTP_X_FORWARDED_FOR="203.0.113.9"
        )

        assert get_client_ip(request) == "203.0.113.9"


@pytest.mark.django_db
class TestBlacklistMatching:
    def test_exact_address(self):
        IPBlacklistFactory.create(ip_address="203.0.113.5")

        assert IPBlacklist.objects.is_ip_blacklisted("203.0.113.5")
        assert not IPBlacklist.objects.is_ip_blacklisted("203.0.113.6")

    def test_cidr_range_blocks_every_member_and_nothing_else(self):
        IPBlacklistFactory.create(ip_address=None, network="203.0.113.0/24")

        assert IPBlacklist.objects.is_ip_blacklisted("203.0.113.1")
        assert IPBlacklist.objects.is_ip_blacklisted("203.0.113.254")
        assert not IPBlacklist.objects.is_ip_blacklisted("203.0.114.1")

    def test_ipv6_range(self):
        IPBlacklistFactory.create(ip_address=None, network="2001:db8::/32")

        assert IPBlacklist.objects.is_ip_blacklisted("2001:db8:abcd::1")
        assert not IPBlacklist.objects.is_ip_blacklisted("2001:db9::1")

    def test_ipv4_mapped_ipv6_matches_the_ipv4_entry(self):
        IPBlacklistFactory.create(ip_address="203.0.113.5")

        assert IPBlacklist.objects.is_ip_blacklisted("::ffff:203.0.113.5")

    def test_inactive_and_expired_entries_do_not_block(self):
        IPBlacklistFactory.create(ip_address="203.0.113.10", is_active=False)
        IPBlacklistFactory.create(
            ip_address=None,
            network="198.51.100.0/24",
            expires_at=timezone.now() - timedelta(minutes=1),
        )

        assert not IPBlacklist.objects.is_ip_blacklisted("203.0.113.10")
        assert not IPBlacklist.objects.is_ip_blacklisted("198.51.100.4")

    def test_not_yet_expired_entry_blocks(self):
        IPBlacklistFactory.create(
            ip_address="203.0.113.11", expires_at=timezone.now() + timedelta(hours=1)
        )

        assert IPBlacklist.objects.is_ip_blacklisted("203.0.113.11")

    def test_garbage_input_and_garbage_stored_ranges_never_match_or_crash(self):
        IPBlacklistFactory.create(ip_address=None, network="not-a-cidr")

        assert not IPBlacklist.objects.is_ip_blacklisted("not-an-ip")
        assert not IPBlacklist.objects.is_ip_blacklisted("203.0.113.1")
        assert not IPBlacklist.objects.is_ip_blacklisted("")

    def test_str_of_a_network_entry(self):
        entry = IPBlacklistFactory.create(ip_address=None, network="203.0.113.0/24")

        assert str(entry) == "203.0.113.0/24"


@pytest.mark.django_db
class TestBlacklistValidation:
    def _create(self, **data):
        user = UserFactory.create()
        return IPBlacklistService.create(user=user, **data)

    def test_valid_cidr_is_accepted(self):
        assert self._create(network="203.0.113.0/24").network == "203.0.113.0/24"

    @pytest.mark.parametrize("bad", ["203.0.113.0/99", "nonsense", "1.2.3/24", "999.1.1.1/8"])
    def test_invalid_cidr_is_rejected(self, bad):
        from django.core.exceptions import ValidationError

        with pytest.raises(ValidationError):
            self._create(network=bad)

    def test_address_and_network_together_are_rejected(self):
        from django.core.exceptions import ValidationError

        with pytest.raises(ValidationError):
            self._create(ip_address="203.0.113.5", network="203.0.113.0/24")


@pytest.mark.django_db
class TestLoginEnforcement:
    def _post(self, remote, forwarded=None, email="someone@example.com"):
        extra = {"REMOTE_ADDR": remote}
        if forwarded is not None:
            extra["HTTP_X_FORWARDED_FOR"] = forwarded
        return APIClient().post(
            reverse(LOGIN),
            {"email": email, "password": "x"},
            format="json",
            **extra,
        )

    def test_blacklisted_address_is_blocked_with_a_distinct_status(self):
        IPBlacklistFactory.create(ip_address="203.0.113.5")

        response = self._post("203.0.113.5")

        assert response.status_code == 403
        assert response.json()["error"]["code"] == "ip_blocked"

    def test_cidr_entry_blocks_login(self):
        IPBlacklistFactory.create(ip_address=None, network="203.0.113.0/24")

        assert self._post("203.0.113.200").status_code == 403

    def test_clean_address_reaches_authentication(self):
        IPBlacklistFactory.create(ip_address="203.0.113.5")

        assert self._post("198.51.100.1").status_code == 401

    def test_spoofed_header_cannot_hide_a_blacklisted_address(self):
        IPBlacklistFactory.create(ip_address="203.0.113.5")

        assert self._post("203.0.113.5", forwarded="198.51.100.1").status_code == 403

    def test_spoofed_header_cannot_frame_a_clean_address(self):
        IPBlacklistFactory.create(ip_address="203.0.113.5")

        # Direct peer is clean and untrusted: the forged header is ignored.
        assert self._post("198.51.100.1", forwarded="203.0.113.5").status_code == 401

    def test_attempts_are_recorded_against_the_real_peer_not_the_header(self):
        self._post("198.51.100.1", forwarded="6.6.6.6", email="victim@example.com")

        attempt = LoginAttempt.objects.get(username="victim@example.com")
        assert attempt.ip_address == "198.51.100.1"

    def test_trusted_proxy_blocks_the_real_client_behind_it(self, settings):
        settings.TRUSTED_PROXY_IPS = ("10.0.0.1",)
        IPBlacklistFactory.create(ip_address="203.0.113.5")

        response = self._post("10.0.0.1", forwarded="203.0.113.5")

        assert response.status_code == 403

    def test_trusted_proxy_does_not_let_a_client_forge_its_way_past(self, settings):
        settings.TRUSTED_PROXY_IPS = ("10.0.0.1",)
        IPBlacklistFactory.create(ip_address="203.0.113.5")

        # The client sent a clean-looking address; the proxy appended the real one.
        response = self._post("10.0.0.1", forwarded="198.51.100.77, 203.0.113.5")

        assert response.status_code == 403

    def test_each_block_advances_hit_tracking(self):
        entry = IPBlacklistFactory.create(ip_address="203.0.113.5")

        self._post("203.0.113.5")
        self._post("203.0.113.5")

        entry.refresh_from_db()
        assert entry.hit_count == 2
        assert entry.last_hit_at is not None

    def test_block_event_is_written_once_per_window(self):
        IPBlacklistFactory.create(ip_address="203.0.113.5")

        for _ in range(3):
            self._post("203.0.113.5")

        events = SecurityEvent.objects.filter(event_type=SecurityEventType.IP_BLOCKED)
        assert events.count() == 1
        assert events.get().ip_address == "203.0.113.5"

    def test_blocked_attempt_never_reaches_the_attempt_ledger(self):
        IPBlacklistFactory.create(ip_address="203.0.113.5")

        self._post("203.0.113.5", email="blocked@example.com")

        assert not LoginAttempt.objects.filter(username="blocked@example.com").exists()


@pytest.mark.django_db
class TestExpiredFilter:
    def test_expired_filter_works_over_the_api(self, staff_client):
        live = IPBlacklistFactory.create(ip_address="203.0.113.20")
        old = IPBlacklistFactory.create(
            ip_address="203.0.113.21", expires_at=timezone.now() - timedelta(days=1)
        )
        url = reverse("api:v1:identity:ip-blacklist-list")

        expired = staff_client.get(url, {"expired": "true"})
        current = staff_client.get(url, {"expired": "false"})

        assert expired.status_code == 200 and current.status_code == 200

        def ids(response):
            body = response.json()
            rows = body if isinstance(body, list) else body.get("results", body.get("data", body))
            return {str(r["id"]) for r in rows}

        assert ids(expired) == {str(old.pk)}
        assert str(live.pk) in ids(current)
        assert str(old.pk) not in ids(current)
