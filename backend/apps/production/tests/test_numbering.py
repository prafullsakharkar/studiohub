"""
Numbered codes and the episode code derivation (DECISIONS D-23).
"""

from __future__ import annotations

import threading

import pytest
from django.db import connection
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import ProjectMembership, Shot
from apps.production.services.numbering import allocate_codes, episode_code
from apps.production.services.shot import ShotService
from apps.production.tests.factories import ProjectFactory, ShotFactory

pytestmark = pytest.mark.django_db


class TestEpisodeCode:
    @pytest.mark.parametrize(
        ("season", "episode", "expected"),
        [(1, 1, "EP101"), (1, 12, "EP112"), (9, 99, "EP999"), (0, 0, "EP000"),
         (1, 100, "EP01100"), (10, 1, "EP10001"), (12, 34, "EP12034"), (99, 999, "EP99999")],
    )  # fmt: skip
    def test_derivation(self, season, episode, expected):
        assert episode_code(season, episode) == expected

    @pytest.mark.parametrize(("season", "episode"), [(100, 1), (1, 1000), (-1, 5), (1, -1)])
    def test_numbers_out_of_range_derive_nothing(self, season, episode):
        assert episode_code(season, episode) is None

    def test_no_two_pairs_share_a_code(self):
        codes = {}
        for season in range(0, 100):
            for episode in range(0, 1000, 7):  # a spread, plus the edges below
                codes.setdefault(episode_code(season, episode), []).append((season, episode))
        for season in range(0, 100):
            for episode in (0, 1, 9, 10, 99, 100, 101, 999):
                codes.setdefault(episode_code(season, episode), []).append((season, episode))
        clashes = {code: pairs for code, pairs in codes.items() if len(set(pairs)) > 1}
        assert clashes == {}

    def test_the_old_ambiguous_pair_no_longer_collides(self):
        assert episode_code(1, 101) != episode_code(11, 1)  # both used to be EP1101


class TestAllocateCodes:
    def test_the_first_codes_of_a_series(self):
        project = ProjectFactory.create(code="NUM1")

        assert allocate_codes(project, Shot, "SH", 3) == ["SH0010", "SH0020", "SH0030"]

    def test_it_continues_after_the_highest_in_use_in_any_case_and_soft_deleted(self):
        project = ProjectFactory.create(code="NUM2")
        ShotFactory.create(project=project, code="SH0010")
        ShotFactory.create(project=project, code="sh0045")
        ShotFactory.create(project=project, code="SH0100", is_deleted=True)
        ShotFactory.create(project=project, code="SHOT7")  # not part of the series

        assert allocate_codes(project, Shot, "SH", 2) == ["SH0110", "SH0120"]

    def test_series_and_projects_are_independent(self):
        project, other = ProjectFactory.create(code="NUM3"), ProjectFactory.create(code="NUM4")
        ShotFactory.create(project=project, code="SH0050")
        ShotFactory.create(project=project, code="PL0090")

        assert allocate_codes(project, Shot, "PL", 1) == ["PL0100"]
        assert allocate_codes(other, Shot, "SH", 1) == ["SH0010"]

    def test_step_and_padding(self):
        project = ProjectFactory.create(code="NUM5")

        assert allocate_codes(project, Shot, "sq", 2, step=5, padding=3) == ["SQ005", "SQ010"]

    @pytest.mark.parametrize("prefix", ["", "1SH", "S H", "SH/", "A" * 21])
    def test_a_bad_prefix_is_a_400(self, prefix):
        with pytest.raises(ValidationError):
            allocate_codes(ProjectFactory.create(code="NUM6"), Shot, prefix, 1)

    @pytest.mark.parametrize("count", [0, 1001])
    def test_a_bad_count_is_a_400(self, count):
        with pytest.raises(ValidationError):
            allocate_codes(ProjectFactory.create(code="NUM7"), Shot, "SH", count)


