"""
Review pipeline RP-4: publishing depth (docs/review-pipeline/PLAN.md, CONTRACTS C-RP-16 to C-RP-18).

WP 4.1 dependencies between files, written once with the downstream (Q-RP-19 = A), same project
only (Q-RP-20 = A). WP 4.2 the loader (`latest`, `approved`, `hero`, Q-RP-21 = B). WP 4.3 path
templates, studio and per project (Q-RP-23 = A), refusing only when `enforce` is on (Q-RP-22 = B).
"""

from __future__ import annotations

import itertools

import pytest
from django.db import IntegrityError, transaction

from apps.audit.models import AuditLog
from apps.identity.tests.factories import UserFactory
from apps.masterdata.models import MasterFileType
from apps.production.models import ProjectMembership, Version
from apps.production.tests.factories import (
    AssetFactory,
    ProjectFactory,
    ShotFactory,
    ShowFactory,
    TaskFactory,
    VersionFactory,
)
from apps.publishing.constants.permissions import PublishPermissions as P
from apps.publishing.domain import templates as tpl
from apps.publishing.models import PublishedFile, PublishedFileDependency, PublishPathTemplate
from apps.publishing.tests.helpers import (
    OTHER_SHA,
    client_for,
    member,
    outsider,
    published_version,
    registration,
    storage_root,
)

pytestmark = pytest.mark.django_db

FILES = "/api/v1/publishing/files/"
BULK = f"{FILES}bulk-register/"
LOADER = f"{FILES}loader/"
RESOLVE = f"{FILES}resolve-path/"
TEMPLATES = "/api/v1/publishing/path-templates/"

_n = itertools.count(1)


@pytest.fixture
def api(project):
    return client_for(member(project, P.VIEW, P.CREATE, P.DEPRECATE, P.REVOKE))


@pytest.fixture
def exr(db):
    return MasterFileType.objects.create(code="RPEXR", name="OpenEXR", extension="exr")


@pytest.fixture
def abc(db):
    return MasterFileType.objects.create(code="RPABC", name="Alembic", extension=".abc")


def _register(api, version, root, path=None, **over):
    path = path or f"rp4/{next(_n)}.exr"
    response = api.post(FILES, registration(version, root, path, **over), format="json")
    assert response.status_code == 201, response.content
    return response.json()


def _path():
    return f"rp4/{next(_n)}.exr"


# --------------------------------------------------------------------------------------------
# WP 4.1 dependencies (C-RP-16)
# --------------------------------------------------------------------------------------------


