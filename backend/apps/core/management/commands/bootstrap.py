"""
Set up a new database: migrate, seed the platform reference data and create the first superuser.

Safe to run again: migrations that are applied are skipped, the reference data is upserted by
``init_platform``, and an existing superuser is kept as it is (``--reset-password`` changes it).

The superuser's email and password come from ``INITIAL_ADMIN_EMAIL`` and ``INITIAL_ADMIN_PASSWORD``.
Only with ``DJANGO_ENV`` ``local`` or ``testing`` may they be left out: the development defaults below
are used then. Anywhere else the password is required, must pass the password validators, and the
command never prints it. In every case the account must change its password at first login.
"""

from __future__ import annotations

import os
from contextlib import nullcontext
from typing import Any

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.test.utils import override_settings

#: development only; see the module notes
DEV_ADMIN_EMAIL = "admin@studiohub.local"
DEV_ADMIN_PASSWORD = "ChangeMe-Dev-2026!"  # noqa: S105 (documented development default)
DEV_ENVIRONMENTS = ("local", "testing")

ADMIN_ROLE_CODE = "platform-admin"

#: used while the configured cache (Redis) cannot be reached; see ``_cache_fallback``
_LOCAL_CACHE = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "bootstrap",
    }
}


def _environment() -> str:
    return os.getenv("DJANGO_ENV", "local")


class Command(BaseCommand):
    help = "Migrate, seed the platform reference data and create the first superuser."

    def add_arguments(self, parser):
        parser.add_argument(
            "--no-migrate",
            action="store_true",
            help="Skip `migrate` (the schema is already there).",
        )
        parser.add_argument(
            "--reset-password",
            action="store_true",
            help="Set the existing superuser's password again from INITIAL_ADMIN_PASSWORD.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        email, password, from_dev_default = self._credentials()

        if not options["no_migrate"]:
            self.stdout.write("Applying migrations ...")
            call_command("migrate", interactive=False, verbosity=0)
        with self._cache_fallback():
            call_command("init_platform", stdout=self.stdout)
            self._default_calendar()
            created = self._superuser(email, password, reset=options["reset_password"])

        verb = "created" if created else "already exists"
        self.stdout.write(self.style.SUCCESS(f"Superuser {email} {verb}."))
        if created or options["reset_password"]:
            source = (
                "the development default password (see docs/setup/BOOTSTRAP.md)"
                if from_dev_default
                else "INITIAL_ADMIN_PASSWORD"
            )
            self.stdout.write(f"Password: {source}. It must be changed at the first login.")

    # ------------------------------------------------------------------

    def _cache_fallback(self):
        """
        Assigning a role clears the holder's cached permissions, which talks to the cache. A fresh
        setup must not need Redis to be up, so when the configured cache cannot be reached the work
        runs on a local one instead; nothing is lost, as the cache only speeds permission checks up
        and the new account has nothing cached yet.
        """
        from django.core.cache import cache

        try:
            cache.get("bootstrap-ping")
        except Exception:  # noqa: BLE001 (any backend error means "not reachable")
            self.stdout.write(
                self.style.WARNING(
                    "The configured cache is not reachable; using a local one for this run. "
                    "Clear the shared cache when it is up if it held permissions from an older database."
                )
            )
            return override_settings(CACHES=_LOCAL_CACHE)
        return nullcontext()

    def _credentials(self) -> tuple[str, str, bool]:
        """(email, password, whether the development default password is used)."""
        email = os.getenv("INITIAL_ADMIN_EMAIL", "").strip().lower()
        password = os.getenv("INITIAL_ADMIN_PASSWORD", "")
        env = _environment()
        if not password and env not in DEV_ENVIRONMENTS:
            raise CommandError(
                f"INITIAL_ADMIN_PASSWORD is required when DJANGO_ENV={env!r}. Nothing was changed."
            )
        if not email and env not in DEV_ENVIRONMENTS:
            raise CommandError(
                f"INITIAL_ADMIN_EMAIL is required when DJANGO_ENV={env!r}. Nothing was changed."
            )
        from_dev_default = not password
        email = email or DEV_ADMIN_EMAIL
        password = password or DEV_ADMIN_PASSWORD
        if not from_dev_default:
            try:
                validate_password(password)
            except ValidationError as exc:
                raise CommandError(
                    "INITIAL_ADMIN_PASSWORD is not acceptable: " + " ".join(exc.messages)
                ) from None
        return email, password, from_dev_default

    @staticmethod
    def _default_calendar() -> None:
        """The default work calendar is seeded by a migration; this restores it if it was deleted."""
        from apps.scheduling.services.calendar import WorkCalendarService

        WorkCalendarService.ensure_default()

    @staticmethod
    @transaction.atomic
    def _superuser(email: str, password: str, *, reset: bool) -> bool:
        from apps.identity.models import Profile, Role, User, UserRole

        user = User.all_objects.filter(email__iexact=email).first()
        created = user is None
        if user is None:
            user = User.objects.create_superuser(email=email, password=password)
        else:
            if user.is_deleted:
                raise CommandError(f"{email} is a soft-deleted user; restore or remove it first.")
            user.is_active = user.is_staff = user.is_superuser = True
            if reset:
                user.set_password(password)
            user.save()

        profile, _ = Profile.objects.get_or_create(
            user=user,
            defaults={
                "first_name": "Platform",
                "last_name": "Admin",
                "display_name": "Platform Admin",
                "timezone": "Asia/Kolkata",
                "language": "en",
            },
        )
        if created or reset:
            profile.must_change_password = True
            profile.save(update_fields=["must_change_password"])

        role = Role.objects.filter(code=ADMIN_ROLE_CODE).first()
        if role is None:
            raise CommandError(
                f"Role {ADMIN_ROLE_CODE!r} is missing; init_platform did not seed it."
            )
        UserRole.objects.get_or_create(user=user, role=role)
        return created