class TestBulkCreateWithNumbers:
    def _client(self, project):
        user = UserFactory.create()
        grant_permissions(user, "shot.view", "shot.create")
        ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
        api = APIClient()
        api.force_authenticate(user=user)
        return api

    def test_items_without_a_code_get_the_next_numbers_in_order(self):
        project = ProjectFactory.create(code="NUM8")
        ShotFactory.create(project=project, code="SH0020")
        api = self._client(project)

        resp = api.post(
            "/api/v1/shots/bulk-create/",
            {
                "items": [
                    {"project_id": str(project.id), "code_prefix": "SH", "name": f"n{i}"}
                    for i in range(3)
                ]
            },
            format="json",
        )

        assert resp.status_code in (200, 201, 207), resp.json()
        assert [r["status"] for r in resp.json()["results"]] == ["created"] * 3
        assert list(Shot.objects.filter(project=project).order_by("code").values_list("code", flat=True)) == [
            "SH0020", "SH0030", "SH0040", "SH0050",
        ]  # fmt: skip

    def test_typed_codes_and_numbered_ones_mix(self):
        project = ProjectFactory.create(code="NUM9")
        api = self._client(project)

        resp = api.post(
            "/api/v1/shots/bulk-create/",
            {"items": [
                {"project_id": str(project.id), "code": "OPENING"},
                {"project_id": str(project.id), "code_prefix": "SH"},
            ]},
            format="json",
        )  # fmt: skip

        assert [r["status"] for r in resp.json()["results"]] == ["created", "created"]
        assert set(Shot.objects.filter(project=project).values_list("code", flat=True)) == {
            "OPENING",
            "SH0010",
        }

    def test_a_bad_prefix_fails_its_items_only(self):
        project = ProjectFactory.create(code="NUM10")
        api = self._client(project)

        resp = api.post(
            "/api/v1/shots/bulk-create/",
            {"items": [
                {"project_id": str(project.id), "code_prefix": "9bad"},
                {"project_id": str(project.id), "code_prefix": "SH"},
            ]},
            format="json",
        )  # fmt: skip

        assert [r["status"] for r in resp.json()["results"]] == ["invalid", "created"]
        assert list(Shot.objects.filter(project=project).values_list("code", flat=True)) == [
            "SH0010"
        ]

    def test_a_project_the_caller_is_not_in_gets_no_numbers(self):
        mine, theirs = ProjectFactory.create(code="NUM11"), ProjectFactory.create(code="NUM12")
        api = self._client(mine)

        resp = api.post(
            "/api/v1/shots/bulk-create/",
            {"items": [{"project_id": str(theirs.id), "code_prefix": "SH"}]},
            format="json",
        )

        assert [r["status"] for r in resp.json()["results"]] == ["invalid"]
        assert not Shot.objects.filter(project=theirs).exists()


@pytest.mark.django_db(transaction=True)
def test_two_batches_numbering_the_same_project_never_overlap():
    """Two concurrent numbered batches: every item is created and no number is used twice."""
    project = ProjectFactory.create(code="NUMRACE")
    admin = UserFactory.create(is_superuser=True, is_staff=True)
    results: list[list[dict]] = []
    start = threading.Barrier(2)

    def batch():
        try:
            start.wait()
            items = [
                {"project_id": str(project.id), "code_prefix": "SH", "name": f"n{i}"}
                for i in range(6)
            ]
            results.append(
                ShotService.bulk_create(
                    items, validate=lambda _p, item: ({"name": item["name"]}, None), user=admin
                )
            )
        finally:
            connection.close()

    threads = [threading.Thread(target=batch) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    statuses = [row["status"] for rows in results for row in rows]
    codes = sorted(Shot.objects.filter(project=project).values_list("code", flat=True))
    assert statuses == ["created"] * 12, statuses
    assert codes == [f"SH{n:04d}" for n in range(10, 130, 10)]


def test_the_episode_serializer_uses_the_new_derivation():
    project = ProjectFactory.create(code="NUMEP", workflow_type="episodic")
    user = UserFactory.create()
    grant_permissions(user, "episode.view", "episode.create")
    ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    api = APIClient()
    api.force_authenticate(user=user)

    short = api.post(
        "/api/v1/episodes/",
        {"project_id": str(project.id), "season_number": 1, "episode_number": 7},
        format="json",
    )
    long = api.post(
        "/api/v1/episodes/",
        {"project_id": str(project.id), "season_number": 12, "episode_number": 34},
        format="json",
    )
    far = api.post(
        "/api/v1/episodes/",
        {"project_id": str(project.id), "season_number": 100, "episode_number": 1},
        format="json",
    )

    assert short.status_code == 201 and short.json()["code"] == "EP107", short.json()
    assert long.status_code == 201 and long.json()["code"] == "EP12034", long.json()
    assert far.status_code == 400 and "code" in far.json()
