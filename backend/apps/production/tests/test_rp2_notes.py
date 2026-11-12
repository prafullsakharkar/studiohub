"""
RP-2 notes (docs/review-pipeline/PLAN.md, CONTRACTS.md C-RP-07 to C-RP-13): threads with replies, links
to several records checked by the server, an optional task, a status, edit and delete, and the
back-fill of links for notes written before (WP 2.6).
"""

from __future__ import annotations

import importlib
import uuid

import pytest
from django.apps import apps as django_apps
from rest_framework.test import APIClient

from apps.core.events import default_event_bus
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.events.notes import NoteCreated, NoteReplied, NoteStatusChanged
from apps.production.models import ProjectMembership, ProjectNote, ProjectNoteLink
from apps.production.tests.factories import (
    AssetFactory,
    EpisodeFactory,
    PlaylistFactory,
    ProjectFactory,
    ReviewFactory,
    SequenceFactory,
    ShotFactory,
    ShowFactory,
    TaskFactory,
    VersionFactory,
)
from apps.production.validators.project_note import (
    LINKS_NOT_IN_PROJECT,
    TASK_NOT_IN_PROJECT,
    TOO_MANY_LINKS,
)

pytestmark = pytest.mark.django_db

ARTIST = ("project.view", "note.create")
SUPERVISOR = (*ARTIST, "note.update", "note.delete")


@pytest.fixture
def project():
    return ProjectFactory.create(code="RPTWO")


@pytest.fixture
def other_project():
    return ProjectFactory.create(code="RPELSE")


@pytest.fixture
def records(project):
    shot = ShotFactory.create(project=project, code="RPTWO_S1", name="Opening")
    return {
        "shot": shot,
        "shot2": ShotFactory.create(project=project, code="RPTWO_S2"),
        "asset": AssetFactory.create(project=project, code="RPTWO_A1", name="Hero"),
        "sequence": SequenceFactory.create(project=project, code="RPTWO_SQ1", name="Seq one"),
        "version": VersionFactory.create(project=project, shot=shot, code="RPTWO_V1"),
        "playlist": PlaylistFactory.create(project=project, code="RPTWO_PL1", name="Dailies"),
        "review": ReviewFactory.create(project=project, code="RPTWO_R1", title="Comp review"),
    }


def _user(project, codes=ARTIST, **membership):
    user = UserFactory.create()
    grant_permissions(user, *codes)
    if project is not None:
        ProjectMembership.objects.create(
            user=user, project=project, status="active", role="Artist", **membership
        )
    return user


def _api(user):
    api = APIClient()
    api.force_authenticate(user=user)
    return api


def _base(project):
    return f"/api/organizations/projects/{project.id}/notes/"


def _link(record, entity_type):
    return {"entity_type": entity_type, "entity_id": str(record.id)}


def _create(api, project, **body):
    body.setdefault("subject", "Edge is soft")
    return api.post(_base(project), body, format="json")


def _thread(api, project, **body):
    resp = _create(api, project, **body)
    assert resp.status_code == 201, resp.content
    return resp.json()


def _list(api, project, **params):
    resp = api.get(_base(project), params)
    assert resp.status_code == 200, resp.content
    return resp.json()["results"]


@pytest.fixture
def events(monkeypatch):
    """The note events dispatched (other apps' events are left out)."""
    seen = []
    note_events = (NoteCreated, NoteReplied, NoteStatusChanged)

    def record(event):
        if isinstance(event, note_events):
            seen.append(event)

    monkeypatch.setattr(default_event_bus.dispatcher, "dispatch", record)
    return seen