class TestDependencies:
    def test_registered_with_upstreams_and_read_both_ways(self, api, project, root):
        version = published_version(project)
        up_a, up_b = _register(api, version, root), _register(api, version, root)

        down = _register(api, version, root, upstream_ids=[up_a["id"], up_b["id"]])

        assert down["upstream_count"] == 2 and down["downstream_count"] == 0
        links = api.get(f"{FILES}{down['id']}/dependencies/").json()
        assert {row["id"] for row in links["upstream"]} == {up_a["id"], up_b["id"]}
        assert links["downstream"] == []
        row = links["upstream"][0]
        assert set(row) == {
            "id", "storage_root", "relative_path", "role", "file_type", "status", "version_id",
            "version_code",
        }  # fmt: skip
        assert row["version_code"] == version.code
        back = api.get(f"{FILES}{up_a['id']}/dependencies/").json()
        assert [r["id"] for r in back["downstream"]] == [down["id"]] and back["upstream"] == []
        assert api.get(f"{FILES}{up_a['id']}/").json()["downstream_count"] == 1
        listed = {r["id"]: r for r in api.get(FILES).json()["results"]}
        assert listed[down["id"]]["upstream_count"] == 2
        assert listed[up_b["id"]]["downstream_count"] == 1

    def test_the_actor_is_recorded_on_each_link(self, api, project, root):
        version = published_version(project)
        up = _register(api, version, root)
        down = _register(api, version, root, upstream_ids=[up["id"]])

        link = PublishedFileDependency.objects.get(downstream_id=down["id"])
        assert link.upstream_id == PublishedFile.objects.get(pk=up["id"]).pk  # pyright: ignore[reportAttributeAccessIssue]
        assert link.created_by_id is not None  # pyright: ignore[reportAttributeAccessIssue]

    def test_bulk_registration_takes_upstreams_per_item(self, api, project, root):
        version = published_version(project)
        up = _register(api, version, root)
        items = [registration(version, root, _path(), upstream_ids=[up["id"]]) for _ in range(2)]

        response = api.post(BULK, {"items": items}, format="json")

        assert response.status_code == 200, response.content
        assert PublishedFileDependency.objects.filter(upstream_id=up["id"]).count() == 2

    def test_an_unknown_upstream_is_refused_and_nothing_is_registered(self, api, project, root):
        version = published_version(project)
        before = PublishedFile.objects.count()
        missing = "00000000-0000-4000-8000-000000000001"

        response = api.post(
            FILES, registration(version, root, _path(), upstream_ids=[missing]), format="json"
        )

        assert response.status_code == 400
        assert response.json()["upstream_ids"] == [f"Unknown upstream file: {missing}"]
        assert PublishedFile.objects.count() == before
        assert PublishedFileDependency.objects.count() == 0

    def test_another_projects_file_is_refused_like_an_unknown_one(self, api, project, root):
        other = ProjectFactory.create(code="RPOTH")
        theirs = _register(
            client_for(member(other, P.VIEW, P.CREATE)), published_version(other), root
        )

        response = api.post(
            FILES,
            registration(published_version(project), root, _path(), upstream_ids=[theirs["id"]]),
            format="json",
        )

        assert response.status_code == 400
        assert response.json()["upstream_ids"] == [f"Unknown upstream file: {theirs['id']}"]

    def test_a_revoked_upstream_is_refused(self, api, project, root):
        version = published_version(project)
        up = _register(api, version, root)
        api.post(f"{FILES}{up['id']}/revoke/", {"reason": "bad plate"}, format="json")

        response = api.post(
            FILES, registration(version, root, _path(), upstream_ids=[up["id"]]), format="json"
        )

        assert response.status_code == 400
        assert response.json()["upstream_ids"] == [f"The upstream file is revoked: {up['id']}"]

    def test_a_deprecated_upstream_is_accepted(self, api, project, root):
        version = published_version(project)
        up = _register(api, version, root)
        api.post(f"{FILES}{up['id']}/deprecate/", {}, format="json")

        down = _register(api, version, root, upstream_ids=[up["id"]])

        assert down["upstream_count"] == 1

    def test_a_member_who_cannot_read_files_cannot_name_them(self, project, root):
        """A show-bound member may register, but reads no file, so no file can be their upstream."""
        api = client_for(member(project, P.VIEW, P.CREATE, P.DEPRECATE, P.REVOKE))
        version = published_version(project)
        up = _register(api, version, root)
        bound = UserFactory.create()
        from apps.identity.tests.rbac_helpers import grant_permissions

        grant_permissions(bound, P.VIEW, P.CREATE)
        ProjectMembership.objects.create(
            user=bound, project=project, status="active", role="Artist",
            show=ShowFactory.create(project=project),
        )  # fmt: skip

        response = client_for(bound).post(
            FILES, registration(version, root, _path(), upstream_ids=[up["id"]]), format="json"
        )

        assert response.status_code == 400
        assert response.json()["upstream_ids"] == [f"Unknown upstream file: {up['id']}"]

    @pytest.mark.parametrize(
        ("value", "message"),
        [
            ("not-a-list", 'Expected a list of items but got type "str".'),
            (["nope"], "Must be a valid UUID."),
        ],
    )
    def test_a_malformed_list_is_a_400(self, api, project, root, value, message):
        response = api.post(
            FILES,
            registration(published_version(project), root, _path(), upstream_ids=value),
            format="json",
        )

        assert response.status_code == 400
        assert message in str(response.json()["upstream_ids"])

    def test_a_file_listed_twice_is_refused(self, api, project, root):
        version = published_version(project)
        up = _register(api, version, root)

        response = api.post(
            FILES,
            registration(version, root, _path(), upstream_ids=[up["id"], up["id"]]),
            format="json",
        )

        assert response.status_code == 400
        assert response.json()["upstream_ids"] == ["A file is listed twice."]

    def test_at_most_fifty_upstreams(self, api, project, root):
        ids = [f"00000000-0000-4000-8000-{i:012d}" for i in range(51)]

        single = api.post(
            FILES,
            registration(published_version(project), root, _path(), upstream_ids=ids),
            format="json",
        )
        bulk = api.post(
            BULK,
            {"items": [registration(published_version(project), root, _path(), upstream_ids=ids)]},
            format="json",
        )

        assert single.status_code == 400 and "upstream_ids" in single.json()
        assert bulk.json()["results"][0]["fields"]["upstream_ids"] == ["At most 50 upstream files."]

    def test_a_bulk_item_with_a_bad_upstream_fails_alone(self, api, project, root):
        version = published_version(project)
        missing = "00000000-0000-4000-8000-000000000002"
        items = [
            registration(version, root, _path()),
            registration(version, root, _path(), upstream_ids=[missing]),
        ]

        body = api.post(BULK, {"items": items}, format="json").json()

        assert [r["ok"] for r in body["results"]] == [True, False]
        assert body["results"][1]["error"] == "invalid"
        assert body["results"][1]["fields"]["upstream_ids"] == [f"Unknown upstream file: {missing}"]

    def test_a_retry_must_name_the_same_upstreams(self, api, project, root):
        version = published_version(project)
        up_a, up_b = _register(api, version, root), _register(api, version, root)
        path = _path()
        first = _register(api, version, root, path, upstream_ids=[up_a["id"]])

        same = api.post(
            FILES, registration(version, root, path, upstream_ids=[up_a["id"]]), format="json"
        )
        other = api.post(
            FILES, registration(version, root, path, upstream_ids=[up_b["id"]]), format="json"
        )
        none = api.post(FILES, registration(version, root, path), format="json")

        assert same.status_code == 200 and same.json()["id"] == first["id"]
        assert other.status_code == 409
        assert none.status_code == 409
        assert PublishedFileDependency.objects.filter(downstream_id=first["id"]).count() == 1

    def test_a_retry_without_upstreams_of_a_file_registered_without_them_is_the_same(
        self, api, project, root
    ):
        version = published_version(project)
        path = _path()
        first = _register(api, version, root, path)

        again = api.post(FILES, registration(version, root, path), format="json")

        assert again.status_code == 200 and again.json()["id"] == first["id"]

    def test_the_table_is_append_only(self, api, project, root):
        version = published_version(project)
        up = _register(api, version, root)
        _register(api, version, root, upstream_ids=[up["id"]])
        link = PublishedFileDependency.objects.get()

        with pytest.raises(TypeError):
            link.save()
        with pytest.raises(TypeError):
            link.delete()
        with pytest.raises(TypeError):
            PublishedFileDependency.objects.update(created_by=None)
        with pytest.raises(TypeError):
            PublishedFileDependency.objects.all().delete()

    def test_a_file_never_depends_on_itself(self, api, project, root):
        file = PublishedFile.objects.get(pk=_register(api, published_version(project), root)["id"])

        with pytest.raises(IntegrityError), transaction.atomic():
            PublishedFileDependency.objects.create(downstream=file, upstream=file)

    def test_the_read_is_narrowed_like_the_file(self, api, project, root):
        version = published_version(project)
        up = _register(api, version, root)
        down = _register(api, version, root, upstream_ids=[up["id"]])

        stranger = client_for(outsider(P.VIEW)).get(f"{FILES}{down['id']}/dependencies/")
        no_code = client_for(member(project)).get(f"{FILES}{down['id']}/dependencies/")

        assert stranger.status_code == 404
        assert no_code.status_code == 403

    def test_revoking_an_upstream_later_shows_on_the_downstream_read(self, api, project, root):
        version = published_version(project)
        up = _register(api, version, root)
        down = _register(api, version, root, upstream_ids=[up["id"]])

        api.post(f"{FILES}{up['id']}/revoke/", {"reason": "bad plate"}, format="json")

        links = api.get(f"{FILES}{down['id']}/dependencies/").json()
        assert links["upstream"][0]["status"] == "Revoked"
        assert api.get(f"{FILES}{down['id']}/").json()["status"] == "Registered"


