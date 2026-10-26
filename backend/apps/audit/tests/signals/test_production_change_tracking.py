"""
Change tracking of production records (WP D5).

Episode, Review, Timelog and ProjectMembership are tracked like Shot and Task,
and for production models a swapped foreign key (episode, assignee, reviewer)
is part of the diff. The audit columns never are.
"""

from __future__ import annotations

import pytest

from apps.audit.models import ChangeLog
from apps.identity.tests.factories import UserFactory
from apps.production.models import ProjectMembership
from apps.production.tests.factories import (
    EpisodeFactory,
    ProjectFactory,
    ReviewFactory,
    ShotFactory,
    TaskFactory,
    TimelogFactory,
)

pytestmark = pytest.mark.django_db


def _changes(target_type, target_id, change_type=None):
    qs = ChangeLog.objects.filter(target_type=target_type, target_id=str(target_id))
    if change_type:
        qs = qs.filter(change_type=change_type)
    return list(qs.order_by("created_at"))


@pytest.mark.parametrize(
    ("model_name", "build"),
    [
        ("Episode", lambda: EpisodeFactory.create(project=ProjectFactory.create(code="CT1"))),
        ("Review", lambda: ReviewFactory.create(project=ProjectFactory.create(code="CT2"))),
        ("Timelog", lambda: TimelogFactory.create()),
        (
            "ProjectMembership",
            lambda: ProjectMembership.objects.create(
                user=UserFactory.create(), project=ProjectFactory.create(code="CT3"), role="Artist"
            ),
        ),
    ],
)
def test_newly_tracked_models_write_a_create_row(model_name, build):
    instance = build()

    assert _changes(model_name, instance.pk, ChangeLog.CHANGE_CREATE)


def test_swapped_foreign_key_is_part_of_the_diff():
    project = ProjectFactory.create(code="CT4", workflow_type="episodic")
    first = EpisodeFactory.create(project=project, code="EP101")
    second = EpisodeFactory.create(project=project, code="EP102")
    shot = ShotFactory.create(project=project, code="S1", episode=first)

    shot.episode = second
    shot.save()

    (update,) = _changes("Shot", shot.pk, ChangeLog.CHANGE_UPDATE)
    assert update.changed_fields == ["episode_id"]
    assert update.before_values["episode_id"] == str(first.pk)
    assert update.after_values["episode_id"] == str(second.pk)


def test_assignee_and_reviewer_changes_are_tracked():
    project = ProjectFactory.create(code="CT5")
    task = TaskFactory.create(project=project, code="T1")
    artist, reviewer = UserFactory.create(), UserFactory.create()

    task.assignee = artist
    task.reviewer = reviewer
    task.save()

    (update,) = _changes("Task", task.pk, ChangeLog.CHANGE_UPDATE)
    assert update.changed_fields == ["assignee_id", "reviewer_id"]
    assert update.before_values["assignee_id"] == ""
    assert update.after_values["assignee_id"] == str(artist.pk)


def test_audit_columns_and_untouched_saves_write_nothing():
    project = ProjectFactory.create(code="CT6")
    shot = ShotFactory.create(project=project, code="S1")
    editor = UserFactory.create()

    shot.updated_by = editor
    shot.save()  # only an audit column changed
    shot.save()  # nothing changed

    assert _changes("Shot", shot.pk, ChangeLog.CHANGE_UPDATE) == []


def test_models_outside_production_keep_their_relations_out_of_the_diff():
    from apps.identity.models import Role, UserRole

    user = UserFactory.create()
    role = Role.objects.create(code="ct-role", name="CT Role")
    link = UserRole.objects.create(user=user, role=role)

    (created,) = _changes("UserRole", link.pk, ChangeLog.CHANGE_CREATE)
    assert "user_id" not in created.after_values and "role_id" not in created.after_values