class TestCreate:
    """C-RP-07, C-RP-08."""

    def test_several_links_and_a_task_with_codes_from_the_records(self, project, records):
        task = TaskFactory.create(project=project, code="RPTWO_T1")
        api = _api(_user(project))

        note = _thread(
            api,
            project,
            links=[_link(records["shot"], "Shot"), _link(records["version"], "Version")],
            task_id=str(task.id),
            entity_code="FAKE",
            entity_name="Fake name",
        )

        assert [(lk["entity_type"], lk["code"]) for lk in note["links"]] == [
            ("Shot", "RPTWO_S1"),
            ("Version", "RPTWO_V1"),
        ]
        assert note["links"][0]["name"] == "Opening"
        assert note["entity_type"] == "Shot" and note["entity_id"] == str(records["shot"].id)
        assert (note["entity_code"], note["entity_name"]) == ("RPTWO_S1", "Opening")
        assert (note["task_id"], note["task_code"]) == (str(task.id), "RPTWO_T1")
        assert note["parent_id"] is None and note["reply_count"] == 0

    def test_every_link_type(self, project, records):
        episodic = ProjectFactory.create(code="RPEPI", workflow_type="episodic")
        episode = EpisodeFactory.create(project=episodic, code="RPEPI_E1", name="Pilot")
        user = _user(project)
        ProjectMembership.objects.create(
            user=user, project=episodic, status="active", role="Artist"
        )
        api = _api(user)
        links = [
            _link(records[key], kind)
            for key, kind in (
                ("sequence", "Sequence"),
                ("shot", "Shot"),
                ("asset", "Asset"),
                ("version", "Version"),
                ("playlist", "Playlist"),
                ("review", "Review"),
            )
        ]

        note = _thread(api, project, links=links)
        on_episode = _thread(api, episodic, links=[_link(episode, "Episode")])

        assert [lk["code"] for lk in note["links"]] == [
            "RPTWO_SQ1",
            "RPTWO_S1",
            "RPTWO_A1",
            "RPTWO_V1",
            "RPTWO_PL1",
            "RPTWO_R1",
        ]
        assert note["links"][5]["name"] == "Comp review"
        assert on_episode["links"][0]["code"] == "RPEPI_E1"

    def test_the_old_pair_is_the_first_link(self, project, records):
        api = _api(_user(project))

        note = _thread(
            api,
            project,
            entity_type="Asset",
            entity_id=str(records["asset"].id),
            entity_code="typed",
            links=[_link(records["shot"], "Shot")],
        )

        assert [lk["entity_type"] for lk in note["links"]] == ["Asset", "Shot"]
        assert note["entity_code"] == "RPTWO_A1"

    def test_no_record_is_the_project(self, project):
        note = _thread(_api(_user(project)), project, entity_type="Project")

        assert note["links"] == []
        assert (note["entity_type"], note["entity_id"], note["entity_code"]) == ("Project", "", "")

    def test_a_repeat_is_kept_once(self, project, records):
        shot = _link(records["shot"], "Shot")
        note = _thread(_api(_user(project)), project, links=[shot, shot, shot])

        assert len(note["links"]) == 1
        assert ProjectNoteLink.objects.filter(note_id=note["id"]).count() == 1

    def test_more_than_twenty_is_400(self, project, records):
        resp = _create(_api(_user(project)), project, links=[_link(records["shot"], "Shot")] * 21)

        assert resp.status_code == 400
        assert resp.json()["links"] == [TOO_MANY_LINKS]

    @pytest.mark.parametrize(
        "case", ["other_project", "archived", "malformed", "unknown", "bad_type", "task_type"]
    )
    def test_a_record_that_is_not_yours_reads_like_one_that_does_not_exist(
        self, project, other_project, records, case
    ):
        foreign = ShotFactory.create(project=other_project, code="RPELSE_S1")
        archived = ShotFactory.create(project=project, code="RPTWO_OLD")
        archived.delete()
        task = TaskFactory.create(project=project)
        link = {
            "other_project": _link(foreign, "Shot"),
            "archived": _link(archived, "Shot"),
            "malformed": {"entity_type": "Shot", "entity_id": "not-a-uuid"},
            "unknown": {"entity_type": "Shot", "entity_id": str(uuid.uuid4())},
            "bad_type": _link(records["shot"], "Spaceship"),
            "task_type": _link(task, "Task"),
        }[case]
        api = _api(_user(project))

        resp = _create(api, project, links=[_link(records["shot"], "Shot"), link])

        assert resp.status_code == 400, resp.content
        assert resp.json()["links"] == [LINKS_NOT_IN_PROJECT]
        assert not ProjectNote.objects.filter(project=project).exists()

    @pytest.mark.parametrize("caller", ["member_of_both", "superuser"])
    def test_another_projects_record_is_refused_to_someone_who_sees_both(
        self, project, other_project, caller
    ):
        foreign = ShotFactory.create(project=other_project, code="RPELSE_S3")
        foreign_task = TaskFactory.create(project=other_project)
        if caller == "superuser":
            user = UserFactory.create(is_superuser=True)
        else:
            user = _user(project)
            ProjectMembership.objects.create(
                user=user, project=other_project, status="active", role="Artist"
            )
        api = _api(user)

        links = _create(api, project, links=[_link(foreign, "Shot")])
        task = _create(api, project, task_id=str(foreign_task.id))

        assert links.status_code == 400 and links.json()["links"] == [LINKS_NOT_IN_PROJECT]
        assert task.status_code == 400 and task.json()["task_id"] == [TASK_NOT_IN_PROJECT]

    def test_the_old_pair_is_checked_too(self, project, other_project):
        foreign = ShotFactory.create(project=other_project, code="RPELSE_S2")

        resp = _create(_api(_user(project)), project, entity_type="Shot", entity_id=str(foreign.id))

        assert resp.status_code == 400
        assert resp.json()["links"] == [LINKS_NOT_IN_PROJECT]

    @pytest.mark.parametrize("case", ["other_project", "malformed", "unknown"])
    def test_a_task_of_another_project_is_400(self, project, other_project, case):
        task_id = {
            "other_project": str(TaskFactory.create(project=other_project).id),
            "malformed": "nope",
            "unknown": str(uuid.uuid4()),
        }[case]

        resp = _create(_api(_user(project)), project, task_id=task_id)

        assert resp.status_code == 400
        assert resp.json()["task_id"] == [TASK_NOT_IN_PROJECT]

    def test_a_new_note_is_open_whatever_is_sent(self, project):
        note = _thread(_api(_user(project)), project, status="Closed")

        assert note["status"] == "Open" and note["addressed_at"] is None

    def test_the_author_is_the_caller(self, project):
        user = _user(project)
        note = _thread(_api(user), project, author_name="Someone else", author_role="Director")

        assert note["author_id"] == str(user.id)
        assert note["author_name"] != "Someone else" and note["author_role"] == "Artist"

    def test_codes_are_read_as_they_are_now(self, project, records):
        api = _api(_user(project))
        note = _thread(api, project, links=[_link(records["shot"], "Shot")])
        type(records["shot"]).objects.filter(pk=records["shot"].pk).update(code="RPTWO_S1B")

        listed = _list(api, project)

        assert listed[0]["id"] == note["id"]
        assert listed[0]["links"][0]["code"] == "RPTWO_S1B"