# --------------------------------------------------------------------------------------------
# WP 4.2 loader (C-RP-17)
# --------------------------------------------------------------------------------------------


def _version(project, *, index, shot=None, asset=None, task=None, **fields):
    fields.setdefault("status", "Approved")
    fields.setdefault("is_published", True)
    return VersionFactory.create(
        project=project,
        code=f"RP4V{next(_n):04d}",
        shot=shot,
        asset=asset,
        task=task,
        version_index=index,
        **fields,
    )


def _ids(response):
    assert response.status_code == 200, response.content
    return [row["id"] for row in response.json()]


class TestLoader:
    @pytest.fixture
    def shot(self, project):
        return ShotFactory.create(project=project, code="RP4_SH010", sequence_code="RP4_SQ01")

    @pytest.fixture
    def comp(self, project, shot):
        return TaskFactory.create(project=project, shot=shot, code="RP4_COMP")

    def test_latest_is_the_newest_version_of_the_stream_by_index(
        self, api, project, root, shot, comp, exr
    ):
        # The higher index is made and published first: the loader must not go by date.
        v2 = _version(project, index=2, shot=shot, task=comp)
        newer_file_of_v2 = _register(api, v2, root, file_type="RPEXR")
        v1 = _version(project, index=1, shot=shot, task=comp)
        _register(api, v1, root, file_type="RPEXR")

        assert _ids(api.get(LOADER, {"shot": str(shot.pk)})) == [newer_file_of_v2["id"]]

    def test_the_newest_registered_file_of_the_version_wins(
        self, api, project, root, shot, comp, exr
    ):
        v1 = _version(project, index=1, shot=shot, task=comp)
        _register(api, v1, root, file_type="RPEXR")
        newest = _register(api, v1, root, file_type="RPEXR")

        assert _ids(api.get(LOADER, {"task": str(comp.pk)})) == [newest["id"]]

    def test_a_version_without_the_file_type_is_skipped(
        self, api, project, root, shot, comp, exr, abc
    ):
        v1 = _version(project, index=1, shot=shot, task=comp)
        plate = _register(api, v1, root, file_type="RPEXR")
        v2 = _version(project, index=2, shot=shot, task=comp)
        cache = _register(api, v2, root, file_type="RPABC")

        assert _ids(api.get(LOADER, {"shot": str(shot.pk), "file_type": "rpexr"})) == [plate["id"]]
        # Without the filter each file type is its own row.
        assert set(_ids(api.get(LOADER, {"shot": str(shot.pk)}))) == {plate["id"], cache["id"]}

    def test_deprecated_and_revoked_files_are_skipped(self, api, project, root, shot, comp, exr):
        v1 = _version(project, index=1, shot=shot, task=comp)
        old = _register(api, v1, root, file_type="RPEXR")
        v2 = _version(project, index=2, shot=shot, task=comp)
        new = _register(api, v2, root, file_type="RPEXR")

        api.post(f"{FILES}{new['id']}/deprecate/", {}, format="json")
        assert _ids(api.get(LOADER, {"shot": str(shot.pk)})) == [old["id"]]
        api.post(f"{FILES}{old['id']}/revoke/", {"reason": "bad"}, format="json")
        assert _ids(api.get(LOADER, {"shot": str(shot.pk)})) == []

    def test_unpublished_and_deleted_versions_are_skipped(
        self, api, project, root, shot, comp, exr
    ):
        v1 = _version(project, index=1, shot=shot, task=comp)
        old = _register(api, v1, root, file_type="RPEXR")
        v2 = _version(project, index=2, shot=shot, task=comp)
        _register(api, v2, root, file_type="RPEXR")
        v3 = _version(project, index=3, shot=shot, task=comp)
        _register(api, v3, root, file_type="RPEXR")

        Version.all_objects.filter(pk=v3.pk).update(is_published=False)
        Version.all_objects.filter(pk=v2.pk).update(is_deleted=True)

        assert _ids(api.get(LOADER, {"shot": str(shot.pk)})) == [old["id"]]

    def test_approved_takes_only_approved_versions(self, api, project, root, shot, comp, exr):
        v1 = _version(project, index=1, shot=shot, task=comp, status="Approved")
        approved = _register(api, v1, root, file_type="RPEXR")
        v2 = _version(project, index=2, shot=shot, task=comp, status="Pending Review")
        latest = _register(api, v2, root, file_type="RPEXR")

        assert _ids(api.get(LOADER, {"shot": str(shot.pk)})) == [latest["id"]]
        assert _ids(api.get(LOADER, {"shot": str(shot.pk), "which": "approved"})) == [
            approved["id"]
        ]

    def test_hero_takes_only_the_hero_version(self, api, project, root, shot, comp, exr):
        v1 = _version(project, index=1, shot=shot, task=comp, is_hero=True)
        hero = _register(api, v1, root, file_type="RPEXR")
        v2 = _version(project, index=2, shot=shot, task=comp)
        _register(api, v2, root, file_type="RPEXR")

        body = api.get(LOADER, {"shot": str(shot.pk), "which": "hero"})

        assert _ids(body) == [hero["id"]]
        assert body.json()[0]["version"]["is_hero"] is True

    def test_each_stream_is_its_own_row(self, api, project, root, shot, comp, exr):
        light = TaskFactory.create(project=project, shot=shot, code="RP4_LIGHT")
        a = _register(
            api, _version(project, index=1, shot=shot, task=comp), root, file_type="RPEXR"
        )
        b = _register(
            api, _version(project, index=1, shot=shot, task=light), root, file_type="RPEXR"
        )
        c = _register(api, _version(project, index=1, shot=shot), root, file_type="RPEXR")

        rows = api.get(LOADER, {"shot": str(shot.pk)}).json()

        assert [row["id"] for row in rows] == [
            c["id"],
            a["id"],
            b["id"],
        ]  # task-less first, then by code
        assert rows[0]["task"] is None
        assert rows[1]["task"] == {"id": str(comp.pk), "code": "RP4_COMP"}

    def test_the_row_shape(self, api, project, root, shot, comp, exr):
        version = _version(project, index=4, shot=shot, task=comp)
        _register(api, version, root, file_type="RPEXR")

        row = api.get(LOADER, {"shot": str(shot.pk)}).json()[0]

        assert row["version"] == {
            "id": str(version.pk),
            "code": version.code,
            "version_index": 4,
            "status": "Approved",
            "is_hero": False,
        }
        assert {"relative_path", "storage_root", "sha256", "upstream_count"} <= set(row)

    def test_role_picks_another_role(self, api, project, root, shot, comp, exr):
        version = _version(project, index=1, shot=shot, task=comp)
        _register(api, version, root, file_type="RPEXR")
        proxy = _register(api, version, root, "rp4/proxy.mov", role="proxy")

        assert _ids(api.get(LOADER, {"shot": str(shot.pk), "role": "proxy"})) == [proxy["id"]]

    def test_an_asset_and_its_versions(self, api, project, root, exr):
        asset = AssetFactory.create(project=project, code="RP4_PROP")
        model = _register(api, _version(project, index=1, asset=asset), root, file_type="RPEXR")

        assert _ids(api.get(LOADER, {"asset": str(asset.pk)})) == [model["id"]]

    @pytest.mark.parametrize(
        "params",
        [
            {},
            {
                "shot": "00000000-0000-4000-8000-000000000003",
                "task": "00000000-0000-4000-8000-000000000004",
            },
            {"shot": "not-an-id"},
            {"shot": "00000000-0000-4000-8000-000000000003", "which": "best"},
            {"shot": "00000000-0000-4000-8000-000000000003", "role": "poster"},
        ],
    )
    def test_bad_queries_are_a_400(self, api, params):
        assert api.get(LOADER, params).status_code == 400

    def test_an_unknown_or_unreachable_entity_is_a_404(self, api, project, shot):
        unknown = api.get(LOADER, {"shot": "00000000-0000-4000-8000-000000000005"})
        stranger = client_for(outsider(P.VIEW)).get(LOADER, {"shot": str(shot.pk)})
        bound_user = member(project, P.VIEW)
        ProjectMembership.objects.filter(user=bound_user).update(
            show=ShowFactory.create(project=project)
        )
        bound = client_for(bound_user).get(LOADER, {"shot": str(shot.pk)})

        assert (unknown.status_code, stranger.status_code, bound.status_code) == (404, 404, 404)
        assert unknown.json().keys() == stranger.json().keys()

    def test_the_query_count_does_not_grow_with_streams(
        self, api, project, root, shot, exr, django_assert_max_num_queries
    ):
        for code in ("RP4_T1", "RP4_T2", "RP4_T3", "RP4_T4"):
            task = TaskFactory.create(project=project, shot=shot, code=code)
            for index in (1, 2):
                _register(
                    api,
                    _version(project, index=index, shot=shot, task=task),
                    root,
                    file_type="RPEXR",
                )

        with django_assert_max_num_queries(12):
            assert len(api.get(LOADER, {"shot": str(shot.pk)}).json()) == 4


