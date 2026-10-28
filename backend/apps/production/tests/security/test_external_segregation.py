"""
External (vendor / client) members see only what they were given (TPN review TM-002).

A membership that names a vendor or a client is external: whatever global permissions the user
holds, they reach the tasks of their vendor and what hangs off them (or the reviews they take part
in), never the rest of the project. Internal members are unaffected.
"""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_all_known_codes
from apps.production.models import (
    Media,
    Playlist,
    ProjectMembership,
    ProjectNote,
    Review,
    ReviewItem,
    ReviewParticipant,
    Task,
    Timelog,
    Version,
)
from apps.production.selectors.base import ProductionBaseSelector
from apps.production.tests.factories import (
    AssetFactory,
    ProjectFactory,
    ShotFactory,
)


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _member(user, project, **kwargs):
    kwargs.setdefault("status", "active")
    kwargs.setdefault("role", "Artist")
    return ProjectMembership.objects.create(user=user, project=project, **kwargs)


def _user(**kwargs):
    user = UserFactory(**kwargs)
    grant_all_known_codes(user)
    return user


def _rows(response):
    assert response.status_code == 200, response.content
    body = response.json()
    return body["results"] if isinstance(body, dict) else body


def _ids(response):
    return {str(row["id"]) for row in _rows(response)}


def _task(project, shot, vendor, **extra):
    return Task.objects.create(
        project=project,
        shot=shot,
        title=f"{vendor} task",
        code=f"T-{vendor}-{shot.code}"[:50],
        vendor_id=vendor,
        status="Not Started",
        priority="Medium",
        **extra,
    )


def _version(project, task, code):
    return Version.objects.create(project=project, task=task, shot=task.shot, code=code)


@pytest.fixture
def world(db):
    """One project, two vendors, one shot each, plus a studio-only shot, with versions/reviews."""
    project = ProjectFactory()
    shot_a, shot_b, shot_studio = (ShotFactory(project=project) for _ in range(3))

    task_a = _task(project, shot_a, "vendor-a")
    task_b = _task(project, shot_b, "vendor-b")

    version_a = _version(project, task_a, "VA001")
    version_b = _version(project, task_b, "VB001")

    review_a = Review.objects.create(project=project, title="Review A")
    review_b = Review.objects.create(project=project, title="Review B")
    ReviewItem.objects.create(review=review_a, version=version_a)
    ReviewItem.objects.create(review=review_b, version=version_b)

    media_a = Media.objects.create(
        project=project, code="MA", entity_type="Version", entity_id=str(version_a.pk)
    )
    media_b = Media.objects.create(
        project=project, code="MB", entity_type="Version", entity_id=str(version_b.pk)
    )
    media_studio = Media.objects.create(
        project=project, code="MS", entity_type="Shot", entity_id=str(shot_studio.pk)
    )

    vendor_a, vendor_b, studio = _user(), _user(), _user()
    _member(vendor_a, project, vendor_id="vendor-a")
    _member(vendor_b, project, vendor_id="vendor-b")
    _member(studio, project)

    return {
        "project": project,
        "shots": (shot_a, shot_b, shot_studio),
        "tasks": (task_a, task_b),
        "versions": (version_a, version_b),
        "reviews": (review_a, review_b),
        "media": (media_a, media_b, media_studio),
        "vendor_a": vendor_a,
        "vendor_b": vendor_b,
        "studio": studio,
    }


