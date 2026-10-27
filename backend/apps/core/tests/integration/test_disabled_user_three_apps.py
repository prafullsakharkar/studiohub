"""
A disabled user loses access to Publishing, Deliveries and Scheduling on the next request
(docs/delivery-pipeline/CONTRACTS.md X-07, X-10, assumption A-14).

Every operation of the three apps is read from the OpenAPI schema, so a route added later is
covered without touching this file. A real access token, bound to an active session, is used
first to show the requests get past authentication (anything but 401), then the account is
disabled and the same token is refused on every one of them.
"""

from __future__ import annotations

import uuid
from datetime import timedelta

import pytest
from django.utils import timezone
from drf_spectacular.generators import SchemaGenerator
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from apps.identity.choices import SessionStatus
from apps.identity.models import User, UserSession
from apps.identity.services.user import UserService
from apps.identity.tests.factories import UserFactory

pytestmark = pytest.mark.django_db

APPS = ("publishing", "deliveries", "scheduling")
METHODS = ("get", "post", "put", "patch", "delete")


@pytest.fixture(scope="module")
def operations(django_db_blocker):
    with django_db_blocker.unblock():
        paths = SchemaGenerator().get_schema(request=None, public=True)["paths"]
    found = [
        (method, path)
        for path, methods in sorted(paths.items())
        if any(f"/{app}/" in path for app in APPS)
        for method in methods
        if method in METHODS
    ]
    assert len(found) > 100, "the schema lists too few operations: the scan is broken"
    return found


def _url(path: str) -> str:
    for name in ("{uuid}", "{project_id}"):
        path = path.replace(name, str(uuid.uuid4()))
    assert "{" not in path, path
    return path


def _login():
    """A superuser (holds every code, so a refusal can only be authentication) with a live token."""
    user = UserFactory.create(is_active=True, is_superuser=True)
    refresh = RefreshToken.for_user(user)
    access = AccessToken.for_user(user)
    UserSession.objects.create(
        user=user,
        session_key=str(refresh["jti"]),
        refresh_token_jti=str(refresh["jti"]),
        access_token_jti=str(access["jti"]),
        status=SessionStatus.ACTIVE,
        expires_at=timezone.now() + timedelta(days=1),
    )
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    return user, client


def _statuses(client, operations) -> dict[tuple[str, str], int]:
    return {
        (method, path): getattr(client, method)(_url(path), {}, format="json").status_code
        for method, path in operations
    }


def test_the_requests_get_past_authentication_while_the_account_is_active(operations):
    _, client = _login()

    refused = {key: code for key, code in _statuses(client, operations).items() if code == 401}

    assert refused == {}, "the token was not accepted: the next test would prove nothing"


def test_every_operation_answers_401_once_the_account_is_disabled(operations):
    user, client = _login()
    User.objects.filter(pk=user.pk).update(is_active=False)

    still_open = {key: code for key, code in _statuses(client, operations).items() if code != 401}

    assert still_open == {}, f"{len(still_open)} operations answered a disabled user"


def test_deactivating_through_the_service_closes_every_operation_too(operations):
    user, client = _login()
    admin = UserFactory.create(is_active=True, is_superuser=True)

    UserService.deactivate(instance=user, user=admin)

    still_open = {key: code for key, code in _statuses(client, operations).items() if code != 401}
    assert still_open == {}


def test_a_reactivated_account_works_again(operations):
    user, client = _login()
    User.objects.filter(pk=user.pk).update(is_active=False)
    assert all(code == 401 for code in _statuses(client, operations[:5]).values())

    User.objects.filter(pk=user.pk).update(is_active=True)

    assert all(code != 401 for code in _statuses(client, operations[:5]).values())