# --------------------------------------------------------------------------------------------
# WP 4.3 path templates (C-RP-18)
# --------------------------------------------------------------------------------------------

VALUES = {
    "project": "PRJ", "episode": "EP01", "sequence": "SQ010", "shot": "SH0010", "asset": None,
    "asset_type": None, "task": "COMP", "department": "Comp", "version": 7, "ext": "exr",
}  # fmt: skip


class TestTemplateLanguage:
    def test_each_token_renders(self):
        pattern = (
            "{project}/{episode}/{sequence}/{shot}/{task}/{department}/v{version}/{name}.{ext}"
        )

        assert tpl.render(pattern, VALUES) == "PRJ/EP01/SQ010/SH0010/COMP/Comp/v7/{name}.exr"

    def test_widths(self):
        assert tpl.render("v{version:03}/f.{frame}.exr", VALUES) == "v007/f.%04d.exr"
        assert tpl.render("f.{frame:6}.exr", VALUES) == "f.%06d.exr"

    def test_asset_tokens(self):
        values = {**VALUES, "asset": "PROP", "asset_type": "Prop"}

        assert tpl.render("{asset_type}/{asset}/{name}.{ext}", values) == "Prop/PROP/{name}.exr"

    def test_a_token_without_a_value_names_it(self):
        with pytest.raises(tpl.TemplateError, match=r"\{asset\}"):
            tpl.render("{asset}/{name}.exr", VALUES)

    @pytest.mark.parametrize(
        ("pattern", "message"),
        [
            ("{shoot}/a.exr", "Unknown token {shoot}."),
            ("{shot:3}/a.exr", "{shot} takes no width."),
            ("v{version:0}/a.exr", "A width is between 1 and 10."),
            ("{shot/a.exr", "Braces are only used around a token"),
            ("", "A pattern is required."),
        ],
    )
    def test_malformed_patterns(self, pattern, message):
        with pytest.raises(
            tpl.TemplateError, match=message.replace("{", r"\{").replace("}", r"\}")
        ):
            tpl.tokens(pattern)

    @pytest.mark.parametrize(
        "pattern", ["/{shot}/a.exr", "{shot}/../a.exr", "{shot}/", "a\\{shot}"]
    )
    def test_a_pattern_must_make_a_valid_path(self, pattern):
        with pytest.raises(tpl.TemplateError):
            tpl.check_pattern(pattern)

    def test_name_matches_one_run_of_safe_characters(self):
        rendered = tpl.render("{shot}/{name}.{ext}", VALUES)

        assert tpl.matches(rendered, "SH0010/plate_v2-a.exr")
        assert not tpl.matches(rendered, "SH0010/sub/plate.exr")
        assert not tpl.matches(rendered, "SH0010/.exr")
        assert not tpl.matches(rendered, "SH0011/plate.exr")

    def test_literal_text_is_not_a_regex(self):
        rendered = tpl.render("{shot}/a.b/{name}.exr", VALUES)

        assert tpl.matches(rendered, "SH0010/a.b/x.exr")
        assert not tpl.matches(rendered, "SH0010/aXb/x.exr")


