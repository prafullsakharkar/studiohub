"""
Which assets a shot uses (WP C1, DECISIONS D-26).

Linking, listing from both sides, changing and removing a link; one live link per pair; assets
of another project read like missing ones; archived shots and assets drop out of the lists; the
database holds the uniqueness and quantity rules itself.
"""

from __future__ import annotations

import uuid

import pytest
from django.db import IntegrityError, transaction
from django.db.models import ProtectedError
from rest_framework.test import APIClient

from apps.audit.models import ChangeLog
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import ProjectMembership, ShotAsset
from apps.production.tests.factories import AssetFactory, ProjectFactory, ShotFactory

pytestmark = pytest.mark.django_db

LEAD = ("shot.view", "shot.update", "asset.view")


def _client(*projects, codes=LEAD):
    user = UserFactory.create()
    grant_permissions(user, *codes)
    for project in projects:
        ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    api = APIClient()
    api.force_authenticate(user=user)
    return user, api


def _assets_url(shot, tail=""):
    return f"/api/v1/shots/{shot.id}/assets/{tail}"


@pytest.fixture
def project():
    return ProjectFactory.create(code="SA1")


@pytest.fixture
def shot(project):
    return ShotFactory.create(project=project, code="S1")


@pytest.fixture
def tree(project):
    return AssetFactory.create(project=project, code="TREE", name="Tree")


class TestLinking:
    def test_link_by_code_or_id_lists_from_both_sides(self, project, shot, tree):
        rock = AssetFactory.create(project=project, code="ROCK", name="Rock")
        _, api = _client(project)

        by_code = api.post(
            _assets_url(shot),
            {"asset_id": "tree", "quantity": 3, "notes": "background"},
            format="json",
        )
        by_id = api.post(_assets_url(shot), {"asset_id": str(rock.id)}, format="json")

        assert by_code.status_code == by_id.status_code == 201, (by_code.json(), by_id.json())
        assert (
            by_code.json()["asset_code"],
            by_code.json()["quantity"],
            by_code.json()["notes"],
        ) == ("TREE", 3, "background")
        assert by_id.json()["quantity"] == 1
        listed = api.get(_assets_url(shot)).json()
        assert [(row["asset_code"], row["quantity"]) for row in listed] == [
            ("ROCK", 1),
            ("TREE", 3),
        ]
        reverse = api.get(f"/api/v1/assets/{tree.id}/shots/").json()
        assert [(row["shot_code"], row["quantity"]) for row in reverse] == [("S1", 3)]

    def test_a_pair_is_linked_once(self, project, shot, tree):
        _, api = _client(project)
        assert api.post(_assets_url(shot), {"asset_id": "TREE"}, format="json").status_code == 201

        again = api.post(_assets_url(shot), {"asset_id": str(tree.id)}, format="json")

        assert again.status_code == 400 and "already linked" in str(again.json())
        assert ShotAsset.objects.count() == 1

    def test_an_asset_of_another_project_reads_like_a_missing_one(self, project, shot):
        other = ProjectFactory.create(code="SA2")
        foreign = AssetFactory.create(project=other, code="FOREIGN")
        _, api = _client(project, other)

        results = [
            api.post(_assets_url(shot), {"asset_id": ref}, format="json")
            for ref in (str(foreign.id), "FOREIGN", str(uuid.uuid4()), "nope")
        ]

        assert [r.status_code for r in results] == [400] * 4
        assert {str(r.json()["asset_id"]) for r in results} == {"['Unknown asset.']"}
        assert not ShotAsset.objects.exists()

    def test_an_archived_asset_cannot_be_linked(self, project, shot, tree):
        type(tree).objects.filter(pk=tree.pk).update(is_deleted=True)
        _, api = _client(project)

        assert api.post(_assets_url(shot), {"asset_id": "TREE"}, format="json").status_code == 400

    @pytest.mark.parametrize(
        "body",
        [
            {"asset_id": "TREE", "quantity": 0},
            {"asset_id": "TREE", "quantity": -2},
            {"asset_id": "TREE", "extra": 1},
            {},
        ],
    )
    def test_bad_bodies_are_a_400(self, project, shot, tree, body):
        _, api = _client(project)

        assert api.post(_assets_url(shot), body, format="json").status_code == 400
        assert not ShotAsset.objects.exists()