class TestVendorSeesOnlyItsOwnWork:
    def test_shots_tasks_versions_reviews_and_media_are_narrowed(self, world):
        client = _client(world["vendor_a"])
        shot_a = world["shots"][0]
        task_a = world["tasks"][0]
        version_a = world["versions"][0]
        review_a = world["reviews"][0]
        media_a = world["media"][0]

        assert _ids(client.get("/api/v1/shots/")) == {str(shot_a.pk)}
        assert _ids(client.get("/api/v1/tasks/")) == {str(task_a.pk)}
        assert _ids(client.get("/api/v1/versions/")) == {str(version_a.pk)}
        assert _ids(client.get("/api/v1/reviews/")) == {str(review_a.pk)}
        assert _ids(client.get("/api/v1/media/")) == {str(media_a.pk)}

    def test_another_vendors_and_the_studios_records_are_404_on_detail(self, world):
        client = _client(world["vendor_a"])
        shot_b = world["shots"][1]
        shot_studio = world["shots"][2]

        assert client.get(f"/api/v1/shots/{shot_b.pk}/").status_code == 404
        assert client.get(f"/api/v1/shots/{shot_studio.pk}/").status_code == 404
        assert client.get(f"/api/v1/tasks/{world['tasks'][1].pk}/").status_code == 404
        assert client.get(f"/api/v1/versions/{world['versions'][1].pk}/").status_code == 404
        assert client.get(f"/api/v1/reviews/{world['reviews'][1].pk}/").status_code == 404

    def test_another_vendors_records_cannot_be_changed(self, world):
        client = _client(world["vendor_a"])
        task_b = world["tasks"][1]

        response = client.patch(f"/api/v1/tasks/{task_b.pk}/", {"title": "hijacked"}, format="json")

        assert response.status_code == 404
        task_b.refresh_from_db()
        assert task_b.title != "hijacked"

    def test_the_project_record_hides_money_totals_and_other_vendors(self, world):
        project = world["project"]
        project.budget_usd = 1_000_000
        project.vendor_ids = ["vendor-a", "vendor-b"]
        project.save()

        rows = _rows(_client(world["vendor_a"]).get("/api/v1/projects/"))

        assert [row["id"] for row in rows] == [str(project.pk)]
        for hidden in ("budget_usd", "vendor_ids", "vendor_names", "client_name", "total_shots"):
            assert hidden not in rows[0]
        assert rows[0]["code"] == project.code

    def test_whole_project_figures_are_not_available(self, world):
        client = _client(world["vendor_a"])
        project = world["project"]

        assert client.get(f"/api/v1/projects/{project.pk}/statistics/").status_code == 404
        assert client.get(f"/api/v1/projects/{project.pk}/dashboard/").status_code == 404
        base = f"/api/organizations/projects/{project.pk}"
        for tail in ("summary/", "dashboard/", "members/", "notes/", "deliveries/", "activity/"):
            assert client.get(f"{base}/{tail}").status_code == 404, tail

    def test_nested_entity_lists_are_narrowed_too(self, world):
        client = _client(world["vendor_a"])
        base = f"/api/organizations/projects/{world['project'].pk}"

        assert _ids(client.get(f"{base}/shots/")) == {str(world["shots"][0].pk)}
        assert _ids(client.get(f"{base}/tasks/")) == {str(world["tasks"][0].pk)}
        assert _ids(client.get(f"{base}/versions/")) == {str(world["versions"][0].pk)}
        assert _ids(client.get(f"{base}/reviews/")) == {str(world["reviews"][0].pk)}

    def test_a_vendor_does_not_see_the_other_members(self, world):
        client = _client(world["vendor_a"])

        qs = ProductionBaseSelector.scope_by_project_membership(
            ProjectMembership.objects.all(), request=_Req(world["vendor_a"])
        )

        assert list(qs.values_list("user_id", flat=True)) == [world["vendor_a"].pk]
        assert client.get("/api/v1/projects/").status_code == 200


class _Req:
    def __init__(self, user):
        self.user = user


class TestInternalMembersAreUnchanged:
    def test_a_studio_member_still_sees_the_whole_project(self, world):
        client = _client(world["studio"])

        assert _ids(client.get("/api/v1/shots/")) == {str(s.pk) for s in world["shots"]}
        assert _ids(client.get("/api/v1/tasks/")) == {str(t.pk) for t in world["tasks"]}
        assert _ids(client.get("/api/v1/versions/")) == {str(v.pk) for v in world["versions"]}
        assert _ids(client.get("/api/v1/reviews/")) == {str(r.pk) for r in world["reviews"]}
        assert _ids(client.get("/api/v1/media/")) == {str(m.pk) for m in world["media"]}

        project_row = _rows(client.get("/api/v1/projects/"))[0]
        assert "budget_usd" in project_row

    def test_a_studio_member_keeps_the_whole_project_figures(self, world):
        client = _client(world["studio"])
        project = world["project"]

        assert client.get(f"/api/v1/projects/{project.pk}/statistics/").status_code == 200
        assert client.get(f"/api/organizations/projects/{project.pk}/summary/").status_code == 200

    def test_a_platform_superuser_sees_everything(self, world):
        admin = UserFactory(is_superuser=True, is_staff=True)

        assert _ids(_client(admin).get("/api/v1/shots/")) == {str(s.pk) for s in world["shots"]}


