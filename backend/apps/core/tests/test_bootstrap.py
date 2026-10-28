"""
`manage.py bootstrap` and `manage.py reset_database`, and the fresh initial migrations they rely on.

The wipe command never touches a database here: its guards are checked, and the part that runs SQL
is replaced. The migrations are the ones in the repository, built from nothing in the test database.
"""

from __future__ import annotations

from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection

from apps.core.management.commands import bootstrap, reset_database

pytestmark = pytest.mark.django_db

ADMIN = "boss@example.com"
STRONG = "Correct-Horse-Battery-9!"


def run(*args: str) -> str:
    out = StringIO()
    call_command("bootstrap", "--no-migrate", *args, stdout=out, stderr=StringIO())
    return out.getvalue()


def admin_user():
    from django.contrib.auth import get_user_model

    return get_user_model().all_objects.get(email=ADMIN)


@pytest.fixture
def env(monkeypatch):
    """A development environment with the admin's email and password supplied."""
    monkeypatch.setenv("DJANGO_ENV", "testing")
    monkeypatch.setenv("INITIAL_ADMIN_EMAIL", ADMIN)
    monkeypatch.setenv("INITIAL_ADMIN_PASSWORD", STRONG)
    return monkeypatch


@pytest.mark.usefixtures("seeded_platform_class")
class TestBootstrap:
    def test_it_creates_a_working_superuser_with_the_admin_role(self, env):
        output = run()

        user = admin_user()
        assert user.is_superuser and user.is_staff and user.is_active
        assert user.check_password(STRONG)
        assert user.profile.must_change_password is True
        from apps.identity.models import UserRole

        assert list(UserRole.objects.filter(user=user).values_list("role__code", flat=True)) == [
            "platform-admin"
        ]
        assert "created" in output

    def test_the_password_is_never_printed(self, env):
        output = run()

        assert STRONG not in output
        assert bootstrap.DEV_ADMIN_PASSWORD not in output

    def test_running_again_keeps_the_account_and_its_password(self, env):
        run()
        user = admin_user()
        user.set_password("Changed-By-The-Admin-7!")
        user.save()
        profile = user.profile
        profile.must_change_password = False
        profile.save()

        output = run()

        again = admin_user()
        assert again.pk == user.pk and again.check_password("Changed-By-The-Admin-7!")
        assert again.profile.must_change_password is False
        assert "already exists" in output
        assert "Password:" not in output

    def test_reset_password_sets_it_again_and_forces_a_change(self, env):
        run()
        user = admin_user()
        user.set_password("Changed-By-The-Admin-7!")
        user.save()

        run("--reset-password")

        again = admin_user()
        assert again.check_password(STRONG)
        assert again.profile.must_change_password is True

    def test_a_demoted_admin_gets_the_flags_back(self, env):
        run()
        user = admin_user()
        user.is_superuser = user.is_staff = False
        user.is_active = False
        user.save()

        run()

        again = admin_user()
        assert again.is_superuser and again.is_staff and again.is_active

    def test_it_still_works_when_the_shared_cache_is_down(self, env, monkeypatch):
        from django.core.cache.backends.locmem import LocMemCache

        real_get = LocMemCache.get

        def get(self, key, *args, **kwargs):
            if key == "bootstrap-ping" and self._name != "bootstrap":
                raise ConnectionError("redis is not reachable")
            return real_get(self, key, *args, **kwargs)

        monkeypatch.setattr(LocMemCache, "get", get)

        output = run()

        assert admin_user().check_password(STRONG)
        assert "not reachable" in output

    def test_development_defaults_are_used_only_where_allowed(self, monkeypatch):
        monkeypatch.setenv("DJANGO_ENV", "testing")
        monkeypatch.delenv("INITIAL_ADMIN_EMAIL", raising=False)
        monkeypatch.delenv("INITIAL_ADMIN_PASSWORD", raising=False)

        output = run()

        from django.contrib.auth import get_user_model

        user = get_user_model().objects.get(email=bootstrap.DEV_ADMIN_EMAIL)
        assert user.check_password(bootstrap.DEV_ADMIN_PASSWORD)
        assert "development default" in output and bootstrap.DEV_ADMIN_PASSWORD not in output


