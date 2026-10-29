"""
Credential races on PostgreSQL (WP 8.6): concurrent revoke, rotate and use
end in a consistent state. Uses real threads and real transactions.
"""

from __future__ import annotations

import threading

import pytest
from django.core.exceptions import ValidationError
from django.db import connection

from apps.identity.choices import SecurityEventType
from apps.identity.models import ApiKey, PersonalAccessToken, SecurityEvent
from apps.identity.services.credential import (
    API_KEY,
    PERSONAL_ACCESS_TOKEN,
    CredentialService,
)
from apps.identity.tests.factories import UserFactory

SCOPE = "identity.security_event.view"


def _race(*callables):
    """Run callables at the same instant; return their results or exceptions."""
    barrier = threading.Barrier(len(callables))
    results: list[object] = [None] * len(callables)

    def runner(index, fn):
        try:
            barrier.wait(timeout=10)
            results[index] = fn()
        except Exception as exc:  # noqa: BLE001 - the test inspects it
            results[index] = exc
        finally:
            connection.close()

    threads = [threading.Thread(target=runner, args=(i, fn)) for i, fn in enumerate(callables)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=30)

    return results


@pytest.fixture(params=["pat", "key"])
def kind(request):
    return PERSONAL_ACCESS_TOKEN if request.param == "pat" else API_KEY


def _owner():
    return UserFactory.create(is_superuser=True)


@pytest.mark.django_db(transaction=True)
class TestCredentialRaces:
    def test_two_concurrent_revokes_revoke_once_and_audit_once(self, kind):
        owner = _owner()
        credential, _ = CredentialService.create(kind=kind, owner=owner, name="x", scopes=[SCOPE])

        results = _race(
            lambda: CredentialService.revoke(kind=kind, credential=credential, actor=owner),
            lambda: CredentialService.revoke(kind=kind, credential=credential, actor=owner),
        )

        assert not [r for r in results if isinstance(r, Exception)], results
        row = kind.model.objects.get(pk=credential.pk)
        assert row.is_active is False and row.revoked_at is not None
        assert (
            SecurityEvent.objects.filter(
                user=owner, event_type=SecurityEventType.API_KEY_REVOKED
            ).count()
            == 1
        )

    def test_two_concurrent_rotations_produce_exactly_one_live_successor(self, kind):
        owner = _owner()
        credential, _ = CredentialService.create(kind=kind, owner=owner, name="x", scopes=[SCOPE])

        results = _race(
            lambda: CredentialService.rotate(kind=kind, credential=credential, actor=owner),
            lambda: CredentialService.rotate(kind=kind, credential=credential, actor=owner),
        )

        winners = [r for r in results if isinstance(r, tuple)]
        losers = [r for r in results if isinstance(r, ValidationError)]
        assert len(winners) == 1 and len(losers) == 1, results
        live = kind.model.objects.filter(is_active=True, revoked_at__isnull=True)
        assert live.count() == 1 and live.get().pk == winners[0][0].pk

    def test_revoking_while_the_old_secret_is_in_use_leaves_it_dead(self, kind):
        from rest_framework.test import APIClient

        owner = _owner()
        credential, token = CredentialService.create(
            kind=kind, owner=owner, name="x", scopes=[SCOPE]
        )
        scheme = "Token" if kind is PERSONAL_ACCESS_TOKEN else "Api-Key"

        def use():
            client = APIClient()
            client.credentials(HTTP_AUTHORIZATION=f"{scheme} {token}")
            return client.get("/api/v1/identity/users/me/").status_code

        results = _race(
            use,
            lambda: CredentialService.revoke(kind=kind, credential=credential, actor=owner),
            use,
        )

        # in-flight requests may land either side of the revoke ...
        assert results[0] in (200, 401) and results[2] in (200, 401)
        assert not isinstance(results[1], Exception), results
        # ... but once it has returned the secret is dead, every time
        assert use() == 401

    def test_concurrent_creation_cannot_exceed_the_per_user_cap(self, kind, settings):
        settings.IDENTITY_MAX_ACTIVE_CREDENTIALS = 2
        owner = _owner()

        def create():
            return CredentialService.create(kind=kind, owner=owner, name="x", scopes=[SCOPE])

        results = _race(create, create, create, create)

        created = [r for r in results if isinstance(r, tuple)]
        refused = [r for r in results if isinstance(r, ValidationError)]
        unexpected = [r for r in results if r not in created and r not in refused]
        assert not unexpected, results
        live = kind.model.objects.filter(is_active=True, revoked_at__isnull=True).count()
        assert live == len(created)
        assert live <= 2, f"cap exceeded under concurrency: {live}"


_ = (ApiKey, PersonalAccessToken)
