"""
Rows that carry history cannot be removed for good from under it (DECISIONS D-24):
a project with tasks, versions, time logs, reviews or notes cannot be hard-deleted, a person
with time logged cannot be, and the admin offers no delete at all.
"""

from __future__ import annotations

import pytest
from django.contrib import admin
from django.db.models import ProtectedError
from django.test import RequestFactory

from apps.identity.tests.factories import UserFactory
from apps.production.models import ProjectNote
from apps.production.tests.factories import (
    ProjectFactory,
    ReviewFactory,
    ShotFactory,
    TaskFactory,
    TimelogFactory,
    VersionFactory,
)

pytestmark = pytest.mark.django_db


def _note(project):
    return ProjectNote.objects.create(project=project, subject="n")


@pytest.mark.parametrize(
    "make",
    [
        lambda p: TaskFactory.create(project=p, code="T1"),
        lambda p: VersionFactory.create(project=p, code="V1"),
        lambda p: TimelogFactory.create(project=p, task=TaskFactory.create(project=p, code="T2")),
        lambda p: ReviewFactory.create(project=p),
        _note,
    ],
    ids=["task", "version", "timelog", "review", "note"],
)
def test_a_project_with_history_cannot_be_hard_deleted(make):
    project = ProjectFactory.create(code="PROT1")
    make(project)

    with pytest.raises(ProtectedError):
        project.hard_delete()

    assert type(project).all_objects.filter(pk=project.pk).exists()


def test_a_project_with_only_structure_still_can_be_removed():
    project = ProjectFactory.create(code="PROT2")
    ShotFactory.create(project=project, code="S1")

    project.hard_delete()

    assert not type(project).all_objects.filter(pk=project.pk).exists()


def test_a_person_with_time_logged_cannot_be_hard_deleted():
    person = UserFactory.create()
    TimelogFactory.create(
        person=person,
        task=TaskFactory.create(project=ProjectFactory.create(code="PROT3"), code="T3"),
    )

    with pytest.raises(ProtectedError):
        person.hard_delete()


def test_no_production_admin_can_delete_anything_even_for_a_superuser():
    request = RequestFactory().get("/")
    request.user = UserFactory.create(is_superuser=True, is_staff=True)
    production_admins = [
        model_admin
        for model, model_admin in admin.site._registry.items()
        if model._meta.app_label == "production"
    ]

    assert len(production_admins) >= 18  # the whole app is covered, not a sample
    for model_admin in production_admins:
        assert model_admin.has_delete_permission(request) is False, model_admin
        assert "delete_selected" not in model_admin.get_actions(request), model_admin