class TestVendorMatching:
    def test_the_vendor_code_on_the_task_also_matches_and_case_is_ignored(self, world):
        project = world["project"]
        shot = ShotFactory(project=project)
        coded = Task.objects.create(
            project=project,
            shot=shot,
            title="coded",
            code="T-CODED",
            vendor_id="",
            vendor_code="Vendor-A",
            status="Not Started",
            priority="Medium",
        )

        ids = _ids(_client(world["vendor_a"]).get("/api/v1/tasks/"))

        assert str(coded.pk) in ids

    def test_a_suspended_vendor_membership_sees_nothing(self, world):
        ProjectMembership.objects.filter(user=world["vendor_a"]).update(status="suspended")

        assert _ids(_client(world["vendor_a"]).get("/api/v1/shots/")) == set()
        assert _ids(_client(world["vendor_a"]).get("/api/v1/projects/")) == set()

    def test_a_vendor_with_no_assigned_work_sees_no_entities(self, world):
        stranger = _user()
        _member(stranger, world["project"], vendor_id="vendor-z")
        client = _client(stranger)

        for path in ("shots", "tasks", "versions", "reviews", "media", "assets", "sequences"):
            assert _ids(client.get(f"/api/v1/{path}/")) == set(), path

    def test_each_project_is_judged_on_its_own_membership(self, world):
        other = ProjectFactory()
        other_shot = ShotFactory(project=other)
        user = _user()
        _member(user, world["project"], vendor_id="vendor-a")
        _member(user, other)  # internal on the other project

        shots = _ids(_client(user).get("/api/v1/shots/"))

        assert str(other_shot.pk) in shots
        assert str(world["shots"][0].pk) in shots
        assert str(world["shots"][1].pk) not in shots


class TestWhatAVendorOwnsAndWhatReachesIt:
    def test_assets_sequences_and_timelogs_follow_the_vendors_tasks(self, world):
        project = world["project"]
        asset = AssetFactory(project=project)
        other_asset = AssetFactory(project=project)
        task = Task.objects.create(
            project=project,
            asset=asset,
            title="asset task",
            code="T-ASSET",
            vendor_id="vendor-a",
            status="Not Started",
            priority="Medium",
        )
        Task.objects.create(
            project=project,
            asset=other_asset,
            title="other",
            code="T-OTHER",
            vendor_id="vendor-b",
            status="Not Started",
            priority="Medium",
        )
        mine = Timelog.objects.create(
            project=project,
            task=task,
            person=world["vendor_a"],
            duration_hours=1,
            date="2026-01-01",
        )
        theirs = Timelog.objects.create(
            project=project,
            task=world["tasks"][1],
            person=world["vendor_b"],
            duration_hours=1,
            date="2026-01-01",
        )
        client = _client(world["vendor_a"])

        assert _ids(client.get("/api/v1/assets/")) == {str(asset.pk)}
        assert str(mine.pk) in _ids(client.get("/api/v1/timelogs/"))
        assert str(theirs.pk) not in _ids(client.get("/api/v1/timelogs/"))

    def test_playlists_and_notes_are_only_the_ones_the_vendor_made(self, world):
        project = world["project"]
        own = Playlist.objects.create(project=project, name="mine", created_by=world["vendor_a"])
        Playlist.objects.create(project=project, name="studio", created_by=world["studio"])
        ProjectNote.objects.create(project=project, author=world["studio"], body="studio only")
        mine = ProjectNote.objects.create(project=project, author=world["vendor_a"], body="mine")

        assert _ids(_client(world["vendor_a"]).get("/api/v1/playlists/")) == {str(own.pk)}

        notes = ProductionBaseSelector.scope_by_project_membership(
            ProjectNote.objects.all(), request=_Req(world["vendor_a"])
        )
        assert list(notes.values_list("pk", flat=True)) == [mine.pk]


