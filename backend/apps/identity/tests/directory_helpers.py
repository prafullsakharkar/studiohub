"""
A fake OpenLDAP for the directory sign-in tests (ADR-0039, CR-40): ldap3's in-memory mock server.

``FakeDirectory`` holds the entries; ``enable()`` saves a working configuration pointing at it.
The client's bind and search are the real ldap3 code paths; only the transport is the mock.
"""

from __future__ import annotations

from typing import Any

from django.utils import timezone
from ldap3 import MOCK_SYNC, Connection, Server
from rest_framework.test import APIClient

from apps.identity.models import DirectoryConfiguration, Role, UserRole
from apps.identity.services.directory import secret
from apps.identity.services.directory.client import DirectoryClient

BASE = "ou=people,dc=studio,dc=test"
SERVICE_DN = "cn=svc,dc=studio,dc=test"
SERVICE_PASSWORD = "service-Password-1"
PASSWORD = "Directory-Password-9!"
LOCAL_PASSWORD = "Correct-horse-battery-9!"

LOGIN = "/api/v1/auth/login/"
ME = "/api/v1/auth/me/"
DIRECTORY = "/api/v1/identity/directory/"
TEST_CONNECTION = "/api/v1/identity/directory/test-connection/"
TEST_USER = "/api/v1/identity/directory/test-user/"


class FakeDirectory:
    def __init__(self) -> None:
        self.server = Server("fake-openldap")
        self._seed = Connection(
            self.server, user=SERVICE_DN, password=SERVICE_PASSWORD, client_strategy=MOCK_SYNC
        )
        self._seed.strategy.add_entry(
            SERVICE_DN, {"objectClass": ["person"], "cn": "svc", "userPassword": SERVICE_PASSWORD}
        )
        self._seed.strategy.add_entry(BASE, {"objectClass": ["organizationalUnit"], "ou": "people"})
        self.down = False
        self.binds: list[str] = []

    def add(
        self,
        uid: str,
        *,
        password: str = PASSWORD,
        mail: str | None = None,
        no_mail: bool = False,
        subject: str | None = None,
        given: str = "Jane",
        sn: str = "Doe",
        display: str | None = None,
        dn: str | None = None,
    ) -> str:
        dn = dn or f"uid={uid},{BASE}"
        attributes: dict[str, Any] = {
            "objectClass": ["inetOrgPerson"],
            "uid": uid,
            "entryUUID": subject or f"uuid-{uid}",
            "givenName": given,
            "sn": sn,
            "cn": f"{given} {sn}",
            "userPassword": password,
        }
        if not no_mail:
            attributes["mail"] = mail if mail is not None else f"{uid}@studio.test"
        if display:
            attributes["displayName"] = display
        self._seed.strategy.add_entry(dn, attributes)
        return dn

    def remove(self, dn: str) -> None:
        self._seed.strategy.remove_entry(dn)

    def install(self, monkeypatch) -> None:
        """Point every DirectoryClient at this fake server (and record every bind)."""
        fake = self
        real_bind = DirectoryClient._bind

        def server(client):
            if fake.down:
                from apps.identity.services.directory.client import DirectoryUnavailable

                raise DirectoryUnavailable("fake outage")
            return fake.server

        def bind(client, user, password):
            fake.binds.append(user)
            return real_bind(client, user, password)

        monkeypatch.setattr(DirectoryClient, "client_strategy", MOCK_SYNC)
        monkeypatch.setattr(DirectoryClient, "server", server)
        monkeypatch.setattr(DirectoryClient, "_bind", bind)


def configure(*, enabled: bool = True, **fields) -> DirectoryConfiguration:
    """Save a configuration for the fake directory, as if tested and switched on."""
    values: dict[str, Any] = {
        "enabled": enabled,
        "server_uri": "ldaps://ldap.studio.test",
        "bind_dn": SERVICE_DN,
        "bind_password": secret.encrypt(SERVICE_PASSWORD),
        "user_search_base": BASE,
        "last_tested_at": timezone.now(),
    }
    values.update(fields)
    DirectoryConfiguration.objects.update_or_create(
        pk=DirectoryConfiguration.SINGLETON_PK, defaults=values
    )
    return DirectoryConfiguration.objects.get(pk=DirectoryConfiguration.SINGLETON_PK)


def login(identifier: str, password: str = PASSWORD):
    return APIClient().post(LOGIN, {"email": identifier, "password": password}, format="json")


def session(identifier: str, password: str = PASSWORD) -> tuple[APIClient, dict[str, Any]]:
    response = login(identifier, password)
    assert response.status_code == 200, response.content
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.json()['tokens']['access']}")
    return client, response.json()


def give_role(user, code: str) -> None:
    UserRole.objects.create(user=user, role=Role.objects.get(code=code))


def as_user(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user)
    return client
