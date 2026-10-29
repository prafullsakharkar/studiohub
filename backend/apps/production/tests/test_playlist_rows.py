"""
Playlist entries as rows (WP E5, DECISIONS D-31): entries are validated whichever way they arrive,
appends and reorders cannot lose or duplicate positions, and share settings are typed.
"""

from __future__ import annotations

import threading

import pytest
from django.db import connection
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import Playlist, PlaylistEntry, ProjectMembership
from apps.production.services.playlist import PlaylistService
from apps.production.tests.factories import (
    PlaylistFactory,
    ProjectFactory,
    ShotFactory,
    VersionFactory,
)

pytestmark = pytest.mark.django_db

CODES = ("playlist.view", "playlist.create", "playlist.update", "version.view", "version.update")


@pytest.fixture
def project():
    return ProjectFactory.create(code="PLROWS")


@pytest.fixture
def other_project():
    return ProjectFactory.create(code="PLOTHER")


def _user(*projects, codes=CODES):
    user = UserFactory.create()
    grant_permissions(user, *codes)
    for project in projects:
        ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    return user


def _api(user):
    api = APIClient()
    api.force_authenticate(user=user)
    return api


def _versions(project, count=3):
    shot = ShotFactory.create(project=project, code="S1")
    return [
        VersionFactory.create(project=project, shot=shot, code=f"V{n}", version_index=n + 1)
        for n in range(count)
    ]


def _url(playlist, tail=""):
    return f"/api/v1/playlists/{playlist.id}/{tail}"


class TestCreate:
    def test_entries_sent_with_a_new_playlist_become_rows(self, project):
        v1, v2, _ = _versions(project)
        api = _api(_user(project))

        resp = api.post(
            "/api/v1/playlists/",
            {
                "project": str(project.id),
                "name": "Dailies",
                "code": "D1",
                "entries": [{"version_id": str(v2.id), "label": "b"}, {"version_id": str(v1.id)}],
            },
            format="json",
        )

        assert resp.status_code == 201, resp.json()
        entries = resp.json()["entries"]
        assert [(e["version_id"], e["item_order"]) for e in entries] == [
            (str(v2.id), 1),
            (str(v1.id), 2),
        ]
        assert entries[0]["label"] == "b" and entries[0]["version_number"] == v2.version_number

    def test_a_version_of_another_project_refuses_the_whole_create(self, project, other_project):
        foreign = _versions(other_project, 1)[0]
        api = _api(_user(project, other_project))

        resp = api.post(
            "/api/v1/playlists/",
            {
                "project": str(project.id),
                "name": "Dailies",
                "code": "D1",
                "entries": [{"version_id": str(foreign.id)}],
            },
            format="json",
        )

        assert resp.status_code == 400
        assert not Playlist.objects.filter(code="D1").exists()
        assert not PlaylistEntry.objects.exists()

    def test_share_settings_are_typed_and_extra_keys_pass(self, project):
        api = _api(_user(project))
        base = {"project": str(project.id), "name": "N", "code": "SS"}

        bad = api.post(
            "/api/v1/playlists/", {**base, "share_settings": {"is_public": "maybe"}}, format="json"
        )
        good = api.post(
            "/api/v1/playlists/",
            {**base, "share_settings": {"is_public": True, "theme": "dark"}},
            format="json",
        )

        assert bad.status_code == 400 and "share_settings" in bad.json()
        assert good.status_code == 201
        assert good.json()["share_settings"] == {"is_public": True, "theme": "dark"}


class TestUpdate:
    def test_entries_cannot_be_written_directly_but_an_echo_is_fine(self, project):
        playlist = PlaylistFactory.create(project=project, code="U1")
        version = _versions(project, 1)[0]
        PlaylistService.add_entry(user=None, playlist=playlist, version_ref=version.id)
        api = _api(_user(project))
        shown = api.get(_url(playlist)).json()["entries"]

        forged = api.patch(
            _url(playlist), {"entries": [{"version_id": str(version.id)}] * 2}, format="json"
        )
        echoed = api.patch(_url(playlist), {"entries": shown, "name": "Renamed"}, format="json")

        assert forged.status_code == 400 and "entries" in forged.json()
        assert echoed.status_code == 200, echoed.json()
        assert PlaylistEntry.objects.filter(playlist=playlist).count() == 1

    def test_share_settings_are_validated_on_update(self, project):
        playlist = PlaylistFactory.create(project=project, code="U2")
        api = _api(_user(project))

        assert (
            api.patch(
                _url(playlist), {"share_settings": {"is_public": "x"}}, format="json"
            ).status_code
            == 400
        )
        ok = api.patch(_url(playlist), {"share_settings": {"is_public": True}}, format="json")
        assert ok.status_code == 200 and ok.json()["share_settings"] == {"is_public": True}