class TestBootstrapRefusals:
    @pytest.mark.parametrize("environment", ["production", "docker", "ci", "staging"])
    def test_no_password_outside_development_is_an_error_and_changes_nothing(
        self, monkeypatch, environment
    ):
        monkeypatch.setenv("DJANGO_ENV", environment)
        monkeypatch.setenv("INITIAL_ADMIN_EMAIL", ADMIN)
        monkeypatch.delenv("INITIAL_ADMIN_PASSWORD", raising=False)

        with pytest.raises(CommandError, match="INITIAL_ADMIN_PASSWORD is required"):
            run()

        from django.contrib.auth import get_user_model

        assert not get_user_model().all_objects.exists()

    def test_no_email_outside_development_is_an_error(self, monkeypatch):
        monkeypatch.setenv("DJANGO_ENV", "production")
        monkeypatch.setenv("INITIAL_ADMIN_PASSWORD", STRONG)
        monkeypatch.delenv("INITIAL_ADMIN_EMAIL", raising=False)

        with pytest.raises(CommandError, match="INITIAL_ADMIN_EMAIL is required"):
            run()

    @pytest.mark.parametrize("weak", ["short1!", "password123", "12345678901234"])
    def test_a_weak_supplied_password_is_refused(self, monkeypatch, weak):
        monkeypatch.setenv("DJANGO_ENV", "production")
        monkeypatch.setenv("INITIAL_ADMIN_EMAIL", ADMIN)
        monkeypatch.setenv("INITIAL_ADMIN_PASSWORD", weak)

        with pytest.raises(CommandError, match="not acceptable") as caught:
            run()

        assert weak not in str(caught.value)


class TestResetDatabase:
    @pytest.fixture(autouse=True)
    def _no_sql(self, monkeypatch):
        """Replace the part that drops tables; the guards in front of it are what is tested."""
        self.wiped: list[str] = []

        def fake(_self, name):
            self.wiped.append(name)
            return 5, []

        monkeypatch.setattr(reset_database.Command, "_wipe", fake)

    def wipe(self, *args: str) -> str:
        out = StringIO()
        call_command("reset_database", *args, stdout=out, stderr=StringIO())
        return out.getvalue()

    def test_it_needs_the_name_repeated_and_changes_nothing_without_it(self, monkeypatch):
        monkeypatch.setenv("DJANGO_ENV", "testing")

        with pytest.raises(CommandError, match="Nothing was changed"):
            self.wipe("--name", "some_db")
        with pytest.raises(CommandError, match="Nothing was changed"):
            self.wipe("--name", "some_db", "--yes-wipe", "another_db")
        with pytest.raises(CommandError, match="Nothing was changed"):
            self.wipe()

        assert self.wiped == []

    def test_the_message_names_the_database_it_would_wipe(self, monkeypatch):
        monkeypatch.setenv("DJANGO_ENV", "testing")

        with pytest.raises(CommandError) as caught:
            self.wipe("--name", "some_db")

        assert "/some_db as " in str(caught.value) and "--yes-wipe some_db" in str(caught.value)

    @pytest.mark.parametrize("environment", ["production", "staging", "anything-else"])
    def test_it_refuses_outside_development_even_when_confirmed(self, monkeypatch, environment):
        monkeypatch.setenv("DJANGO_ENV", environment)

        with pytest.raises(CommandError, match="Refusing to run"):
            self.wipe("--name", "some_db", "--yes-wipe", "some_db")

        assert self.wiped == []

    def test_confirmed_in_development_it_wipes_the_named_database_only(self, monkeypatch):
        monkeypatch.setenv("DJANGO_ENV", "testing")

        output = self.wipe("--name", "some_db", "--yes-wipe", "some_db")

        assert self.wiped == ["some_db"]
        assert "5 tables removed" in output

    def test_tables_it_cannot_drop_are_reported_not_hidden(self, monkeypatch):
        monkeypatch.setenv("DJANGO_ENV", "testing")
        monkeypatch.setattr(
            reset_database.Command, "_wipe", lambda _self, _name: (3, ["theirs_a", "theirs_b"])
        )

        with pytest.raises(CommandError, match="2 tables are still there.*theirs_a"):
            self.wipe("--name", "some_db", "--yes-wipe", "some_db")


class TestFreshInitialMigrations:
    """The repository's migrations, applied from nothing, leave what a new project needs."""

    def test_the_models_and_the_migrations_agree(self):
        call_command("makemigrations", check=True, dry_run=True, verbosity=0)

    def test_there_is_one_initial_migration_chain_per_app(self):
        from django.db.migrations.loader import MigrationLoader

        loader = MigrationLoader(connection)
        for app in ("audit", "core", "deliveries", "identity", "masterdata", "production"):
            names = sorted(name for label, name in loader.disk_migrations if label == app)
            assert names and names[0] == "0001_initial", (app, names)
            assert len(names) <= 2, (app, names)  # 0002 only where apps depend on each other

    @pytest.mark.skipif(connection.vendor != "postgresql", reason="the extension is PostgreSQL's")
    def test_btree_gist_is_installed_for_the_exclusion_constraints(self):
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM pg_extension WHERE extname = 'btree_gist'")
            assert cursor.fetchone() is not None

    def test_the_default_work_calendar_is_seeded(self):
        from apps.scheduling.models import WorkCalendar

        calendar = WorkCalendar.objects.get(is_default=True)

        assert calendar.code == "STUDIO" and calendar.working_weekdays == [1, 2, 3, 4, 5]
