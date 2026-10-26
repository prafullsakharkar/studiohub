"""
Versions (WP E1 to E3, DECISIONS D-29): server-side numbering, the shot or asset a version is about,
publishing and its immutability, and one hero per shot or asset.
"""

from __future__ import annotations

import threading
import uuid

import pytest
from django.db import IntegrityError, connection, transaction
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.masterdata.models import MasterTaskType
from apps.production.models import ProjectMembership, Version
from apps.production.services.version import VersionService
from apps.production.tests.factories import (
    AssetFactory,
    ProjectFactory,
    ShotFactory,
    TaskFactory,
    VersionFactory,
)

pytestmark = pytest.mark.django_db

CODES = ("version.view", "version.create", "version.update", "version.delete", "version.publish")


def _client(project, *codes):
    user = UserFactory.create()
    grant_permissions(user, *(codes or CODES))
    ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    api = APIClient()
    api.force_authenticate(user=user)
    return user, api


def _create(api, project, **extra):
    return api.post("/api/v1/versions/", {"project_id": str(project.id), **extra}, format="json")


@pytest.fixture
def project():
    return ProjectFactory.create(code="VER1")


@pytest.fixture
def shot(project):
    return ShotFactory.create(project=project, code="SH010", name="Opening")


class TestNumbering:
    def test_versions_of_a_task_are_numbered_by_the_server(self, project, shot):
        task = TaskFactory.create(project=project, code="T1", shot=shot, entity_id="")
        _, api = _client(project)

        first = _create(api, project, task=str(task.id), code="CLIENT-1", version_number="v099")
        second = _create(api, project, task=str(task.id), code="CLIENT-2")

        assert first.status_code == second.status_code == 201, (first.json(), second.json())
        rows = list(Version.objects.filter(task=task).order_by("version_index"))
        assert [(v.version_index, v.version_number) for v in rows] == [(1, "v001"), (2, "v002")]
        assert [v.code for v in rows] == [
            "CLIENT-1",
            "CLIENT-2",
        ]  # the client's number was ignored, its code kept

    def test_each_series_counts_on_its_own(self, project, shot):
        other = ShotFactory.create(project=project, code="SH020")
        asset = AssetFactory.create(project=project, code="ROCK")
        anim = TaskFactory.create(project=project, code="TA", shot=shot, entity_id="")
        comp = TaskFactory.create(project=project, code="TC", shot=shot, entity_id="")
        _, api = _client(project)

        for n, body in enumerate(
            [{"task": str(anim.id)}, {"task": str(anim.id)}, {"task": str(comp.id)},
             {"shot": str(shot.id)}, {"shot": str(shot.id)}, {"shot": str(other.id)}, {"asset": str(asset.id)}]
        ):  # fmt: skip
            assert _create(api, project, code=f"V{n}", **body).status_code == 201

        def numbers(**where):
            return list(
                Version.objects.filter(**where)
                .order_by("version_index")
                .values_list("version_number", flat=True)
            )

        assert numbers(task=anim) == ["v001", "v002"]
        assert numbers(task=comp) == ["v001"]
        assert numbers(shot=shot, task__isnull=True) == ["v001", "v002"]
        assert numbers(shot=other) == ["v001"]
        assert numbers(asset=asset) == ["v001"]

    def test_a_number_is_never_reused_even_after_archiving(self, project, shot):
        _, api = _client(project)
        for n in range(3):
            _create(api, project, shot=str(shot.id), code=f"V{n}")
        Version.objects.filter(code="V2").update(is_deleted=True)  # the newest one is archived

        again = _create(api, project, shot=str(shot.id), code="V3")

        assert again.status_code == 201
        assert Version.objects.get(code="V3").version_number == "v004"

    def test_the_code_is_derived_when_not_given(self, project, shot):
        MasterTaskType.objects.create(code="ANIM", name="Animation")
        task = TaskFactory.create(project=project, code="T1", shot=shot, entity_id="")
        Version.objects.none()
        type(task).objects.filter(pk=task.pk).update(
            task_type=MasterTaskType.objects.get(code="ANIM")
        )
        _, api = _client(project)

        with_task = _create(api, project, task=str(task.id))
        shot_only = _create(api, project, shot=str(shot.id), department="Lighting")
        again = _create(api, project, task=str(task.id))

        assert with_task.status_code == shot_only.status_code == again.status_code == 201
        assert sorted(Version.objects.values_list("code", flat=True)) == [
            "SH010_ANIM_V001", "SH010_ANIM_V002", "SH010_LIGHTING_V001",
        ]  # fmt: skip

    def test_the_number_cannot_be_edited(self, project, shot):
        version = VersionFactory.create(
            project=project, code="V1", shot=shot, version_number="v001", version_index=1
        )
        _, api = _client(project)

        changed = api.patch(
            f"/api/v1/versions/{version.id}/", {"version_number": "v009"}, format="json"
        )
        echoed = api.patch(
            f"/api/v1/versions/{version.id}/",
            {"version_number": "v001", "notes": "n"},
            format="json",
        )

        assert changed.status_code == 400 and "version_number" in changed.json()
        assert echoed.status_code == 200

    def test_the_database_refuses_a_repeated_number_in_a_series(self, project, shot):
        VersionFactory.create(project=project, code="V1", shot=shot, version_index=1)

        with pytest.raises(IntegrityError), transaction.atomic():
            VersionFactory.create(project=project, code="V2", shot=shot, version_index=1)
        VersionFactory.create(
            project=project,
            code="V3",
            shot=ShotFactory.create(project=project, code="S2"),
            version_index=1,
        )


