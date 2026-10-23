"""Person rules: the Identity link, owned fields, deactivation (CONTRACTS §5.5, DECISIONS D4)."""

from __future__ import annotations

import datetime

import pytest
from django.core.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.identity.models import Profile
from apps.identity.tests.factories import UserFactory
from apps.masterdata.exceptions import MasterdataConflict
from apps.masterdata.models import Department, Person
from apps.masterdata.services.identity_link import refresh_person_for_user
from apps.masterdata.services.person import PersonService
from apps.masterdata.tests.factories import (
    DepartmentFactory,
    OfficeFactory,
    PersonFactory,
    PositionFactory,
    TeamFactory,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def actor():
    return UserFactory.create()


def make_user(email="ada@example.com", first="Ada", last="Lovelace", display="", **kw):
    user = UserFactory.create(email=email, **kw)
    Profile.objects.create(user=user, first_name=first, last_name=last, display_name=display)
    return user


class TestCreateAndUpdate:
    def test_create_normalizes(self, actor):
        row = PersonService.create(
            actor=actor,
            data={
                "name": "  Grace Hopper ",
                "email": "Grace@Navy.MIL",
                "phone": "+1  555 0100",
                "skills": [" python ", "python", "cobol"],
                "timezone": "America/New_York",
            },
        )
        assert (row.name, row.email, row.phone) == ("Grace Hopper", "grace@navy.mil", "+1 555 0100")
        assert row.skills == ["python", "cobol"]

    def test_user_is_not_writable_through_the_service(self, actor):
        with pytest.raises(ValueError):
            PersonService.create(actor=actor, data={"name": "x", "user": UserFactory.create()})

    def test_names_need_not_be_unique(self, actor):
        PersonFactory(name="Sam Lee")
        assert PersonService.create(actor=actor, data={"name": "sam lee"})

    def test_email_is_unique_ignoring_case_among_live_people(self, actor):
        PersonFactory(email="a@x.io")
        with pytest.raises(ValidationError) as caught:
            PersonService.create(actor=actor, data={"name": "B", "email": "A@X.io"})
        assert "email" in caught.value.message_dict
        PersonService.create(actor=actor, data={"name": "C", "email": ""})
        PersonService.create(actor=actor, data={"name": "D", "email": ""})  # blanks do not collide

    @pytest.mark.parametrize(
        ("field", "value"),
        [
            ("phone", "x" * 21),
            ("phone", "call me"),
            ("timezone", "Nowhere/Land"),
            ("status", "bogus"),
            ("skills", "python"),
            ("date_of_birth", datetime.date(1800, 1, 1)),
            ("nationality", "x" * 101),
        ],
    )
    def test_bad_values_are_refused(self, actor, field, value):
        with pytest.raises(ValidationError) as caught:
            PersonService.create(actor=actor, data={"name": "P", field: value})
        assert field in caught.value.message_dict

    def test_a_birth_date_in_the_future_is_refused(self, actor):
        tomorrow = datetime.date.today() + datetime.timedelta(days=1)
        with pytest.raises(ValidationError):
            PersonService.create(actor=actor, data={"name": "P", "date_of_birth": tomorrow})

    def test_references_must_be_live(self, actor):
        for field, row in (
            ("department", DepartmentFactory(is_deleted=True)),
            ("office", OfficeFactory(is_deleted=True)),
            ("role", PositionFactory(is_deleted=True)),
        ):
            with pytest.raises(ValidationError) as caught:
                PersonService.create(actor=actor, data={"name": "P", field: row})
            assert field in caught.value.message_dict

    def test_the_team_must_belong_to_the_department(self, actor):
        team = TeamFactory()
        other = DepartmentFactory()
        with pytest.raises(ValidationError) as caught:
            PersonService.create(actor=actor, data={"name": "P", "team": team, "department": other})
        assert "team" in caught.value.message_dict
        assert PersonService.create(
            actor=actor, data={"name": "P", "team": team, "department": team.department}
        )

    def test_a_team_without_a_department_is_fine(self, actor):
        assert PersonService.create(actor=actor, data={"name": "P", "team": TeamFactory()})

    def test_an_update_changes_only_what_it_is_given(self, actor):
        row = PersonFactory(email="a@x.io", nationality="CA")
        PersonService.update(actor=actor, instance=row, data={"seniority": "senior"})
        row.refresh_from_db()
        assert (row.email, row.nationality, row.seniority) == ("a@x.io", "CA", "senior")


class TestLink:
    def test_link_copies_name_and_email_from_identity(self, actor):
        person = PersonFactory(name="Old", email="old@x.io")
        user = make_user()
        linked = PersonService.link_user(actor=actor, person=person, user=user)
        assert linked.user == user
        assert (linked.name, linked.email) == ("Ada Lovelace", "ada@example.com")

    def test_a_display_name_wins_over_first_and_last(self, actor):
        user = make_user(display="Countess Ada")
        linked = PersonService.link_user(actor=actor, person=PersonFactory(), user=user)
        assert linked.name == "Countess Ada"

    def test_a_user_without_a_profile_keeps_the_persons_name(self, actor):
        user = UserFactory.create(email="bare@example.com")
        linked = PersonService.link_user(actor=actor, person=PersonFactory(name="Kept"), user=user)
        assert (linked.name, linked.email) == ("Kept", "bare@example.com")

    def test_a_user_can_be_passed_by_id(self, actor):
        user = make_user()
        assert (
            PersonService.link_user(actor=actor, person=PersonFactory(), user=user.pk).user == user
        )

    def test_one_person_per_user(self, actor):
        user = make_user()
        PersonService.link_user(actor=actor, person=PersonFactory(), user=user)
        with pytest.raises(MasterdataConflict) as caught:
            PersonService.link_user(actor=actor, person=PersonFactory(), user=user)
        assert caught.value.code == "conflict"

    def test_a_linked_person_must_be_unlinked_first(self, actor):
        person = PersonFactory()
        PersonService.link_user(actor=actor, person=person, user=make_user())
        with pytest.raises(MasterdataConflict):
            PersonService.link_user(
                actor=actor, person=person, user=make_user("other@example.com", "O", "T")
            )

    def test_an_inactive_or_unknown_user_is_a_400(self, actor):
        for user in (
            make_user("off@example.com", is_active=False),
            "00000000-0000-4000-8000-000000000000",
        ):
            with pytest.raises(ValidationError) as caught:
                PersonService.link_user(actor=actor, person=PersonFactory(), user=user)
            assert "user" in caught.value.message_dict

    def test_an_email_already_used_by_another_person_is_a_conflict(self, actor):
        PersonFactory(email="ada@example.com")
        with pytest.raises(MasterdataConflict):
            PersonService.link_user(actor=actor, person=PersonFactory(), user=make_user())

    def test_unlink_keeps_the_copied_values_and_frees_the_user(self, actor):
        user = make_user()
        person = PersonService.link_user(actor=actor, person=PersonFactory(), user=user)
        person = PersonService.unlink_user(actor=actor, person=person)
        assert person.user is None and person.name == "Ada Lovelace"
        # The unlinked person now owns its e-mail again: it must differ before the user is reused.
        with pytest.raises(MasterdataConflict):
            PersonService.link_user(actor=actor, person=PersonFactory(), user=user)
        PersonService.update(actor=actor, instance=person, data={"email": "ada.private@x.io"})
        assert PersonService.link_user(actor=actor, person=PersonFactory(), user=user)

    def test_unlinking_an_unlinked_person_is_a_conflict(self, actor):
        with pytest.raises(MasterdataConflict):
            PersonService.unlink_user(actor=actor, person=PersonFactory())

    def test_a_deleted_person_does_not_hold_the_user(self, actor):
        user = make_user()
        old = PersonService.link_user(actor=actor, person=PersonFactory(), user=user)
        PersonService.soft_delete(actor=actor, instance=old)
        assert PersonService.link_user(actor=actor, person=PersonFactory(), user=user)
        Person.all_objects.filter(pk=old.pk).update(email="")  # isolate the user clash
        with pytest.raises(MasterdataConflict):
            PersonService.restore(actor=actor, instance=Person.all_objects.get(pk=old.pk))


class TestOwnedByIdentity:
    def test_name_and_email_cannot_be_changed_while_linked(self, actor):
        person = PersonService.link_user(actor=actor, person=PersonFactory(), user=make_user())
        for field, value in (("name", "Someone Else"), ("email", "else@x.io")):
            with pytest.raises(ValidationError) as caught:
                PersonService.update(actor=actor, instance=person, data={field: value})
            assert field in caught.value.message_dict

    def test_sending_the_same_value_is_accepted(self, actor):
        person = PersonService.link_user(actor=actor, person=PersonFactory(), user=make_user())
        PersonService.update(
            actor=actor, instance=person, data={"name": "Ada Lovelace", "seniority": "lead"}
        )
        person.refresh_from_db()
        assert person.seniority == "lead"

    def test_other_fields_stay_editable(self, actor):
        person = PersonService.link_user(actor=actor, person=PersonFactory(), user=make_user())
        PersonService.update(actor=actor, instance=person, data={"phone": "+1 555 0100"})

    def test_an_unlinked_person_owns_its_name_and_email(self, actor):
        person = PersonFactory()
        PersonService.update(actor=actor, instance=person, data={"name": "Changed"})

    def test_identity_changes_follow_after_commit(self, actor, django_capture_on_commit_callbacks):
        user = make_user()
        person = PersonService.link_user(actor=actor, person=PersonFactory(), user=user)
        with django_capture_on_commit_callbacks(execute=True):
            user.email = "ada.new@example.com"
            user.save()
            profile = user.profile
            profile.display_name = "Ada King"
            profile.save()
        person.refresh_from_db()
        assert (person.email, person.name) == ("ada.new@example.com", "Ada King")

    def test_a_login_style_save_triggers_nothing(self, actor, django_capture_on_commit_callbacks):
        user = make_user()
        person = PersonService.link_user(actor=actor, person=PersonFactory(), user=user)
        Person.objects.filter(pk=person.pk).update(name="Drifted")
        with django_capture_on_commit_callbacks(execute=True) as callbacks:
            user.last_seen = datetime.datetime.now(tz=datetime.UTC)
            user.save(update_fields=["last_seen"])
        assert callbacks == []
        person.refresh_from_db()
        assert person.name == "Drifted"

    def test_the_sync_skips_a_clashing_email_and_never_raises(self, actor):
        user = make_user()
        person = PersonService.link_user(actor=actor, person=PersonFactory(), user=user)
        PersonFactory(email="taken@example.com")
        user.email = "taken@example.com"
        user.save()
        assert refresh_person_for_user(user.pk) in (True, False)  # name unchanged, email skipped
        person.refresh_from_db()
        assert person.email == "ada@example.com"

    def test_the_sync_ignores_users_without_a_person(self):
        assert refresh_person_for_user(make_user().pk) is False


class TestDeactivation:
    def make_manager(self):
        person = PersonFactory()
        department = DepartmentFactory(manager=person)
        team = TeamFactory(lead=person)
        office = OfficeFactory(manager=person)
        return person, department, team, office

    def test_deactivating_clears_the_links_and_lists_them(self, actor):
        person, department, team, office = self.make_manager()
        result = PersonService.deactivate(actor=actor, person=person)
        assert result.status == "inactive"
        assert sorted((w["model"], w["field"]) for w in PersonService.warnings(result)) == [
            ("masterdata.Department", "manager"),
            ("masterdata.Office", "manager"),
            ("masterdata.Team", "lead"),
        ]
        for row in (department, team, office):
            row.refresh_from_db()
        assert department.manager is None and team.lead is None and office.manager is None

    def test_a_status_change_through_update_does_the_same(self, actor):
        person, department, *_ = self.make_manager()
        result = PersonService.update(actor=actor, instance=person, data={"status": "archived"})
        assert len(PersonService.warnings(result)) == 3
        department.refresh_from_db()
        assert department.manager is None

    def test_a_person_who_manages_nothing_has_no_warnings(self, actor):
        assert (
            PersonService.warnings(PersonService.deactivate(actor=actor, person=PersonFactory()))
            == []
        )

    def test_deactivating_twice_clears_nothing_the_second_time(self, actor):
        person, *_ = self.make_manager()
        PersonService.deactivate(actor=actor, person=person)
        assert PersonService.warnings(PersonService.deactivate(actor=actor, person=person)) == []

    def test_reactivate(self, actor):
        person = PersonFactory(status="inactive")
        assert PersonService.reactivate(actor=actor, person=person).status == "active"

    def test_deactivate_rejects_other_statuses(self, actor):
        with pytest.raises(ValidationError):
            PersonService.deactivate(actor=actor, person=PersonFactory(), status="draft")

    def test_deleting_a_manager_clears_the_links_too(self, actor):
        person, department, team, office = self.make_manager()
        PersonService.soft_delete(actor=actor, instance=person)
        for row in (department, team, office):
            row.refresh_from_db()
        assert department.manager is None and team.lead is None and office.manager is None
        assert not Person.objects.filter(pk=person.pk).exists()

    def test_the_audit_event_lists_the_cleared_rows_by_id_only(
        self, actor, django_capture_on_commit_callbacks
    ):
        person, department, *_ = self.make_manager()
        with django_capture_on_commit_callbacks(execute=True):
            PersonService.deactivate(actor=actor, person=person)
        log = AuditLog.objects.get(metadata__event="PersonDeactivated")
        assert str(department.pk) in log.metadata["cascade"]
        assert person.name not in f"{log.target_name} {log.description} {log.metadata}"

    def test_a_person_pointing_at_a_deleted_department_cannot_be_restored(self, actor):
        department = DepartmentFactory()
        person = PersonFactory(department=department)
        PersonService.soft_delete(actor=actor, instance=person)
        Department.objects.filter(pk=department.pk).update(is_deleted=True)
        with pytest.raises(MasterdataConflict):
            PersonService.restore(actor=actor, instance=Person.all_objects.get(pk=person.pk))


class TestAudit:
    def test_link_and_unlink_are_audited_without_values(
        self, actor, django_capture_on_commit_callbacks
    ):
        with django_capture_on_commit_callbacks(execute=True):
            person = PersonService.link_user(actor=actor, person=PersonFactory(), user=make_user())
            PersonService.unlink_user(actor=actor, person=person)
        events = list(
            AuditLog.objects.filter(metadata__event__in=["PersonLinked", "PersonUnlinked"])
            .order_by("created_at")
            .values_list("metadata", flat=True)
        )
        assert [e["event"] for e in events] == ["PersonLinked", "PersonUnlinked"]
        assert events[0]["fields"] == ["user", "email", "name"]
        assert "ada@example.com" not in str(events) and "Lovelace" not in str(events)
