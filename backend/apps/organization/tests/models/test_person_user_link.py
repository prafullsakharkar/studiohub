"""
Tests for the Person.user link (N1 consolidation).

Covers the model FK + unique constraint and the 0035 email-match backfill.
The backfill function is invoked directly (inside the test transaction)
rather than through ``MigrationExecutor`` so tests never mutate the
database's applied migration state — mirroring
``tests/migrations/test_normalize_organization_status.py``.

Note: ``identity.User.email`` is unique, so a genuinely ambiguous match is
impossible at the DB level; the backfill still guards defensively.
"""

from __future__ import annotations

import importlib

import pytest
from django.apps import apps
from django.db import IntegrityError

from apps.identity.tests.factories import UserFactory
from apps.organization.tests.factories import OrganizationFactory, PersonFactory

MIGRATION_MODULE = "apps.organization.migrations.0036_backfill_person_user"


@pytest.fixture
def backfill_person_users():
    """Return the migration's backfill function."""
    return importlib.import_module(MIGRATION_MODULE).backfill_person_users


@pytest.mark.django_db
def test_email_match_links_person_to_user(backfill_person_users):
    org = OrganizationFactory.create()
    user = UserFactory.create(email="artist@example.com")
    person = PersonFactory.create(organization=org, name="Artist", email="ARTIST@example.com")

    assert person.user_id is None
    backfill_person_users(apps, None)
    person.refresh_from_db()

    assert person.user_id == user.id


@pytest.mark.django_db
def test_unmatched_and_blank_emails_stay_unlinked(backfill_person_users):
    org = OrganizationFactory.create()
    stranger = PersonFactory.create(organization=org, name="Stranger", email="nobody@example.com")
    blank = PersonFactory.create(organization=org, name="Blank", email="")

    backfill_person_users(apps, None)

    stranger.refresh_from_db()
    blank.refresh_from_db()
    assert stranger.user_id is None
    assert blank.user_id is None


@pytest.mark.django_db
def test_already_linked_persons_are_untouched(backfill_person_users):
    org = OrganizationFactory.create()
    keeper = UserFactory.create(email="keeper@example.com")
    other = UserFactory.create(email="other@example.com")
    person = PersonFactory.create(
        organization=org, name="Keeper", email="other@example.com", user=keeper
    )

    backfill_person_users(apps, None)
    person.refresh_from_db()

    assert person.user_id == keeper.id


@pytest.mark.django_db
def test_user_organization_unique_constraint():
    org = OrganizationFactory.create()
    user = UserFactory.create(email="dup@example.com")
    PersonFactory.create(organization=org, name="First", email="first@example.com", user=user)

    with pytest.raises(IntegrityError):
        PersonFactory.create(organization=org, name="Second", email="second@example.com", user=user)


@pytest.mark.django_db
def test_user_hard_delete_sets_person_user_null():
    org = OrganizationFactory.create()
    user = UserFactory.create(email="gone@example.com")
    person = PersonFactory.create(
        organization=org, name="Gone", email="gone@example.com", user=user
    )

    user.hard_delete()
    person.refresh_from_db()

    assert person.user_id is None


@pytest.mark.django_db
def test_user_soft_delete_keeps_person_user_link():
    org = OrganizationFactory.create()
    user = UserFactory.create(email="soft@example.com")
    person = PersonFactory.create(
        organization=org, name="Soft", email="soft@example.com", user=user
    )

    user.delete()
    person.refresh_from_db()

    # Soft delete flags is_deleted; the link is preserved for audit trail.
    assert person.user_id == user.id