@pytest.mark.django_db(transaction=True)
def test_parallel_creates_get_consecutive_numbers():
    """Eight creates at once in one series: 1..8, none twice, none missing."""
    project = ProjectFactory.create(code="VERRACE")
    shot = ShotFactory.create(project=project, code="S1")
    admin = UserFactory.create(is_superuser=True, is_staff=True)
    start = threading.Barrier(8)
    outcomes: list[str] = []

    def create(n):
        try:
            start.wait()
            VersionService.create(user=admin, project=project, shot=shot, code=f"RACE-{n}")
            outcomes.append("ok")
        except Exception as exc:  # noqa: BLE001
            outcomes.append(type(exc).__name__)
        finally:
            connection.close()

    threads = [threading.Thread(target=create, args=(n,)) for n in range(8)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert outcomes == ["ok"] * 8, outcomes
    assert sorted(
        Version.objects.filter(shot=shot).values_list("version_index", flat=True)
    ) == list(range(1, 9))


class TestWhatAVersionIsAbout:
    def test_a_version_cannot_be_about_a_shot_and_an_asset(self, project, shot):
        asset = AssetFactory.create(project=project, code="ROCK")
        _, api = _client(project)

        resp = _create(api, project, code="V1", shot=str(shot.id), asset=str(asset.id))

        assert resp.status_code == 400 and "asset" in resp.json()
        assert not Version.objects.exists()

    def test_a_task_and_its_version_must_agree(self, project, shot):
        other = ShotFactory.create(project=project, code="SH020")
        asset = AssetFactory.create(project=project, code="ROCK")
        task = TaskFactory.create(project=project, code="T1", shot=shot, entity_id="")
        _, api = _client(project)

        wrong_shot = _create(api, project, code="V1", task=str(task.id), shot=str(other.id))
        wrong_kind = _create(api, project, code="V2", task=str(task.id), asset=str(asset.id))
        agreeing = _create(api, project, code="V3", task=str(task.id), shot=str(shot.id))

        assert wrong_shot.status_code == wrong_kind.status_code == 400
        assert agreeing.status_code == 201 and Version.objects.count() == 1

    def test_a_version_made_from_a_task_alone_takes_the_tasks_shot(self, project, shot):
        task = TaskFactory.create(project=project, code="T1", shot=shot, entity_id="")
        _, api = _client(project)

        assert _create(api, project, code="V1", task=str(task.id)).status_code == 201

        version = Version.objects.get()
        assert (version.shot_id, version.entity_type, version.entity_code, version.entity_name) == (
            shot.id, "Shot", "SH010", "Opening",
        )  # fmt: skip

    def test_the_text_copies_must_agree_with_the_record(self, project, shot):
        _, api = _client(project)

        ok = _create(
            api, project, code="V1", shot=str(shot.id), entity_code="sh010", entity_name="Opening"
        )
        bad = _create(api, project, code="V2", shot=str(shot.id), entity_code="SH999")

        assert ok.status_code == 201
        assert bad.status_code == 400 and "entity_code" in bad.json()

    def test_the_database_refuses_both_a_shot_and_an_asset(self, project, shot):
        asset = AssetFactory.create(project=project, code="ROCK")

        with pytest.raises(IntegrityError), transaction.atomic():
            VersionFactory.create(project=project, code="V1", shot=shot, asset=asset)

    def test_a_linked_shot_asset_or_task_cannot_be_hard_deleted(self, project, shot):
        from django.db.models import ProtectedError

        VersionFactory.create(project=project, code="V1", shot=shot, version_index=1)

        with pytest.raises(ProtectedError):
            shot.hard_delete()


class TestPublishing:
    def _approved(self, project, shot, code="V1", index=1):
        return VersionFactory.create(
            project=project,
            code=code,
            shot=shot,
            status="Approved",
            version_index=index,
            version_number=f"v{index:03d}",
        )

    def test_only_an_approved_version_is_published_and_it_records_who_and_when(self, project, shot):
        draft = VersionFactory.create(
            project=project, code="D", shot=shot, status="Pending Review", version_index=1
        )
        approved = self._approved(project, shot, "A", 2)
        user, api = _client(project)

        refused = api.post(f"/api/v1/versions/{draft.id}/publish/", {}, format="json")
        done = api.post(
            f"/api/v1/versions/{approved.id}/publish/", {"comment": "ship"}, format="json"
        )
        twice = api.post(f"/api/v1/versions/{approved.id}/publish/", {}, format="json")

        assert refused.status_code == 400 and "approved" in str(refused.json())
        assert done.status_code == 200, done.json()
        assert twice.status_code == 400
        approved.refresh_from_db()
        assert (approved.is_published, approved.published_by_id) == (True, user.id)
        assert approved.published_at is not None and approved.publishing_info["comment"] == "ship"
        draft.refresh_from_db()
        assert draft.is_published is False

    def test_a_forged_published_at_in_the_body_is_replaced_by_the_servers(self, project, shot):
        version = self._approved(project, shot)
        _, api = _client(project)

        api.post(
            f"/api/v1/versions/{version.id}/publish/",
            {"published_at": "1999-01-01T00:00:00Z"},
            format="json",
        )

        version.refresh_from_db()
        assert not version.publishing_info["published_at"].startswith("1999")
        assert version.published_at.year >= 2026

    def test_unpublishing_clears_who_and_when(self, project, shot):
        version = self._approved(project, shot)
        _, api = _client(project)
        api.post(f"/api/v1/versions/{version.id}/publish/", {}, format="json")

        resp = api.post(f"/api/v1/versions/{version.id}/unpublish/")
        again = api.post(f"/api/v1/versions/{version.id}/unpublish/")

        assert resp.status_code == 200 and again.status_code == 400
        version.refresh_from_db()
        assert (version.is_published, version.published_at, version.published_by_id) == (
            False,
            None,
            None,
        )

    def test_a_published_version_changes_only_in_notes_and_tags(self, project, shot):
        version = self._approved(project, shot)
        version.is_published = True
        version.save(update_fields=["is_published"])
        _, api = _client(project)
        url = f"/api/v1/versions/{version.id}/"

        refused = api.patch(url, {"department": "FX", "notes": "n"}, format="json")
        allowed = api.patch(url, {"notes": "new note", "tags": ["final"]}, format="json")
        echoed = api.patch(url, {"department": version.department, "notes": "again"}, format="json")

        assert refused.status_code == 400 and refused.json()["fields"] == ["department"]
        assert allowed.status_code == 200 and echoed.status_code == 200
        version.refresh_from_db()
        assert (version.notes, version.tags, version.department) == ("again", ["final"], "")

    def test_after_unpublishing_it_can_be_edited_again(self, project, shot):
        version = self._approved(project, shot)
        _, api = _client(project)
        api.post(f"/api/v1/versions/{version.id}/publish/", {}, format="json")
        api.post(f"/api/v1/versions/{version.id}/unpublish/")

        assert (
            api.patch(
                f"/api/v1/versions/{version.id}/", {"department": "FX"}, format="json"
            ).status_code
            == 200
        )

    def test_a_published_version_cannot_be_archived_or_deleted(self, project, shot):
        version = self._approved(project, shot)
        _, api = _client(project)
        api.post(f"/api/v1/versions/{version.id}/publish/", {}, format="json")

        archive = api.post(f"/api/v1/versions/{version.id}/archive/")
        delete = api.delete(f"/api/v1/versions/{version.id}/")

        assert archive.status_code == delete.status_code == 400
        version.refresh_from_db()
        assert (version.is_deleted, version.status) == (False, "Approved")


class TestHero:
    def _approved(self, project, shot, code, index):
        return VersionFactory.create(
            project=project,
            code=code,
            shot=shot,
            status="Approved",
            version_index=index,
            artist=None,
        )

    def test_promoting_demotes_the_previous_hero(self, project, shot):
        first, second = (
            self._approved(project, shot, "V1", 1),
            self._approved(project, shot, "V2", 2),
        )
        _, api = _client(project)

        assert (
            api.post(f"/api/v1/versions/{first.id}/promote/", {}, format="json").status_code == 200
        )
        assert (
            api.post(f"/api/v1/versions/{second.id}/promote/", {}, format="json").status_code == 200
        )

        first.refresh_from_db()
        second.refresh_from_db()
        assert (first.is_hero, second.is_hero) == (False, True)

    def test_each_shot_and_asset_has_its_own_hero(self, project, shot):
        other = ShotFactory.create(project=project, code="SH020")
        asset = AssetFactory.create(project=project, code="ROCK")
        a = self._approved(project, shot, "VA", 1)
        b = self._approved(project, other, "VB", 1)
        c = VersionFactory.create(
            project=project, code="VC", asset=asset, status="Approved", version_index=1
        )
        _, api = _client(project)

        for version in (a, b, c):
            assert (
                api.post(f"/api/v1/versions/{version.id}/promote/", {}, format="json").status_code
                == 200
            )

        assert Version.objects.filter(is_hero=True).count() == 3

    def test_a_version_of_neither_is_refused(self, project):
        loose = VersionFactory.create(project=project, code="V1", status="Approved")
        _, api = _client(project)

        resp = api.post(f"/api/v1/versions/{loose.id}/promote/", {}, format="json")

        assert resp.status_code == 400
        loose.refresh_from_db()
        assert loose.is_hero is False

    def test_the_database_refuses_two_live_heroes(self, project, shot):
        VersionFactory.create(project=project, code="V1", shot=shot, is_hero=True, version_index=1)

        with pytest.raises(IntegrityError), transaction.atomic():
            VersionFactory.create(
                project=project, code="V2", shot=shot, is_hero=True, version_index=2
            )
        VersionFactory.create(
            project=project, code="V3", shot=shot, is_hero=True, is_deleted=True, version_index=3
        )


@pytest.mark.django_db(transaction=True)
def test_two_promotions_at_once_leave_exactly_one_hero():
    project = ProjectFactory.create(code="HERORACE")
    shot = ShotFactory.create(project=project, code="S1")
    versions = [
        VersionFactory.create(
            project=project, code=f"V{n}", shot=shot, status="Approved", version_index=n
        )
        for n in (1, 2)
    ]
    actors = [UserFactory.create(), UserFactory.create()]
    start = threading.Barrier(2)
    outcomes: list[str] = []

    def promote(version, actor):
        try:
            start.wait()
            VersionService.promote_version(
                actor=actor,
                version=Version.objects.get(pk=version.pk),
                has_permission=lambda code: True,
                has_explicit=lambda code: False,
            )
            outcomes.append("ok")
        except Exception as exc:  # noqa: BLE001
            outcomes.append(type(exc).__name__)
        finally:
            connection.close()

    threads = [
        threading.Thread(target=promote, args=(v, a)) for v, a in zip(versions, actors, strict=True)
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert outcomes == ["ok", "ok"], outcomes
    assert Version.objects.filter(shot=shot, is_hero=True).count() == 1
    assert uuid  # (module import kept for parity with sibling tests)