class TestList:
    """C-RP-09."""

    def test_threads_only_with_live_reply_counts(self, project):
        api = _api(_user(project))
        thread = _thread(api, project)
        for body in ("one", "two"):
            assert (
                api.post(f"{_base(project)}{thread['id']}/replies/", {"body": body}).status_code
                == 201
            )
        ProjectNote.objects.get(parent_id=thread["id"], body="two").delete()

        rows = _list(api, project)

        assert [r["id"] for r in rows] == [thread["id"]]
        assert rows[0]["reply_count"] == 1

    def test_by_record_matches_any_link(self, project, records):
        api = _api(_user(project))
        first = _thread(api, project, links=[_link(records["shot"], "Shot")])
        second = _thread(
            api, project, links=[_link(records["asset"], "Asset"), _link(records["shot"], "Shot")]
        )
        _thread(api, project, links=[_link(records["shot2"], "Shot")])
        shot = records["shot"]

        found = _list(api, project, entity_type="Shot", entity_id=str(shot.id))

        assert {r["id"] for r in found} == {first["id"], second["id"]}
        # Both parts are matched on the same link: the asset of `second` is not a Shot.
        assert _list(api, project, entity_type="Shot", entity_id=str(records["asset"].id)) == []

    def test_by_task_status_and_author(self, project):
        task = TaskFactory.create(project=project)
        author, other = _user(project), _user(project)
        on_task = _thread(_api(author), project, task_id=str(task.id))
        theirs = _thread(_api(other), project)
        ProjectNote.objects.filter(pk=theirs["id"]).update(status="Closed")
        api = _api(author)

        assert [r["id"] for r in _list(api, project, task_id=str(task.id))] == [on_task["id"]]
        assert [r["id"] for r in _list(api, project, status="Closed")] == [theirs["id"]]
        assert [r["id"] for r in _list(api, project, author_id=str(author.id))] == [on_task["id"]]

    @pytest.mark.parametrize(
        "params",
        [
            {"entity_type": "Spaceship"},
            {"entity_id": "nope"},
            {"task_id": "nope"},
            {"author_id": "nope"},
            {"status": "Lost"},
            {"task_id": str(uuid.UUID(int=7))},
        ],
    )
    def test_an_unknown_value_is_an_empty_list(self, project, params):
        api = _api(_user(project))
        _thread(api, project)

        assert _list(api, project, **params) == []

    def test_an_empty_value_is_no_filter(self, project):
        api = _api(_user(project))
        _thread(api, project)

        assert len(_list(api, project, entity_type="", entity_id="", task_id="")) == 1