class TestChangingAndRemoving:
    def _linked(self, project, shot, tree):
        user, api = _client(project)
        api.post(_assets_url(shot), {"asset_id": "TREE", "quantity": 2}, format="json")
        return user, api

    def test_quantity_and_note_can_be_changed(self, project, shot, tree):
        _, api = self._linked(project, shot, tree)

        resp = api.patch(
            _assets_url(shot, "tree/"), {"quantity": 5, "notes": "hero tree"}, format="json"
        )

        assert resp.status_code == 200, resp.json()
        link = ShotAsset.objects.get()
        assert (link.quantity, link.notes) == (5, "hero tree")
        assert (
            api.patch(_assets_url(shot, "tree/"), {"quantity": 0}, format="json").status_code == 400
        )

    def test_unlinking_removes_it_from_both_lists_and_allows_linking_again(
        self, project, shot, tree
    ):
        _, api = self._linked(project, shot, tree)

        gone = api.delete(_assets_url(shot, f"{tree.id}/"))

        assert gone.status_code == 204
        assert api.get(_assets_url(shot)).json() == []
        assert api.get(f"/api/v1/assets/{tree.id}/shots/").json() == []
        assert ShotAsset.all_objects.filter(is_deleted=True).count() == 1  # the trail stays
        assert api.post(_assets_url(shot), {"asset_id": "TREE"}, format="json").status_code == 201
        assert ShotAsset.objects.count() == 1

    def test_a_link_that_does_not_exist_is_a_404(self, project, shot, tree):
        _, api = _client(project)

        assert api.delete(_assets_url(shot, "TREE/")).status_code == 404
        assert (
            api.patch(_assets_url(shot, "TREE/"), {"quantity": 2}, format="json").status_code == 404
        )
        assert api.delete(_assets_url(shot, "no-such-asset/")).status_code == 404


class TestAuditTrail:
    def test_creating_and_changing_a_link_are_in_the_change_log_and_unlinking_names_who(
        self, project, shot, tree
    ):
        user, api = _client(project)

        link = api.post(_assets_url(shot), {"asset_id": "TREE"}, format="json").json()
        api.patch(_assets_url(shot, "tree/"), {"quantity": 4}, format="json")
        api.delete(_assets_url(shot, "tree/"))

        log = list(
            ChangeLog.objects.filter(target_type="ShotAsset", target_id=link["id"])
            .order_by("created_at")
            .values_list("change_type", "changed_fields")
        )
        assert log[0][0] == ChangeLog.CHANGE_CREATE and "quantity" in log[1][1]
        # Unlinking is a soft delete: the change log does not record those, the row does.
        row = ShotAsset.all_objects.get(pk=link["id"])
        assert row.is_deleted is True and row.deleted_at is not None
        assert row.deleted_by_id == user.pk
        assert row.created_by_id == user.pk


class TestWhatDropsOut:
    def test_archived_assets_and_shots_leave_the_lists(self, project, shot, tree):
        other_shot = ShotFactory.create(project=project, code="S2")
        _, api = _client(project)
        for target in (shot, other_shot):
            api.post(_assets_url(target), {"asset_id": "TREE"}, format="json")

        type(other_shot).objects.filter(pk=other_shot.pk).update(is_deleted=True)
        assert [r["shot_code"] for r in api.get(f"/api/v1/assets/{tree.id}/shots/").json()] == [
            "S1"
        ]

        type(tree).objects.filter(pk=tree.pk).update(is_deleted=True)
        assert api.get(_assets_url(shot)).json() == []


class TestAccess:
    def test_listing_needs_both_view_codes(self, project, shot, tree):
        _, lead = _client(project)
        lead.post(_assets_url(shot), {"asset_id": "TREE"}, format="json")
        _, shot_only = _client(project, codes=("shot.view",))
        _, asset_only = _client(project, codes=("asset.view",))

        assert shot_only.get(_assets_url(shot)).status_code == 403
        assert asset_only.get(f"/api/v1/assets/{tree.id}/shots/").status_code == 403
        _, both = _client(project, codes=("shot.view", "asset.view"))
        assert both.get(_assets_url(shot)).status_code == 200
        assert both.get(f"/api/v1/assets/{tree.id}/shots/").status_code == 200

    def test_changing_links_needs_shot_update(self, project, shot, tree):
        _, reader = _client(project, codes=("shot.view", "asset.view"))

        assert (
            reader.post(_assets_url(shot), {"asset_id": "TREE"}, format="json").status_code == 403
        )
        assert (
            reader.patch(_assets_url(shot, "tree/"), {"quantity": 2}, format="json").status_code
            == 403
        )
        assert reader.delete(_assets_url(shot, "tree/")).status_code == 403

    def test_a_non_member_cannot_see_the_shot_at_all(self, project, shot, tree):
        other = ProjectFactory.create(code="SA3")
        _, outsider = _client(other)

        assert outsider.get(_assets_url(shot)).status_code == 404
        assert (
            outsider.post(_assets_url(shot), {"asset_id": "TREE"}, format="json").status_code == 404
        )
        assert outsider.get(f"/api/v1/assets/{tree.id}/shots/").status_code == 404

    def test_the_seeded_roles_split_as_intended(self):
        from apps.core.management.commands import init_platform as seed

        for needed in ("shot.view", "asset.view"):
            assert needed in seed.PRODUCTION_ARTIST_PERMISSIONS
        assert (
            "shot.update" not in seed.PRODUCTION_ARTIST_PERMISSIONS
        )  # artists read links, leads change them
        assert "shot.update" in seed.PRODUCTION_LEAD_PERMISSIONS


