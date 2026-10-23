"""Department, team, office and position rules (CONTRACTS §5.1 to §5.4)."""

from __future__ import annotations

import pytest
from django.core.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.identity.tests.factories import UserFactory
from apps.masterdata.exceptions import MasterdataConflict
from apps.masterdata.models import Department, Office, Team
from apps.masterdata.services.hierarchy import MAX_DEPTH
from apps.masterdata.services.organization import (
    DepartmentService,
    OfficeService,
    PositionService,
    TeamService,
)
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


def dept(actor, code, name=None, **kw):
    data = {"code": code, "name": name or code, "department_type": "creative", **kw}
    return DepartmentService.create(actor=actor, data=data)


def chain(actor, length):
    """A department chain of ``length`` levels; returns the list root first."""
    rows = []
    for i in range(length):
        rows.append(dept(actor, f"C{i}", parent=rows[-1] if rows else None))
    return rows


class TestDepartment:
    def test_create_normalizes_and_records_the_actor(self, actor):
        row = dept(actor, " comp ", " Compositing ")
        assert (row.code, row.name, row.created_by) == ("comp", "Compositing", actor)

    def test_the_type_must_be_known(self, actor):
        with pytest.raises(ValidationError) as caught:
            DepartmentService.create(
                actor=actor, data={"code": "x", "name": "x", "department_type": "bogus"}
            )
        assert "department_type" in caught.value.message_dict

    @pytest.mark.parametrize("color", ["red", "#abc", "#A1B2C3"])
    def test_good_colors(self, actor, color):
        assert dept(actor, "x", color=color).color == color

    def test_a_bad_color_is_refused(self, actor):
        with pytest.raises(ValidationError) as caught:
            dept(actor, "x", color="not a color!")
        assert "color" in caught.value.message_dict

    def test_code_and_name_are_unique_ignoring_case(self, actor):
        dept(actor, "comp", "Compositing")
        with pytest.raises(ValidationError) as caught:
            dept(actor, "COMP", "compositing")
        assert set(caught.value.message_dict) == {"code", "name"}

    def test_a_deleted_departments_code_can_be_reused_and_restore_then_refuses(self, actor):
        old = dept(actor, "comp", "Compositing")
        DepartmentService.soft_delete(actor=actor, instance=old)
        dept(actor, "comp", "Compositing")
        with pytest.raises(ValidationError):
            DepartmentService.restore(actor=actor, instance=Department.all_objects.get(pk=old.pk))

    def test_the_stack_is_a_clean_list_of_strings(self, actor):
        assert dept(actor, "x", software_stack=[" Nuke ", "Nuke", "Maya"]).software_stack == [
            "Nuke",
            "Maya",
        ]
        with pytest.raises(ValidationError):
            dept(actor, "y", software_stack="Nuke")

    def test_utilization_and_capacity_are_not_writable(self, actor):
        with pytest.raises(ValueError):
            DepartmentService.create(
                actor=actor,
                data={
                    "code": "x",
                    "name": "x",
                    "department_type": "creative",
                    "utilization_percentage": 5,
                },
            )

    def test_a_manager_must_be_a_live_person(self, actor):
        person = PersonFactory(is_deleted=True)
        with pytest.raises(ValidationError) as caught:
            dept(actor, "x", manager=person)
        assert "manager" in caught.value.message_dict
        assert dept(actor, "y", manager=PersonFactory()).manager


class TestHierarchy:
    def test_a_parent_must_be_live(self, actor):
        gone = DepartmentFactory(is_deleted=True)
        with pytest.raises(ValidationError) as caught:
            dept(actor, "x", parent=gone)
        assert "parent" in caught.value.message_dict

    def test_self_parent_is_refused(self, actor):
        row = dept(actor, "a")
        with pytest.raises(ValidationError) as caught:
            DepartmentService.update(actor=actor, instance=row, data={"parent": row})
        assert "its own parent" in str(caught.value)

    def test_a_cycle_is_refused(self, actor):
        a = dept(actor, "a")
        b = dept(actor, "b", parent=a)
        c = dept(actor, "c", parent=b)
        for target in (b, c):
            with pytest.raises(ValidationError) as caught:
                DepartmentService.move(actor=actor, department=a, new_parent=target)
            assert "cycle" in str(caught.value)
        assert Department.objects.get(pk=a.pk).parent is None

    def test_the_limit_is_six_levels(self, actor):
        rows = chain(actor, MAX_DEPTH)
        with pytest.raises(ValidationError) as caught:
            dept(actor, "too-deep", parent=rows[-1])
        assert "at most 6 levels" in str(caught.value)
        assert dept(actor, "ok", parent=rows[-2])  # the sixth level is fine

    def test_moving_a_subtree_counts_its_height(self, actor):
        deep = chain(actor, 4)  # levels 1..4
        other = dept(actor, "other-root")
        target = dept(actor, "t1", parent=dept(actor, "t0", parent=other))  # level 3
        with pytest.raises(ValidationError):
            # the 4-level subtree under a level-3 node would reach level 7
            DepartmentService.move(actor=actor, department=deep[0], new_parent=target)
        assert Department.objects.get(pk=deep[0].pk).parent is None
        DepartmentService.move(actor=actor, department=deep[0], new_parent=other)  # level 5: ok

    def test_move_to_root(self, actor):
        a = dept(actor, "a")
        b = dept(actor, "b", parent=a)
        assert DepartmentService.move(actor=actor, department=b, new_parent=None).parent is None

    def test_positions_follow_the_same_rules(self, actor):
        a = PositionService.create(actor=actor, data={"code": "a", "name": "A"})
        b = PositionService.create(actor=actor, data={"code": "b", "name": "B", "parent": a})
        with pytest.raises(ValidationError):
            PositionService.update(actor=actor, instance=a, data={"parent": b})
        with pytest.raises(ValidationError):
            PositionService.update(actor=actor, instance=a, data={"parent": a})
        rows = [a]
        for i in range(MAX_DEPTH - 1):
            rows.append(
                PositionService.create(
                    actor=actor, data={"code": f"p{i}", "name": f"P{i}", "parent": rows[-1]}
                )
            )
        with pytest.raises(ValidationError):
            PositionService.create(
                actor=actor, data={"code": "deep", "name": "Deep", "parent": rows[-1]}
            )


