"""Database-level guarantees for the organizational models, bypassing the services."""

from __future__ import annotations

import pytest
from django.db import IntegrityError, transaction

from apps.identity.tests.factories import UserFactory
from apps.masterdata.tests.factories import (
    DepartmentFactory,
    OfficeFactory,
    PersonFactory,
    PositionFactory,
    TeamFactory,
)

pytestmark = pytest.mark.django_db


def must_fail(fn):
    with pytest.raises(IntegrityError), transaction.atomic():
        fn()


@pytest.mark.parametrize(
    "factory", [DepartmentFactory, TeamFactory, OfficeFactory, PositionFactory]
)
class TestCodeAndName:
    def test_code_is_unique_ignoring_case_among_live_rows(self, factory):
        factory(code="abc")
        must_fail(lambda: factory(code="ABC"))

    def test_name_is_unique_ignoring_case_among_live_rows(self, factory):
        factory(name="Same")
        must_fail(lambda: factory(name="SAME"))

    def test_a_deleted_row_does_not_hold_either(self, factory):
        factory(code="abc", name="Same", is_deleted=True)
        assert factory(code="abc", name="Same")


class TestHierarchy:
    def test_a_department_cannot_be_its_own_parent(self):
        row = DepartmentFactory()
        row.parent = row
        must_fail(row.save)

    def test_a_position_cannot_be_its_own_parent(self):
        row = PositionFactory()
        row.parent = row
        must_fail(row.save)

    def test_a_position_level_is_at_least_one(self):
        must_fail(lambda: PositionFactory(level=0))
        assert PositionFactory(level=1)

    def test_a_parent_that_is_another_row_is_fine(self):
        assert DepartmentFactory(parent=DepartmentFactory())
        assert PositionFactory(parent=PositionFactory())


class TestHeadquarters:
    def test_one_live_headquarters(self):
        OfficeFactory(is_headquarters=True)
        must_fail(lambda: OfficeFactory(is_headquarters=True))
        assert OfficeFactory(is_headquarters=False)

    def test_a_deleted_headquarters_does_not_count(self):
        OfficeFactory(is_headquarters=True, is_deleted=True)
        assert OfficeFactory(is_headquarters=True)


class TestPerson:
    def test_one_live_person_per_user(self):
        user = UserFactory.create()
        PersonFactory(user=user)
        must_fail(lambda: PersonFactory(user=user))

    def test_a_deleted_person_does_not_hold_the_user(self):
        user = UserFactory.create()
        PersonFactory(user=user, is_deleted=True)
        assert PersonFactory(user=user)

    def test_people_without_users_do_not_collide(self):
        assert PersonFactory() and PersonFactory()

    def test_email_is_unique_ignoring_case_among_live_people(self):
        PersonFactory(email="a@x.io")
        must_fail(lambda: PersonFactory(email="A@X.IO"))

    def test_blank_emails_and_deleted_rows_do_not_collide(self):
        PersonFactory(email="")
        assert PersonFactory(email="")
        PersonFactory(email="b@x.io", is_deleted=True)
        assert PersonFactory(email="b@x.io")