class TestDetailAndReplies:
    """C-RP-10, C-RP-11."""

    def test_detail_has_the_replies_oldest_first(self, project):
        author, other = _user(project), _user(project)
        thread = _thread(_api(author), project)
        url = f"{_base(project)}{thread['id']}/"
        first = _api(other).post(f"{url}replies/", {"body": "first"}).json()
        second = _api(author).post(f"{url}replies/", {"body": "second"}).json()

        detail = _api(author).get(url).json()

        assert [r["id"] for r in detail["replies"]] == [first["id"], second["id"]]
        assert detail["reply_count"] == 2
        assert first["parent_id"] == thread["id"] and first["links"] == []
        assert first["author_id"] == str(other.id)

    def test_a_reply_id_answers_with_its_thread(self, project):
        api = _api(_user(project))
        thread = _thread(api, project)
        reply = api.post(f"{_base(project)}{thread['id']}/replies/", {"body": "ok"}).json()

        assert api.get(f"{_base(project)}{reply['id']}/").json()["id"] == thread["id"]

    def test_a_reply_to_a_reply_is_on_the_root(self, project, records):
        api = _api(_user(project))
        thread = _thread(api, project, links=[_link(records["shot"], "Shot")])
        reply = api.post(f"{_base(project)}{thread['id']}/replies/", {"body": "one"}).json()

        nested = api.post(f"{_base(project)}{reply['id']}/replies/", {"body": "two"})

        assert nested.status_code == 201
        body = nested.json()
        assert body["parent_id"] == thread["id"]
        assert body["links"] == [] and body["task_id"] is None and body["status"] == "Open"
        assert body["entity_type"] == "Project"

    def test_a_blank_reply_is_400(self, project):
        api = _api(_user(project))
        thread = _thread(api, project)

        assert (
            api.post(f"{_base(project)}{thread['id']}/replies/", {"body": "  "}).status_code == 400
        )

    @pytest.mark.parametrize("case", ["deleted", "other_project", "malformed", "unknown"])
    def test_a_note_that_is_not_there_is_404(self, project, other_project, case):
        api = _api(_user(project))
        if case == "deleted":
            note_id = _thread(api, project)["id"]
            ProjectNote.objects.get(pk=note_id).delete()
        elif case == "other_project":
            note_id = str(ProjectNote.objects.create(project=other_project, subject="x").pk)
        else:
            note_id = "nope" if case == "malformed" else str(uuid.uuid4())
        url = f"{_base(project)}{note_id}/"

        assert api.get(url).status_code == 404
        assert api.post(f"{url}replies/", {"body": "hi"}).status_code == 404
        assert api.post(f"{url}status/", {"status": "Closed"}).status_code == 404
        assert api.patch(url, {"body": "x"}, format="json").status_code == 404
        assert api.delete(url).status_code == 404

    def test_a_reply_whose_thread_was_deleted_is_404(self, project):
        api = _api(_user(project, SUPERVISOR))
        thread = _thread(api, project)
        reply = api.post(f"{_base(project)}{thread['id']}/replies/", {"body": "x"}).json()
        ProjectNote.objects.get(pk=thread["id"]).delete()

        assert api.get(f"{_base(project)}{reply['id']}/").status_code == 404