class TestDeleteAndRestore:
    def test_a_department_with_anything_still_pointing_at_it_cannot_be_deleted(self, actor):
        parent = DepartmentFactory()
        DepartmentFactory(parent=parent)
        with pytest.raises(MasterdataConflict) as caught:
            DepartmentService.soft_delete(actor=actor, instance=parent)
        assert caught.value.code == "has_dependants"

    @pytest.mark.parametrize(
        "make",
        [
            lambda d: TeamFactory(department=d),
            lambda d: PositionFactory(department=d),
            lambda d: PersonFactory(department=d),
        ],
        ids=["team", "position", "person"],
    )
    def test_each_kind_of_dependant_blocks_the_delete(self, actor, make):
        row = DepartmentFactory()
        make(row)
        with pytest.raises(MasterdataConflict):
            DepartmentService.soft_delete(actor=actor, instance=row)

    def test_a_deleted_dependant_does_not_block(self, actor):
        row = DepartmentFactory()
        TeamFactory(department=row, is_deleted=True)
        DepartmentService.soft_delete(actor=actor, instance=row)
        assert not Department.objects.filter(pk=row.pk).exists()

    def test_team_office_and_position_with_people_cannot_be_deleted(self, actor):
        team, office, position = TeamFactory(), OfficeFactory(), PositionFactory()
        PersonFactory(team=team, office=office, role=position)
        for service, row in (
            (TeamService, team),
            (OfficeService, office),
            (PositionService, position),
        ):
            with pytest.raises(MasterdataConflict) as caught:
                service.soft_delete(actor=actor, instance=row)
            assert caught.value.code == "has_dependants"

    def test_an_unused_row_deletes_restores_and_hard_deletes(self, actor):
        row = TeamFactory()
        TeamService.soft_delete(actor=actor, instance=row)
        assert not Team.objects.filter(pk=row.pk).exists()
        TeamService.restore(actor=actor, instance=Team.all_objects.get(pk=row.pk))
        assert Team.objects.filter(pk=row.pk).exists()
        with pytest.raises(MasterdataConflict) as caught:
            TeamService.hard_delete(actor=actor, instance=row)
        assert caught.value.code == "not_soft_deleted"
        TeamService.soft_delete(actor=actor, instance=row)
        TeamService.hard_delete(actor=actor, instance=Team.all_objects.get(pk=row.pk))
        assert not Team.all_objects.filter(pk=row.pk).exists()

    def test_a_row_cannot_be_restored_under_a_deleted_parent(self, actor):
        parent = dept(actor, "p")
        child = dept(actor, "c", parent=parent)
        DepartmentService.soft_delete(actor=actor, instance=child)
        DepartmentService.soft_delete(actor=actor, instance=parent)
        with pytest.raises(MasterdataConflict) as caught:
            DepartmentService.restore(actor=actor, instance=Department.all_objects.get(pk=child.pk))
        assert caught.value.code == "conflict"

    def test_a_team_cannot_be_restored_into_a_deleted_department(self, actor):
        row = TeamFactory()
        TeamService.soft_delete(actor=actor, instance=row)
        DepartmentService.soft_delete(actor=actor, instance=row.department)
        with pytest.raises(MasterdataConflict):
            TeamService.restore(actor=actor, instance=Team.all_objects.get(pk=row.pk))