class TestLinkedRecords:
    def test_a_shots_assets_listing_leaves_out_assets_the_vendor_was_not_given(self, world):
        from apps.production.models import ShotAsset

        project = world["project"]
        shot_a = world["shots"][0]
        mine, theirs = AssetFactory(project=project), AssetFactory(project=project)
        Task.objects.create(
            project=project, asset=mine, title="a", code="T-A1", vendor_id="vendor-a",
            status="Not Started", priority="Medium",
        )  # fmt: skip
        ShotAsset.objects.create(project=project, shot=shot_a, asset=mine)
        ShotAsset.objects.create(project=project, shot=shot_a, asset=theirs)

        studio = _rows(_client(world["studio"]).get(f"/api/v1/shots/{shot_a.pk}/assets/"))
        vendor = _rows(_client(world["vendor_a"]).get(f"/api/v1/shots/{shot_a.pk}/assets/"))

        assert len(studio) == 2
        assert len(vendor) == 1

    def test_an_assets_shots_listing_leaves_out_shots_the_vendor_was_not_given(self, world):
        from apps.production.models import ShotAsset

        project = world["project"]
        asset = AssetFactory(project=project)
        Task.objects.create(
            project=project, asset=asset, title="a", code="T-A2", vendor_id="vendor-a",
            status="Not Started", priority="Medium",
        )  # fmt: skip
        ShotAsset.objects.create(project=project, shot=world["shots"][0], asset=asset)
        ShotAsset.objects.create(project=project, shot=world["shots"][1], asset=asset)

        vendor = _rows(_client(world["vendor_a"]).get(f"/api/v1/assets/{asset.pk}/shots/"))

        assert len(vendor) == 1


class TestClientMembers:
    def test_a_client_sees_only_the_reviews_they_take_part_in(self, world):
        client_user = _user()
        _member(client_user, world["project"], client_id="client-1")
        review_a, review_b = world["reviews"]
        ReviewParticipant.objects.create(review=review_a, user=client_user, name="Client")

        client = _client(client_user)

        assert _ids(client.get("/api/v1/reviews/")) == {str(review_a.pk)}
        assert _ids(client.get("/api/v1/versions/")) == {str(world["versions"][0].pk)}
        assert _ids(client.get("/api/v1/media/")) == {str(world["media"][0].pk)}
        assert _ids(client.get("/api/v1/shots/")) == set()
        assert _ids(client.get("/api/v1/tasks/")) == set()
        assert client.get(f"/api/v1/reviews/{review_b.pk}/").status_code == 404


class TestWholeProjectRecordsAreInternalOnly:
    def test_visible_project_ids_lists_only_internal_projects(self, world):
        other = ProjectFactory()
        user = _user()
        _member(user, world["project"], vendor_id="vendor-a")
        _member(user, other)

        assert ProductionBaseSelector.visible_project_ids(_Req(user)) == [other.pk]

    def test_a_vendor_gets_no_deliveries(self, world):
        assert _rows(_client(world["vendor_a"]).get("/api/v1/deliveries/")) == []


class TestAddingExternalMembers:
    def test_the_member_api_sets_vendor_and_client(self, world):
        admin = UserFactory(is_superuser=True, is_staff=True)
        newcomer = _user()
        url = f"/api/organizations/projects/{world['project'].pk}/members/"

        response = _client(admin).post(
            url,
            {"userId": str(newcomer.pk), "role": "Artist", "vendor_id": "vendor-q"},
            format="json",
        )

        assert response.status_code == 201, response.content
        membership = ProjectMembership.objects.get(user=newcomer, project=world["project"])
        assert membership.vendor_id == "vendor-q"
        assert membership.client_id == ""
