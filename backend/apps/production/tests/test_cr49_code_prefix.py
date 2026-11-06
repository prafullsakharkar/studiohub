"""
CR-49 (DECISIONS D-43): a NEW episode, sequence, shot, asset or task has a code that starts with its
project's code (``TST_SQ0010`` in project ``TST``), single and bulk, and a new shot has a sequence.
Create only: existing records, update, ``rename-code``, bulk update by code and recovery are untouched.
"""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import Asset, Episode, ProjectMembership, Sequence, Shot, Task
from apps.production.tests.factories import (
    AssetFactory,
    EpisodeFactory,
    ProjectFactory,
    SequenceFactory,
    ShotFactory,
)

pytestmark = pytest.mark.django_db

ENTITIES = {
    "episodes": (Episode, {"name": "n", "season_number": 1, "episode_number": 5}),
    "sequences": (Sequence, {"name": "n"}),
    "assets": (Asset, {"name": "n", "category": "Prop"}),
    "tasks": (Task, {"title": "t"}),
    "shots": (Shot, {"name": "n"}),
}
PERMISSIONS = [
    f"{kind}.{verb}"
    for kind in ("episode", "sequence", "asset", "task", "shot")
    for verb in ("view", "create", "update")
]


@pytest.fixture
def project():
    return ProjectFactory.create(code="TST", workflow_type="episodic")


@pytest.fixture
def client(project):
    user = UserFactory.create()
    grant_permissions(user, *PERMISSIONS, "shot.rename", "production.code.rename")
    ProjectMembership.objects.create(user=user, project=project, status="active", role="Lead")
    api = APIClient()
    api.force_authenticate(user=user)
    return api


@pytest.fixture
def sequence(project):
    return SequenceFactory.create(
        project=project,
        code="TST_SQ0001",
        episode=EpisodeFactory.create(project=project, code="TST_EP101"),
    )


def body(kind, project, sequence, code, **extra):
    """What a create of `kind` needs besides its code (a shot needs a sequence; an episodic one its episode)."""
    fields = {**ENTITIES[kind][1], "project_id": str(project.id), "code": code}
    if kind == "shots":
        fields["sequence_id"] = str(sequence.id)
    if kind == "sequences":
        fields["episode_id"] = str(sequence.episode_id)
    return {**fields, **extra}


class TestSingleCreate:
    @pytest.mark.parametrize("kind", sorted(ENTITIES))
    def test_a_code_without_the_projects_is_a_400_and_nothing_is_stored(
        self, client, project, sequence, kind
    ):
        model = ENTITIES[kind][0]
        before = model.all_objects.count()

        resp = client.post(
            f"/api/v1/{kind}/", body(kind, project, sequence, "SQ0010"), format="json"
        )

        assert resp.status_code == 400, resp.json()
        assert resp.json()["code"] == ["Codes in project TST start with TST_."]
        assert model.all_objects.count() == before

    @pytest.mark.parametrize("kind", sorted(ENTITIES))
    def test_with_the_prefix_it_is_created_upper_case(self, client, project, sequence, kind):
        resp = client.post(
            f"/api/v1/{kind}/", body(kind, project, sequence, "tst_sq0010"), format="json"
        )

        assert resp.status_code == 201, resp.json()
        assert resp.json()["code"] == "TST_SQ0010"

    @pytest.mark.parametrize(
        "code", ["TST_", "tst_", "TST", "TSTSQ0010", "OTHER_SQ0010", "SQ0010_TST_"]
    )
    def test_the_prefix_alone_or_a_near_miss_is_refused(self, client, project, sequence, code):
        resp = client.post(
            "/api/v1/sequences/", body("sequences", project, sequence, code), format="json"
        )

        assert resp.status_code == 400
        assert resp.json()["code"] == ["Codes in project TST start with TST_."]

    def test_another_projects_prefix_is_not_the_projects(self, client, project, sequence):
        ProjectFactory.create(code="OTH", workflow_type="episodic")
        resp = client.post(
            "/api/v1/sequences/", body("sequences", project, sequence, "OTH_SQ0010"), format="json"
        )

        assert resp.status_code == 400

    def test_the_prefix_counts_towards_the_length_limit(self, client, project, sequence):
        longest = Shot._meta.get_field("code").max_length
        too_long = "TST_" + "X" * (longest - 3)  # one over, with the prefix on
        fits = "TST_" + "X" * (longest - 4)

        refused = client.post(
            "/api/v1/shots/", body("shots", project, sequence, too_long), format="json"
        )
        accepted = client.post(
            "/api/v1/shots/", body("shots", project, sequence, fits), format="json"
        )

        assert refused.status_code == 400 and "code" in refused.json()
        assert accepted.status_code == 201, accepted.json()

    def test_an_episode_left_blank_gets_the_prefix_on_its_derived_code(self, client, project):
        resp = client.post(
            "/api/v1/episodes/",
            {"project_id": str(project.id), "name": "n", "season_number": 1, "episode_number": 7},
            format="json",
        )

        assert resp.status_code == 201, resp.json()
        assert resp.json()["code"] == "TST_EP107"

    def test_a_long_episode_code_that_no_longer_fits_with_the_prefix_is_a_400(
        self, client, project
    ):
        longest = Episode._meta.get_field("code").max_length

        resp = client.post(
            "/api/v1/episodes/",
            {"project_id": str(project.id), "name": "n", "code": "TST_" + "X" * (longest - 3)},
            format="json",
        )

        assert resp.status_code == 400 and "code" in resp.json()  # the serializer's own limit; the hook backs it up for derived codes

    def test_the_uniqueness_check_sees_the_prefixed_code(self, client, project, sequence):
        EpisodeFactory.create(project=project, code="TST_EP107")
        resp = client.post(
            "/api/v1/episodes/",
            {"project_id": str(project.id), "name": "n", "season_number": 1, "episode_number": 7},
            format="json",
        )

        assert resp.status_code == 400  # TST_EP107 is taken, not just EP107