class TestTeam:
    def test_the_department_is_required_and_live(self, actor):
        with pytest.raises(ValidationError) as caught:
            TeamService.create(actor=actor, data={"code": "t", "name": "T"})
        assert "department" in caught.value.message_dict
        gone = DepartmentFactory(is_deleted=True)
        with pytest.raises(ValidationError):
            TeamService.create(actor=actor, data={"code": "t", "name": "T", "department": gone})

    def test_the_lead_must_be_a_live_person(self, actor):
        row = DepartmentFactory()
        with pytest.raises(ValidationError) as caught:
            TeamService.create(
                actor=actor,
                data={
                    "code": "t",
                    "name": "T",
                    "department": row,
                    "lead": PersonFactory(is_deleted=True),
                },
            )
        assert "lead" in caught.value.message_dict

    def test_names_are_unique_across_teams(self, actor):
        TeamFactory(name="Roto")
        with pytest.raises(ValidationError) as caught:
            TeamService.create(
                actor=actor,
                data={"code": "t2", "name": "roto", "department": DepartmentFactory()},
            )
        assert "name" in caught.value.message_dict

    def test_capacity_and_free_text_limits(self, actor):
        base = {"code": "t", "name": "T", "department": DepartmentFactory()}
        with pytest.raises(ValidationError):
            TeamService.create(actor=actor, data={**base, "capacity": -1})
        with pytest.raises(ValidationError):
            TeamService.create(actor=actor, data={**base, "current_project_code": "x" * 17})


class TestOffice:
    base = {
        "office_type": "studio",
        "timezone": "Asia/Kolkata",
        "country": "India",
        "city": "Pune",
    }

    def make(self, actor, code, **kw):
        return OfficeService.create(
            actor=actor, data={"code": code, "name": kw.pop("name", code), **self.base, **kw}
        )

    @pytest.mark.parametrize("zone", ["Mars/Olympus", "IST", "", "Asia/Kolkata (IST)"])
    def test_the_timezone_must_be_an_iana_name(self, actor, zone):
        with pytest.raises(ValidationError) as caught:
            self.make(actor, "o", timezone=zone)
        assert "timezone" in caught.value.message_dict

    def test_required_fields(self, actor):
        with pytest.raises(ValidationError) as caught:
            OfficeService.create(actor=actor, data={"code": "o", "name": "O"})
        assert {"office_type", "timezone", "country", "city"} <= set(caught.value.message_dict)

    def test_one_headquarters_naming_a_new_one_demotes_the_old(self, actor):
        first = self.make(actor, "a", is_headquarters=True)
        second = self.make(actor, "b", is_headquarters=True)
        first.refresh_from_db()
        assert (first.is_headquarters, second.is_headquarters) == (False, True)
        OfficeService.update(actor=actor, instance=first, data={"is_headquarters": True})
        second.refresh_from_db()
        assert Office.objects.filter(is_headquarters=True).count() == 1
        assert not second.is_headquarters

    def test_a_deleted_headquarters_does_not_hold_the_flag(self, actor):
        first = self.make(actor, "a", is_headquarters=True)
        OfficeService.soft_delete(actor=actor, instance=first)
        assert self.make(actor, "b", is_headquarters=True).is_headquarters

    def test_restoring_a_headquarters_refuses_when_another_exists(self, actor):
        first = self.make(actor, "a", is_headquarters=True)
        OfficeService.soft_delete(actor=actor, instance=first)
        self.make(actor, "b", is_headquarters=True)
        with pytest.raises(MasterdataConflict):
            OfficeService.restore(actor=actor, instance=Office.all_objects.get(pk=first.pk))

    def test_headcount_cannot_be_written(self, actor):
        with pytest.raises(ValueError):
            self.make(actor, "o", headcount=9)

    def test_counts_and_contact_data_are_validated(self, actor):
        with pytest.raises(ValidationError):
            self.make(actor, "o", workstations_count=-1)
        with pytest.raises(ValidationError):
            self.make(actor, "p", email="nope")
        with pytest.raises(ValidationError):
            self.make(actor, "q", phone="call us")
        assert self.make(actor, "r", email="A@B.io", phone="+44 20 7946 0000").email == "a@b.io"


class TestPosition:
    def test_level_is_at_least_one(self, actor):
        for bad in (0, -1, "2", True):
            with pytest.raises(ValidationError):
                PositionService.create(actor=actor, data={"code": "p", "name": "P", "level": bad})
        assert PositionService.create(actor=actor, data={"code": "p", "name": "P", "level": 3})

    def test_the_department_must_be_live(self, actor):
        with pytest.raises(ValidationError):
            PositionService.create(
                actor=actor,
                data={"code": "p", "name": "P", "department": DepartmentFactory(is_deleted=True)},
            )

    def test_a_position_with_children_cannot_be_deleted(self, actor):
        parent = PositionFactory()
        PositionFactory(parent=parent)
        with pytest.raises(MasterdataConflict):
            PositionService.soft_delete(actor=actor, instance=parent)


class TestAudit:
    def test_events_carry_codes_and_field_names_only(
        self, actor, django_capture_on_commit_callbacks
    ):
        with django_capture_on_commit_callbacks(execute=True):
            row = DepartmentService.create(
                actor=actor,
                data={"code": "comp", "name": "Compositing", "department_type": "creative"},
            )
            DepartmentService.update(actor=actor, instance=row, data={"description": "secret text"})
        logs = list(AuditLog.objects.filter(target_type="masterdata").order_by("created_at"))
        assert [log.metadata["event"] for log in logs] == [
            "MasterdataRecordCreated",
            "MasterdataRecordUpdated",
        ]
        assert logs[1].metadata["changed"] == ["description"]
        assert "secret text" not in str([log.metadata for log in logs])