class TestWho:
    """Partial members, non-members (unchanged) and the method codes."""

    @pytest.mark.parametrize("kind", ["show_bound", "department_bound", "vendor", "outsider"])
    def test_partial_members_and_outsiders_get_404_everywhere(self, project, kind):
        author_api = _api(_user(project, SUPERVISOR))
        thread = _thread(author_api, project)
        membership = {
            "show_bound": {"show": ShowFactory.create(project=project)},
            "department_bound": {"department": "Comp"},
            "vendor": {"vendor_id": "v-1"},
            "outsider": None,
        }[kind]
        if membership is None:
            caller = _user(None, SUPERVISOR)
        else:
            caller = _user(project, SUPERVISOR, **membership)
        api = _api(caller)
        url = f"{_base(project)}{thread['id']}/"

        assert api.get(_base(project)).status_code == 404
        assert _create(api, project).status_code == 404
        assert api.get(url).status_code == 404
        assert api.post(f"{url}replies/", {"body": "x"}).status_code == 404
        assert api.post(f"{url}status/", {"status": "Closed"}).status_code == 404

    def test_writes_need_note_create(self, project):
        thread = _thread(_api(_user(project, SUPERVISOR)), project)
        reader = _api(_user(project, ("project.view",)))
        url = f"{_base(project)}{thread['id']}/"

        assert reader.get(url).status_code == 200
        assert _create(reader, project).status_code == 403
        assert reader.post(f"{url}replies/", {"body": "x"}).status_code == 403
        assert reader.post(f"{url}status/", {"status": "Closed"}).status_code == 403
        assert reader.patch(url, {"body": "x"}, format="json").status_code == 403
        assert reader.delete(url).status_code == 403


class TestEdit:
    """C-RP-12 (Q-RP-11 = A)."""

    def test_the_author_edits_their_own(self, project, records):
        task = TaskFactory.create(project=project, code="RPTWO_T2")
        api = _api(_user(project))
        thread = _thread(api, project, links=[_link(records["shot"], "Shot")])

        resp = api.patch(
            f"{_base(project)}{thread['id']}/",
            {
                "subject": "Edge fixed?",
                "links": [_link(records["asset"], "Asset")],
                "task_id": str(task.id),
            },
            format="json",
        )

        assert resp.status_code == 200, resp.content
        body = resp.json()
        assert body["subject"] == "Edge fixed?"
        assert [lk["code"] for lk in body["links"]] == ["RPTWO_A1"]
        assert body["entity_code"] == "RPTWO_A1" and body["task_code"] == "RPTWO_T2"

    def test_task_null_clears_it_and_links_left_out_stay(self, project, records):
        task = TaskFactory.create(project=project)
        api = _api(_user(project))
        thread = _thread(api, project, links=[_link(records["shot"], "Shot")], task_id=str(task.id))

        body = api.patch(
            f"{_base(project)}{thread['id']}/", {"task_id": None}, format="json"
        ).json()

        assert body["task_id"] is None
        assert [lk["code"] for lk in body["links"]] == ["RPTWO_S1"]

    def test_someone_else_needs_note_update(self, project):
        thread = _thread(_api(_user(project)), project)
        url = f"{_base(project)}{thread['id']}/"

        other = _api(_user(project)).patch(url, {"body": "mine now"}, format="json")
        supervisor = _api(_user(project, SUPERVISOR)).patch(url, {"body": "fine"}, format="json")

        assert other.status_code == 403
        assert supervisor.status_code == 200 and supervisor.json()["body"] == "fine"

    def test_a_refused_editor_gets_403_before_the_body_is_checked(self, project, other_project):
        thread = _thread(_api(_user(project)), project)
        foreign = ShotFactory.create(project=other_project)

        resp = _api(_user(project)).patch(
            f"{_base(project)}{thread['id']}/", {"links": [_link(foreign, "Shot")]}, format="json"
        )

        assert resp.status_code == 403

    def test_links_are_checked_on_edit(self, project, other_project):
        api = _api(_user(project))
        thread = _thread(api, project)
        foreign = ShotFactory.create(project=other_project)

        resp = api.patch(
            f"{_base(project)}{thread['id']}/", {"links": [_link(foreign, "Shot")]}, format="json"
        )

        assert resp.status_code == 400 and resp.json()["links"] == [LINKS_NOT_IN_PROJECT]

    def test_a_reply_takes_only_its_body(self, project, records):
        api = _api(_user(project))
        thread = _thread(api, project)
        reply = api.post(f"{_base(project)}{thread['id']}/replies/", {"body": "one"}).json()
        url = f"{_base(project)}{reply['id']}/"

        ok = api.patch(url, {"body": "one, edited"}, format="json")
        refused = api.patch(url, {"links": [_link(records["shot"], "Shot")]}, format="json")
        subject = api.patch(url, {"subject": "x"}, format="json")

        assert ok.status_code == 200 and ok.json()["body"] == "one, edited"
        assert refused.status_code == 400 and subject.status_code == 400
        assert not ProjectNoteLink.objects.filter(note_id=reply["id"]).exists()