class TestBulkCreate:
    @pytest.mark.parametrize("kind", ["sequences", "assets", "tasks", "shots", "episodes"])
    def test_each_item_is_held_to_it(self, client, project, sequence, kind):
        items = [
            body(kind, project, sequence, "TST_GOOD1"),
            body(kind, project, sequence, "BAD1"),
        ]

        resp = client.post(f"/api/v1/{kind}/bulk-create/", {"items": items}, format="json")

        assert resp.status_code == 200, resp.json()
        assert [row["status"] for row in resp.json()["results"]] == ["created", "invalid"]
        assert resp.json()["errors"] == [
            {"row": 1, "field": "code", "message": "Codes in project TST start with TST_."}
        ]
        model = ENTITIES[kind][0]
        assert list(
            model.objects.filter(code__in=["TST_GOOD1", "BAD1"]).values_list("code", flat=True)
        ) == ["TST_GOOD1"]

    def test_a_dry_run_reports_it_and_stores_nothing(self, client, project, sequence):
        resp = client.post(
            "/api/v1/sequences/bulk-create/",
            {"dry_run": True, "items": [body("sequences", project, sequence, "BAD1")]},
            format="json",
        )

        assert resp.json()["results"][0]["status"] == "invalid"
        assert not Sequence.all_objects.filter(code="BAD1").exists()

    def test_the_atomic_batch_with_a_bad_code_stores_nothing(self, client, project, sequence):
        resp = client.post(
            "/api/v1/sequences/bulk-create/",
            {
                "atomic": True,
                "items": [
                    body("sequences", project, sequence, "TST_OK1"),
                    body("sequences", project, sequence, "BAD1"),
                ],
            },
            format="json",
        )

        assert resp.json()["committed"] is False
        assert not Sequence.all_objects.filter(code="TST_OK1").exists()

    def test_the_react_form_shape_is_held_to_it_too(self, client, project, sequence):
        resp = client.post(
            "/api/v1/sequences/bulk-create/",
            {
                "project_id": str(project.id),
                "items": [
                    {
                        "code": "NOPE1",
                        "action": "create",
                        "data": {"name": "n", "episode_id": str(sequence.episode_id)},
                    }
                ],
            },
            format="json",
        )

        assert resp.json()["results"][0]["status"] == "invalid"

    def test_a_shot_without_a_sequence_is_invalid_in_bulk(self, client, project, sequence):
        item = body("shots", project, sequence, "TST_SH1")
        del item["sequence_id"]

        resp = client.post("/api/v1/shots/bulk-create/", {"items": [item]}, format="json")

        assert resp.json()["results"][0]["status"] == "invalid"
        # The project is episodic and the item names no episode either: both are reported.
        errors = {error["field"]: error["message"] for error in resp.json()["errors"]}
        assert errors["sequence_id"] == "A shot needs a sequence."

    def test_numbered_codes_carry_the_prefix(self, client, project, sequence):
        resp = client.post(
            "/api/v1/shots/bulk-create/",
            {
                "items": [
                    {
                        "project_id": str(project.id),
                        "code_prefix": "SH",
                        "name": "n",
                        "sequence_id": str(sequence.id),
                    }
                ]
                * 2
            },
            format="json",
        )

        assert [row["status"] for row in resp.json()["results"]] == ["created", "created"]
        assert sorted(Shot.objects.values_list("code", flat=True)) == ["TST_SH0010", "TST_SH0020"]


class TestExistingRecordsAreLeftAlone:
    """The rule is for create: nothing that is already there, or changed later, is held to it."""

    def test_a_record_with_an_old_code_can_be_edited_and_renamed(self, client, project, sequence):
        old = ShotFactory.create(
            project=project, code="OLD010", sequence=sequence, episode=sequence.episode
        )

        edited = client.patch(f"/api/v1/shots/{old.id}/", {"name": "Renamed"}, format="json")
        recoded = client.patch(f"/api/v1/shots/{old.id}/", {"code": "STILL_OLD"}, format="json")

        assert edited.status_code == 200, edited.json()
        assert recoded.status_code == 200, recoded.json()  # a plain code update is not a create

    def test_bulk_update_finds_an_old_code(self, client, project, sequence):
        AssetFactory.create(project=project, code="OLD1", description="before")

        resp = client.post(
            "/api/v1/assets/bulk-update/",
            {"project_id": str(project.id), "items": [{"code": "old1", "description": "after"}]},
            format="json",
        )

        assert resp.json()["results"][0]["status"] == "updated"

    def test_recovering_an_archived_record_with_an_old_code(self, client, project, sequence):
        archived = SequenceFactory.create(
            project=project, code="OLD2", episode=sequence.episode, is_deleted=True
        )

        resp = client.post(
            "/api/v1/sequences/bulk-create/",
            {
                "project_id": str(project.id),
                "items": [{"code": "OLD2", "action": "recover", "data": {}}],
            },
            format="json",
        )

        assert resp.json()["results"][0]["status"] == "recovered"
        archived.refresh_from_db()
        assert archived.is_deleted is False

    def test_the_check_for_existing_codes_is_unchanged(self, client, project, sequence):
        resp = client.post(
            "/api/v1/sequences/check-existence/",
            {"project_id": str(project.id), "codes": ["TST_SQ0001", "TST_NEW"]},
            format="json",
        )

        assert [(i["code"], i["state"]) for i in resp.json()["items"]] == [
            ("TST_SQ0001", "EXISTS"),
            ("TST_NEW", "NEW"),
        ]