class TestActions:
    def test_add_entry_keeps_extra_keys_and_the_server_owns_id_and_order(self, project):
        playlist = PlaylistFactory.create(project=project, code="A1")
        v1, v2, _ = _versions(project)
        api = _api(_user(project))

        api.post(
            _url(playlist, "add-entry/"),
            {"version_id": str(v1.id), "notes_count": 2},
            format="json",
        )
        resp = api.post(
            _url(playlist, "add-entry/"),
            {"version_id": str(v2.id), "id": "forged", "item_order": 99},
            format="json",
        )

        entries = resp.json()["entries"]
        assert [e["item_order"] for e in entries] == [1, 2]
        assert entries[0]["notes_count"] == 2 and entries[1]["id"] != "forged"

    def test_a_placeholder_without_a_version_is_allowed(self, project):
        playlist = PlaylistFactory.create(project=project, code="A2")
        resp = _api(_user(project)).post(
            _url(playlist, "add-entry/"), {"label": "slate"}, format="json"
        )

        assert resp.status_code == 200
        assert resp.json()["entries"][0]["version_id"] is None
        assert resp.json()["entries"][0]["label"] == "slate"

    def test_remove_by_id_and_by_the_old_id_and_unknown_changes_nothing(self, project):
        playlist = PlaylistFactory.create(project=project, code="A3")
        v1, v2, _ = _versions(project)
        first = PlaylistService.add_entry(user=None, playlist=playlist, version_ref=v1.id)
        old = PlaylistService.add_entry(user=None, playlist=playlist, version_ref=v2.id)
        PlaylistEntry.objects.filter(pk=old.pk).update(legacy_id="e-old")
        api = _api(_user(project))

        assert (
            api.post(
                _url(playlist, "remove-entry/"), {"entry_id": "nope"}, format="json"
            ).status_code
            == 200
        )
        assert PlaylistEntry.objects.filter(playlist=playlist).count() == 2
        api.post(_url(playlist, "remove-entry/"), {"entry_id": str(first.pk)}, format="json")
        resp = api.post(_url(playlist, "remove-entry/"), {"entry_id": "e-old"}, format="json")

        assert resp.json()["entries"] == []

    def test_reorder_puts_the_listed_first_and_never_drops_the_rest(self, project):
        playlist = PlaylistFactory.create(project=project, code="A4")
        vs = _versions(project)
        rows = [
            PlaylistService.add_entry(user=None, playlist=playlist, version_ref=v.id) for v in vs
        ]
        api = _api(_user(project))

        resp = api.post(
            _url(playlist, "reorder/"), {"entries": [{"id": str(rows[2].pk)}]}, format="json"
        )

        assert [e["id"] for e in resp.json()["entries"]] == [
            str(rows[2].pk),
            str(rows[0].pk),
            str(rows[1].pk),
        ]
        assert [e["item_order"] for e in resp.json()["entries"]] == [1, 2, 3]

    def test_reorder_refuses_unknown_foreign_and_repeated_ids(self, project, other_project):
        playlist = PlaylistFactory.create(project=project, code="A5")
        elsewhere = PlaylistFactory.create(project=other_project, code="A6")
        mine = PlaylistService.add_entry(
            user=None, playlist=playlist, version_ref=_versions(project, 1)[0].id
        )
        theirs = PlaylistService.add_entry(user=None, playlist=elsewhere, version_ref=None)
        api = _api(_user(project))

        for ids in ([str(theirs.pk)], ["forged"], [str(mine.pk), str(mine.pk)]):
            resp = api.post(
                _url(playlist, "reorder/"), {"entries": [{"id": i} for i in ids]}, format="json"
            )
            assert resp.status_code == 400, ids

    def test_a_version_adds_itself_to_a_playlist_of_its_project(self, project):
        playlist = PlaylistFactory.create(project=project, code="A7")
        version = _versions(project, 1)[0]

        resp = _api(_user(project)).post(
            f"/api/v1/versions/{version.id}/add-to-playlist/",
            {"playlist_id": str(playlist.id)},
            format="json",
        )

        assert resp.status_code == 200
        assert PlaylistEntry.objects.get(playlist=playlist).version_id == version.id

    def test_the_actions_need_the_update_permission(self, project):
        playlist = PlaylistFactory.create(project=project, code="A8")
        viewer = _user(project, codes=("playlist.view",))

        assert _api(viewer).post(_url(playlist, "add-entry/"), {}, format="json").status_code == 403


@pytest.mark.django_db(transaction=True)
def test_parallel_adds_get_distinct_positions():
    project = ProjectFactory.create(code="PLRACE")
    playlist = PlaylistFactory.create(project=project, code="RACE")
    versions = _versions(project, 6)
    start = threading.Barrier(6)
    outcomes: list[str] = []

    def add(version):
        try:
            start.wait()
            PlaylistService.add_entry(user=None, playlist=playlist, version_ref=version.id)
            outcomes.append("ok")
        except Exception as exc:  # noqa: BLE001
            outcomes.append(type(exc).__name__)
        finally:
            connection.close()

    threads = [threading.Thread(target=add, args=(v,)) for v in versions]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert outcomes == ["ok"] * 6, outcomes
    assert sorted(
        PlaylistEntry.objects.filter(playlist=playlist).values_list("position", flat=True)
    ) == list(range(1, 7))


class TestLegacyImport:
    def test_entries_become_rows_in_item_order_and_the_unreadable_are_reported(
        self, project, other_project
    ):
        mine = _versions(project, 1)[0]
        foreign = _versions(other_project, 1)[0]
        playlist = PlaylistFactory.create(project=project, code="L1")
        entries = [
            {"id": "b", "version_id": str(mine.id), "item_order": 2, "notes_count": 4},
            {"id": "a", "item_order": 1, "label": "slate"},
            {"id": "x", "version_id": str(foreign.id), "item_order": 3},
            "junk",
        ]

        problems = PlaylistService.import_legacy_json(playlist, entries)

        rows = list(PlaylistEntry.objects.filter(playlist=playlist))
        assert [(r.legacy_id, r.position, r.version_id) for r in rows] == [
            ("a", 1, None),
            ("b", 2, mine.id),
        ]
        assert rows[1].extra == {"notes_count": 4} and rows[0].extra == {"label": "slate"}
        assert len(problems) == 2 and "names no version of the project" in problems[0]
        assert (
            PlaylistService.import_legacy_json(playlist, entries) == []
        )  # a second run adds nothing
        assert PlaylistEntry.objects.filter(playlist=playlist).count() == 2
