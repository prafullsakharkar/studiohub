"""DOM-MD-PER-10: every user is linked to a person, from creation and by the backfill command."""

from __future__ import annotations

from io import StringIO

import pytest
from django.core.management import call_command

from apps.identity.models import Profile
from apps.identity.tests.factories import UserFactory
from apps.masterdata.models import Person
from apps.masterdata.services.user_person import ensure_person_for_user

pytestmark = pytest.mark.django_db(transaction=True)


def person_of(user):
    return Person.objects.filter(user=user).first()


class TestANewUserGetsAPerson:
    def test_it_is_created_and_linked_with_the_users_name_and_email(self):
        user = UserFactory.create(email="New.Person@Example.com")

        person = person_of(user)

        assert person is not None
        assert person.email == "new.person@example.com"
        assert person.name
        assert Person.objects.filter(user=user).count() == 1

    def test_saving_the_user_again_does_not_add_another(self):
        user = UserFactory.create()
        user.save()
        user.save()

        assert Person.objects.filter(user=user).count() == 1

    def test_the_name_follows_the_profile_afterwards(self):
        user = UserFactory.create()
        Profile.objects.create(user=user, display_name="Renamed Person")

        assert person_of(user).name == "Renamed Person"

    def test_an_unlinked_person_with_the_same_email_is_adopted_not_duplicated(self):
        existing = Person.objects.create(name="Pre-created", email="adopt@example.com")

        user = UserFactory.create(email="adopt@example.com")

        existing.refresh_from_db()
        assert existing.user_id == user.pk
        assert Person.objects.filter(email__iexact="adopt@example.com").count() == 1

    def test_a_failure_never_fails_the_user_write(self, monkeypatch):
        from apps.masterdata.services import person as person_service

        def boom(*args, **kwargs):
            raise RuntimeError("directory is down")

        monkeypatch.setattr(person_service.PersonService, "create", classmethod(boom))

        user = UserFactory.create()

        assert user.pk is not None
        assert person_of(user) is None
        assert ensure_person_for_user(user.pk) == "failed"


class TestEnsure:
    def test_a_user_with_a_person_is_left_alone(self):
        user = UserFactory.create()

        assert ensure_person_for_user(user.pk) == "exists"
        assert Person.objects.filter(user=user).count() == 1

    def test_an_unknown_user_is_reported_not_raised(self):
        from uuid import uuid4

        assert ensure_person_for_user(uuid4()) == "failed"


class TestTheBackfillCommand:
    def run(self, *args):
        out = StringIO()
        call_command("link_users_to_people", *args, stdout=out)
        return out.getvalue()

    def test_it_links_users_that_have_none_and_is_idempotent(self):
        users = [UserFactory.create() for _ in range(3)]
        Person.all_objects.filter(user__in=users).update(user=None)

        dry = self.run("--dry-run")
        assert "users without a person: 3" in dry
        assert Person.objects.filter(user__in=users).count() == 0

        done = self.run()
        assert "adopted: 3" in done or "created: 3" in done
        assert all(person_of(user) for user in users)

        again = self.run()
        assert "created: 0, adopted: 0" in again