class TestQueriesAndConstraints:
    def test_the_lists_do_not_query_per_link(self, project, shot, django_assert_max_num_queries):
        _, api = _client(project)
        for index in range(8):
            asset = AssetFactory.create(project=project, code=f"A{index}")
            api.post(_assets_url(shot), {"asset_id": str(asset.id)}, format="json")

        with django_assert_max_num_queries(12):
            assert len(api.get(_assets_url(shot)).json()) == 8
        with django_assert_max_num_queries(12):
            asset = type(project).objects.get(pk=project.pk).assets.first()
            api.get(f"/api/v1/assets/{asset.id}/shots/")

    def test_the_database_refuses_a_second_live_link_and_a_zero_quantity(self, project, shot, tree):
        ShotAsset.objects.create(project=project, shot=shot, asset=tree)

        with pytest.raises(IntegrityError), transaction.atomic():
            ShotAsset.objects.create(project=project, shot=shot, asset=tree)
        with pytest.raises(IntegrityError), transaction.atomic():
            ShotAsset.objects.create(
                project=project,
                shot=ShotFactory.create(project=project, code="S9"),
                asset=tree,
                quantity=0,
            )

    def test_a_soft_deleted_link_does_not_block_a_new_one_at_the_database(
        self, project, shot, tree
    ):
        ShotAsset.objects.create(project=project, shot=shot, asset=tree, is_deleted=True)

        ShotAsset.objects.create(project=project, shot=shot, asset=tree)

        assert ShotAsset.all_objects.count() == 2

    def test_a_linked_shot_or_asset_cannot_be_hard_deleted(self, project, shot, tree):
        ShotAsset.objects.create(project=project, shot=shot, asset=tree)

        with pytest.raises(ProtectedError):
            shot.hard_delete()
        with pytest.raises(ProtectedError):
            tree.hard_delete()

    def test_two_requests_linking_the_same_pair_cannot_both_win(self, project, shot, tree):
        """The pre-check is not the guard: the constraint is. A pair created behind its back is a 400."""
        from apps.production.services.shot_asset import ShotAssetService

        user, _ = _client(project)
        original = ShotAsset.objects.filter
        calls = {"n": 0}

        def blind_first_check(*args, **kwargs):
            qs = original(*args, **kwargs)
            if calls["n"] == 0 and "shot" in kwargs and "asset" in kwargs:
                calls["n"] += 1
                ShotAsset.objects.create(
                    project=project, shot=shot, asset=tree
                )  # the other request wins first
                return original(pk=None)  # and our check saw nothing
            return qs

        ShotAsset.objects.filter = blind_first_check  # type: ignore[method-assign]
        try:
            from rest_framework.exceptions import ValidationError

            with pytest.raises(ValidationError) as refused:
                ShotAssetService.link(user=user, shot=shot, asset_ref="TREE")
        finally:
            ShotAsset.objects.filter = original  # type: ignore[method-assign]
        assert calls["n"] == 1  # the competing row was created and the pre-check blinded
        assert "already linked" in str(refused.value.detail)  # the constraint refused it


class TestArchivingAnAssetThatShotsUse:
    """Plan C5, DECISIONS D-31: an asset that live shots use cannot be archived."""

    DELETER = (*LEAD, "asset.delete", "shot.delete")

    def _used(self, project, shot, tree):
        ShotAsset.objects.create(project=project, shot=shot, asset=tree)
        return _client(project, codes=self.DELETER)[1]

    def test_it_is_refused_every_way_and_nothing_is_left_half_archived(self, project, shot, tree):
        api = self._used(project, shot, tree)

        destroy = api.delete(f"/api/v1/assets/{tree.id}/")
        archive = api.post(f"/api/v1/assets/{tree.id}/archive/")
        bulk = api.post("/api/v1/assets/bulk-archive/", {"ids": [str(tree.id)]}, format="json")

        assert destroy.status_code == archive.status_code == 400
        assert "used by 1 shot" in str(destroy.json()) and "Unlink it" in str(archive.json())
        assert bulk.json()["failed"] == 1
        assert bulk.json()["results"][0]["status"] == "has_children"
        tree.refresh_from_db()
        assert tree.is_deleted is False and tree.status != "Archived"

    def test_it_works_once_the_shot_is_archived_or_the_link_removed(self, project, shot, tree):
        api = self._used(project, shot, tree)
        other = ShotFactory.create(project=project, code="S2")
        ShotAsset.objects.create(project=project, shot=other, asset=tree)

        assert api.post(f"/api/v1/shots/{shot.id}/archive/").status_code == 200
        assert api.post(f"/api/v1/assets/{tree.id}/archive/").status_code == 400  # S2 still uses it
        assert api.delete(_assets_url(other, "TREE/")).status_code == 204

        assert api.post(f"/api/v1/assets/{tree.id}/archive/").status_code == 200

    def test_an_unused_asset_archives_as_before(self, project, tree):
        _, api = _client(project, codes=self.DELETER)

        assert api.post(f"/api/v1/assets/{tree.id}/archive/").status_code == 200
