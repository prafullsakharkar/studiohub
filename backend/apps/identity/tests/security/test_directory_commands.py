"""``ldap_sync`` and ``ldap_link`` (ADR-0039 decisions 6 and 10, CR-40 WP L.6)."""

from __future__ import annotations

from io import StringIO

import pytest
from django.core.cache import cache
from django.core.management import CommandError, call_command

from apps.identity.models import ExternalIdentity, User, UserSession
from apps.identity.tests.directory_helpers import (
    LOCAL_PASSWORD,
    FakeDirectory,
    configure,
    login,
    session,
)
from apps.identity.tests.factories import UserFactory

pytestmark = [pytest.mark.django_db, pytest.mark.usefixtures("seeded_platform_module")]


@pytest.fixture(autouse=True)
def _clean_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def directory(monkeypatch):
    fake = FakeDirectory()
    fake.install(monkeypatch)
    return fake


def _run(*args):
    out = StringIO()
    call_command(*args, stdout=out)
    return out.getvalue()


class TestLdapSync:
    def test_a_leaver_is_deactivated_and_signed_out(self, directory):
        configure()
        dn = directory.add("leaver")
        directory.add("stayer")
        session("leaver")
        session("stayer")
        directory.remove(dn)

        out = _run("ldap_sync")

        leaver = User.objects.get(email="leaver@studio.test")
        assert leaver.is_active is False
        assert not UserSession.objects.filter(user=leaver, status="active").exists()
        assert User.objects.get(email="stayer@studio.test").is_active is True
        assert "deactivated: leaver" in out

    def test_names_are_refreshed(self, directory):
        configure()
        dn = directory.add("jdoe", given="Jane")
        session("jdoe")
        directory.remove(dn)
        directory.add("jdoe", given="Janet")

        _run("ldap_sync")

        user = ExternalIdentity.objects.get(username="jdoe").user
        assert user.profile.first_name == "Janet"

    def test_a_dry_run_changes_nothing(self, directory):
        configure()
        dn = directory.add("leaver")
        session("leaver")
        directory.remove(dn)

        out = _run("ldap_sync", "--dry-run")

        assert User.objects.get(email="leaver@studio.test").is_active is True
        assert "would deactivate: leaver" in out

    def test_an_outage_changes_nothing(self, directory):
        configure()
        directory.add("jdoe")
        session("jdoe")
        directory.down = True

        with pytest.raises(CommandError):
            _run("ldap_sync")

        assert User.objects.get(email="jdoe@studio.test").is_active is True

    def test_it_refuses_while_sign_in_is_off(self, directory):
        configure(enabled=False)

        with pytest.raises(CommandError):
            _run("ldap_sync")


class TestLdapLink:
    def _local(self):
        user = UserFactory.create(email="jane@studio.test", is_email_verified=True)
        user.set_password(LOCAL_PASSWORD)
        user.save(update_fields=["password"])
        return user

    def test_it_links_and_the_account_then_signs_in_with_the_username(self, directory):
        configure()
        local = self._local()
        directory.add("jdoe", mail="jane@studio.test")

        _run("ldap_link", "jane@studio.test", "jdoe")

        assert ExternalIdentity.objects.get(user=local).username == "jdoe"
        assert login("jane@studio.test", LOCAL_PASSWORD).status_code == 401
        session("jdoe")
        assert User.objects.filter(email="jane@studio.test").count() == 1

    def test_a_dry_run_links_nothing(self, directory):
        configure()
        self._local()
        directory.add("jdoe")

        _run("ldap_link", "jane@studio.test", "jdoe", "--dry-run")

        assert not ExternalIdentity.objects.exists()

    def test_an_unknown_username_is_refused(self, directory):
        configure()
        self._local()

        with pytest.raises(CommandError):
            _run("ldap_link", "jane@studio.test", "ghost")