class TestStatus:
    """C-RP-13 (Q-RP-11 = A)."""

    def test_addressed_closed_and_reopened(self, project):
        user = _user(project)
        api = _api(user)
        thread = _thread(api, project)
        url = f"{_base(project)}{thread['id']}/status/"

        addressed = api.post(url, {"status": "Addressed"}).json()
        closed = api.post(url, {"status": "Closed"}).json()
        reopened = api.post(url, {"status": "Open"}).json()

        assert addressed["status"] == "Addressed" and addressed["addressed_at"]
        assert addressed["addressed_by"] == thread["author_name"]
        assert closed["addressed_at"] == addressed["addressed_at"]
        assert reopened["addressed_at"] is None and reopened["addressed_by"] == ""

    def test_the_task_assignee_may_change_it(self, project):
        artist = _user(project)
        task = TaskFactory.create(project=project, assignee=artist)
        thread = _thread(_api(_user(project)), project, task_id=str(task.id))
        url = f"{_base(project)}{thread['id']}/status/"

        assert _api(artist).post(url, {"status": "Addressed"}).status_code == 200
        assert _api(_user(project)).post(url, {"status": "Closed"}).status_code == 403
        assert _api(_user(project, SUPERVISOR)).post(url, {"status": "Closed"}).status_code == 200

    def test_a_reply_has_no_status(self, project):
        api = _api(_user(project))
        thread = _thread(api, project)
        reply = api.post(f"{_base(project)}{thread['id']}/replies/", {"body": "x"}).json()

        resp = api.post(f"{_base(project)}{reply['id']}/status/", {"status": "Closed"})

        assert resp.status_code == 400

    def test_an_unknown_status_is_400(self, project):
        api = _api(_user(project))
        thread = _thread(api, project)

        assert (
            api.post(f"{_base(project)}{thread['id']}/status/", {"status": "Lost"}).status_code
            == 400
        )


class TestDelete:
    """C-RP-13 (Q-RP-12 = A)."""

    def test_the_author_deletes_with_their_own_replies(self, project):
        api = _api(_user(project))
        thread = _thread(api, project)
        api.post(f"{_base(project)}{thread['id']}/replies/", {"body": "addendum"})

        assert api.delete(f"{_base(project)}{thread['id']}/").status_code == 204
        assert not ProjectNote.objects.filter(project=project).exists()
        assert ProjectNote.all_objects.filter(project=project, is_deleted=True).count() == 2

    def test_not_after_someone_else_replied(self, project):
        api = _api(_user(project))
        thread = _thread(api, project)
        _api(_user(project)).post(f"{_base(project)}{thread['id']}/replies/", {"body": "no"})

        assert api.delete(f"{_base(project)}{thread['id']}/").status_code == 403
        assert (
            _api(_user(project, SUPERVISOR)).delete(f"{_base(project)}{thread['id']}/").status_code
            == 204
        )

    def test_someone_else_needs_note_delete(self, project):
        thread = _thread(_api(_user(project)), project)
        update_only = _user(project, (*ARTIST, "note.update"))

        assert _api(update_only).delete(f"{_base(project)}{thread['id']}/").status_code == 403

    def test_one_reply_alone(self, project):
        api = _api(_user(project))
        thread = _thread(api, project)
        reply = api.post(f"{_base(project)}{thread['id']}/replies/", {"body": "oops"}).json()

        assert api.delete(f"{_base(project)}{reply['id']}/").status_code == 204
        assert _list(api, project)[0]["reply_count"] == 0


class TestEvents:
    """WP 2.5: after commit, once per write, never for a refused one."""

    def test_after_commit_once_each(self, project, events, django_capture_on_commit_callbacks):
        api = _api(_user(project))

        with django_capture_on_commit_callbacks(execute=False) as pending:
            thread = _thread(api, project)
        assert events == []
        for callback in pending:
            callback()
        with django_capture_on_commit_callbacks(execute=True):
            api.post(f"{_base(project)}{thread['id']}/replies/", {"body": "x"})
            api.post(f"{_base(project)}{thread['id']}/status/", {"status": "Addressed"})
            api.post(f"{_base(project)}{thread['id']}/status/", {"status": "Addressed"})

        kinds = [type(e) for e in events]
        assert kinds == [NoteCreated, NoteReplied, NoteStatusChanged]
        assert events[0].payload["thread_id"] == thread["id"]
        assert events[2].payload["to_status"] == "Addressed"

    def test_none_for_a_refused_write(
        self, project, other_project, events, django_capture_on_commit_callbacks
    ):
        foreign = ShotFactory.create(project=other_project)

        with django_capture_on_commit_callbacks(execute=True):
            _create(_api(_user(project)), project, links=[_link(foreign, "Shot")])

        assert events == []