@pytest.fixture
def manager(project):
    return client_for(member(project, P.VIEW, P.CREATE, P.TEMPLATE_MANAGE))


def _template(client, **body):
    body.setdefault("file_type", "RPEXR")
    body.setdefault("storage_root", "PROJECTS")
    body.setdefault("pattern", "{project}/{sequence}/{shot}/{task}/v{version:03}/{name}.{ext}")
    response = client.post(TEMPLATES, body, format="json")
    assert response.status_code == 201, response.content
    return response.json()


class TestTemplates:
    @pytest.fixture
    def work(self, project):
        shot = ShotFactory.create(project=project, code="RP4_SH020", sequence_code="RP4_SQ02")
        task = TaskFactory.create(project=project, shot=shot, code="RP4_ANIM")
        return _version(project, index=3, shot=shot, task=task)

    def test_a_studio_template_is_created_and_read(self, manager, root, exr):
        made = _template(manager)

        assert made["project_id"] is None and made["enforce"] is False and made["is_active"] is True
        assert made["file_type"] == "RPEXR" and made["storage_root"] == "PROJECTS"
        assert set(made) == {
            "id", "project_id", "file_type", "role", "storage_root", "pattern", "enforce",
            "is_active", "created_at", "updated_at",
        }  # fmt: skip
        assert manager.get(f"{TEMPLATES}{made['id']}/").json()["pattern"] == made["pattern"]
        assert AuditLog.objects.filter(target_id=made["id"]).exists()

    def test_writing_needs_the_code(self, project, root, exr):
        reader = client_for(member(project, P.VIEW, P.CREATE))

        response = reader.post(
            TEMPLATES,
            {"file_type": "RPEXR", "storage_root": "PROJECTS", "pattern": "{shot}/{name}.exr"},
            format="json",
        )

        assert response.status_code == 403
        assert reader.get(TEMPLATES).status_code == 200

    def test_no_put_and_no_delete(self, manager, root, exr):
        made = _template(manager)

        assert manager.put(f"{TEMPLATES}{made['id']}/", {}, format="json").status_code == 405
        assert manager.delete(f"{TEMPLATES}{made['id']}/").status_code == 405

    def test_one_active_template_per_key(self, manager, project, root, exr):
        _template(manager)
        studio_again = manager.post(
            TEMPLATES, {"file_type": "RPEXR", "storage_root": "PROJECTS", "pattern": "a/{name}.exr"},
            format="json",
        )  # fmt: skip
        mine = _template(manager, project=str(project.pk))
        mine_again = manager.post(
            TEMPLATES,
            {
                "project": str(project.pk),
                "file_type": "RPEXR",
                "storage_root": "PROJECTS",
                "pattern": "b/{name}.exr",
            },
            format="json",
        )
        proxy = _template(manager, role="proxy", pattern="{shot}/{name}.mov")

        assert studio_again.status_code == 400 and mine_again.status_code == 400
        assert mine["project_id"] == str(project.pk) and proxy["role"] == "proxy"

    def test_a_retired_template_frees_its_key_and_cannot_come_back_beside_another(
        self, manager, root, exr
    ):
        old = _template(manager)
        assert (
            manager.patch(
                f"{TEMPLATES}{old['id']}/", {"is_active": False}, format="json"
            ).status_code
            == 200
        )
        _template(manager, pattern="new/{name}.exr")

        back = manager.patch(f"{TEMPLATES}{old['id']}/", {"is_active": True}, format="json")

        assert back.status_code == 400

    @pytest.mark.parametrize(
        ("body", "field"),
        [
            ({"pattern": "{shoot}/{name}.exr"}, "pattern"),
            ({"pattern": "../{name}.exr"}, "pattern"),
            ({"file_type": "NOPE"}, "file_type"),
            ({"storage_root": "NOPE"}, "storage_root"),
            ({"role": "poster"}, "role"),
            ({"project": "00000000-0000-4000-8000-000000000006"}, "project"),
            ({"colour": "red"}, "colour"),
        ],
    )
    def test_bad_bodies_are_a_field_keyed_400(self, manager, root, exr, body, field):
        full = {
            "file_type": "RPEXR",
            "storage_root": "PROJECTS",
            "pattern": "{shot}/{name}.exr",
            **body,
        }

        response = manager.post(TEMPLATES, full, format="json")

        assert response.status_code == 400 and field in response.json()

    def test_a_template_for_a_project_the_caller_is_not_in_is_refused(self, manager, root, exr):
        other = ProjectFactory.create(code="RPNOT")

        response = manager.post(
            TEMPLATES,
            {
                "project": str(other.pk),
                "file_type": "RPEXR",
                "storage_root": "PROJECTS",
                "pattern": "{shot}/{name}.exr",
            },
            format="json",
        )

        assert response.status_code == 400 and response.json()["project"] == ["Unknown project."]

    def test_the_list_shows_studio_templates_and_the_callers_projects(
        self, manager, project, root, exr, abc
    ):
        studio = _template(manager)
        mine = _template(manager, project=str(project.pk))
        other = ProjectFactory.create(code="RPNOT2")
        hidden = PublishPathTemplate.objects.create(
            project=other, file_type=abc, storage_root=root, pattern="x/{name}.abc"
        )

        listed = {row["id"] for row in manager.get(TEMPLATES).json()["results"]}

        assert {studio["id"], mine["id"]} <= listed and str(hidden.pk) not in listed
        assert manager.get(f"{TEMPLATES}{hidden.pk}/").status_code == 404
        only_studio = manager.get(TEMPLATES, {"project_id": "studio"}).json()["results"]
        assert [row["id"] for row in only_studio] == [studio["id"]]

    def test_the_key_cannot_change(self, manager, project, root, exr):
        made = _template(manager)

        response = manager.patch(
            f"{TEMPLATES}{made['id']}/", {"role": "proxy", "file_type": "RPEXR"}, format="json"
        )

        assert response.status_code == 400 and set(response.json()) >= {"role"}
        assert "file_type" not in response.json()

    def test_a_change_is_audited(self, manager, root, exr):
        made = _template(manager)

        response = manager.patch(f"{TEMPLATES}{made['id']}/", {"enforce": True}, format="json")

        assert response.status_code == 200 and response.json()["enforce"] is True
        assert AuditLog.objects.filter(
            target_id=made["id"], description__contains="enforce"
        ).exists()

    def test_resolve_path_fills_the_template(self, manager, root, exr, work):
        made = _template(manager)

        body = manager.get(RESOLVE, {"version_id": str(work.pk), "file_type": "RPEXR"}).json()

        assert body == {
            "template_id": made["id"],
            "storage_root": "PROJECTS",
            "pattern": made["pattern"],
            "relative_path": "PUBP/RP4_SQ02/RP4_SH020/RP4_ANIM/v003/{name}.exr",
            "enforce": False,
        }

    def test_the_projects_template_wins_over_the_studios(self, manager, project, root, exr, work):
        _template(manager)
        _template(manager, project=str(project.pk), pattern="show/{shot}/{name}.{ext}")
        retired = _template(manager, role="proxy", project=str(project.pk), pattern="p/{name}.mov")
        manager.patch(f"{TEMPLATES}{retired['id']}/", {"is_active": False}, format="json")
        studio_proxy = _template(manager, role="proxy", pattern="studio/{name}.mov")

        main = manager.get(RESOLVE, {"version_id": str(work.pk), "file_type": "RPEXR"}).json()
        proxy = manager.get(
            RESOLVE, {"version_id": str(work.pk), "file_type": "RPEXR", "role": "proxy"}
        ).json()

        assert main["relative_path"] == "show/RP4_SH020/{name}.exr"
        assert proxy["template_id"] == studio_proxy["id"]

    def test_resolve_path_answers(self, manager, project, root, exr, abc, work):
        _template(manager, pattern="{asset}/{name}.exr")

        none = manager.get(RESOLVE, {"version_id": str(work.pk), "file_type": "RPABC"})
        unfillable = manager.get(RESOLVE, {"version_id": str(work.pk), "file_type": "RPEXR"})
        unknown = manager.get(
            RESOLVE, {"version_id": "00000000-0000-4000-8000-000000000007", "file_type": "RPEXR"}
        )
        stranger = client_for(outsider(P.VIEW)).get(
            RESOLVE, {"version_id": str(work.pk), "file_type": "RPEXR"}
        )

        assert none.status_code == 404
        assert unfillable.status_code == 400 and "{asset}" in unfillable.json()["version_id"][0]
        assert unknown.status_code == 400 and stranger.status_code == 400

    def test_without_enforce_any_path_is_registered(self, manager, root, exr, work):
        _template(manager)

        response = manager.post(
            FILES, registration(work, root, "anywhere/x.exr", file_type="RPEXR"), format="json"
        )

        assert response.status_code == 201

    def test_with_enforce_a_mismatch_is_refused_and_a_match_registered(
        self, manager, root, exr, work
    ):
        _template(manager, enforce=True)
        expected = "PUBP/RP4_SQ02/RP4_SH020/RP4_ANIM/v003/plate.exr"

        wrong = manager.post(
            FILES, registration(work, root, "anywhere/x.exr", file_type="RPEXR"), format="json"
        )
        right = manager.post(
            FILES, registration(work, root, expected, file_type="RPEXR"), format="json"
        )

        assert wrong.status_code == 400
        assert wrong.json()["relative_path"] == [
            "Does not match the path template: PUBP/RP4_SQ02/RP4_SH020/RP4_ANIM/v003/{name}.exr"
        ]
        assert right.status_code == 201

    def test_with_enforce_the_root_must_be_the_templates(self, manager, root, exr, work):
        _template(manager, enforce=True)
        other_root = storage_root("RENDERS")

        response = manager.post(
            FILES,
            registration(
                work, other_root, "PUBP/RP4_SQ02/RP4_SH020/RP4_ANIM/v003/p.exr", file_type="RPEXR"
            ),
            format="json",
        )

        assert response.status_code == 400
        assert response.json()["storage_root"] == [
            "The path template puts this file under PROJECTS."
        ]

    def test_enforce_applies_to_bulk_items_and_only_to_its_type_and_role(
        self, manager, root, exr, abc, work
    ):
        _template(manager, enforce=True)
        items = [
            registration(work, root, "anywhere/a.exr", file_type="RPEXR"),
            registration(work, root, "anywhere/b.abc", file_type="RPABC"),
            registration(work, root, "anywhere/c.mov", file_type="RPEXR", role="proxy"),
            registration(work, root, "anywhere/d.exr"),
        ]

        results = manager.post(BULK, {"items": items}, format="json").json()["results"]

        assert [r["ok"] for r in results] == [False, True, True, True]
        assert "relative_path" in results[0]["fields"]

    def test_an_enforcing_template_that_cannot_be_filled_refuses(self, manager, root, exr, work):
        _template(manager, enforce=True, pattern="{asset}/{name}.exr")

        response = manager.post(
            FILES, registration(work, root, "x/y.exr", file_type="RPEXR"), format="json"
        )

        assert response.status_code == 400
        assert "{asset}" in response.json()["relative_path"][0]

    def test_a_retired_enforcing_template_no_longer_refuses(self, manager, root, exr, work):
        made = _template(manager, enforce=True)
        manager.patch(f"{TEMPLATES}{made['id']}/", {"is_active": False}, format="json")

        response = manager.post(
            FILES, registration(work, root, "anywhere/x.exr", file_type="RPEXR"), format="json"
        )

        assert response.status_code == 201

    def test_a_retry_of_a_file_registered_before_the_template_is_still_the_same_file(
        self, manager, root, exr, work
    ):
        """Templates are checked at registration only, never against files already registered."""
        body = registration(work, root, "anywhere/x.exr", file_type="RPEXR", sha256=OTHER_SHA)
        first = manager.post(FILES, body, format="json")
        _template(manager, enforce=True)

        again = manager.post(FILES, body, format="json")

        assert again.status_code == 200 and again.json()["id"] == first.json()["id"]