class TestBackfill:
    """WP 2.6: migration 0006."""

    @staticmethod
    def _run():
        module = importlib.import_module("apps.production.migrations.0006_rp2_backfill_note_links")
        module.backfill(django_apps, None)

    def test_resolvable_notes_get_one_link_and_others_none(self, project, other_project, records):
        archived = AssetFactory.create(project=project, code="RPTWO_AOLD")
        archived.delete()
        foreign = ShotFactory.create(project=other_project)

        def note(entity_type, entity_id):
            return ProjectNote.objects.create(
                project=project,
                subject="old",
                entity_type=entity_type,
                entity_id=entity_id,
                entity_code="TYPED",
            )

        linked = {
            "shot": note("Shot", str(records["shot"].id)),
            "lower": note("version", str(records["version"].id)),
            "archived": note("Asset", str(archived.id)),
        }
        unlinked = [
            note("Shot", str(foreign.id)),
            note("Shot", "not-a-uuid"),
            note("Shot", str(uuid.uuid4())),
            note("Project", str(project.id)),
            note("Task", str(TaskFactory.create(project=project).id)),
        ]

        self._run()
        self._run()

        for key, row in linked.items():
            links = list(ProjectNoteLink.objects.filter(note=row))
            assert len(links) == 1, key
        assert ProjectNoteLink.objects.get(note=linked["lower"]).entity_type == "Version"
        assert not ProjectNoteLink.objects.filter(note__in=unlinked).exists()
        # Nothing else is touched.
        assert set(ProjectNote.objects.values_list("entity_code", flat=True)) == {"TYPED"}

    def test_an_unresolved_note_keeps_its_stored_record_in_the_answer(self, project):
        ProjectNote.objects.create(
            project=project,
            subject="old",
            entity_type="Shot",
            entity_id="SH010",
            entity_code="SH010",
        )
        self._run()

        row = _list(_api(_user(project)), project)[0]

        assert row["links"] == []
        assert (row["entity_type"], row["entity_id"], row["entity_code"]) == (
            "Shot",
            "SH010",
            "SH010",
        )


class TestRoleMatrix:
    """WP 2.5: the grants of Q-RP-11 and Q-RP-12."""

    def test_the_grants(self):
        from apps.core.management.commands import init_platform as ip

        specs = {spec["code"]: spec["permissions"] for spec in ip.ROLE_SPECS}
        for role in ("org-admin", "production-admin", "vfx-supervisor"):
            assert {"note.update", "note.delete"} <= set(specs[role]), role
        assert "note.update" in specs["lead-artist"]
        assert "note.delete" not in specs["lead-artist"]
        assert not {"note.update", "note.delete"} & set(specs["artist"])
        assert specs["platform-admin"] is None
        known = {code for code, _, _ in ip.PERMISSION_SPECS}
        assert {"note.create", "note.update", "note.delete"} <= known


class TestValidatorNarrowing:
    """
    The link check also holds a caller to their narrowing. No notes route lets a narrowed member in
    (they get 404 first), so this is checked on the validator itself.
    """

    def test_a_show_bound_caller_cannot_link_another_show(self, project):
        from rest_framework.exceptions import ValidationError

        from apps.production.validators.project_note import resolve_links

        show_a, show_b = ShowFactory.create(project=project), ShowFactory.create(project=project)
        mine = ShotFactory.create(project=project, show=show_a)
        theirs = ShotFactory.create(project=project, show=show_b)
        request = type("R", (), {"user": _user(project, SUPERVISOR, show=show_a)})()

        assert [
            lk.instance.pk
            for lk in resolve_links([_link(mine, "Shot")], project=project, request=request)
        ] == [mine.pk]
        with pytest.raises(ValidationError):
            resolve_links([_link(theirs, "Shot")], project=project, request=request)
