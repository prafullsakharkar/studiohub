"""The "latest" file of a version is derived, so it cannot go stale (P-11)."""

from __future__ import annotations

import pytest

from apps.publishing.constants.permissions import PublishPermissions as P
from apps.publishing.selectors.files import PublishedFileSelector
from apps.publishing.tests.helpers import (
    client_for,
    member,
    published_version,
    registration,
)

pytestmark = pytest.mark.django_db

FILES = "/api/v1/publishing/files/"


@pytest.fixture
def api(project):
    return client_for(member(project, P.VIEW, P.CREATE, P.DEPRECATE, P.REVOKE))


@pytest.fixture
def version(project):
    return published_version(project)


def _register(api, version, root, path, **over):
    response = api.post(FILES, registration(version, root, path, **over), format="json")
    assert response.status_code == 201, response.content
    return response.json()["id"]


def _latest(api, **params):
    return {r["id"] for r in api.get(FILES, {"latest": "true", **params}).json()["results"]}


def test_the_newest_registered_file_of_each_role_is_the_latest(api, version, root):
    old = _register(api, version, root, "s/v1.exr")
    new = _register(api, version, root, "s/v2.exr")
    proxy = _register(api, version, root, "s/proxy.mov", role="proxy")

    assert _latest(api) == {new, proxy}
    assert old not in _latest(api)


def test_without_the_filter_every_file_is_listed(api, version, root):
    ids = {_register(api, version, root, f"s/{i}.exr") for i in range(3)}

    assert {r["id"] for r in api.get(FILES).json()["results"]} == ids


def test_revoking_or_deprecating_the_newest_hands_over_to_the_one_before(api, version, root):
    old = _register(api, version, root, "s/v1.exr")
    new = _register(api, version, root, "s/v2.exr")

    api.post(f"{FILES}{new}/deprecate/", {}, format="json")
    assert _latest(api) == {old}

    api.post(f"{FILES}{new}/restore/", {}, format="json")
    assert _latest(api) == {new}

    api.post(f"{FILES}{new}/revoke/", {"reason": "bad"}, format="json")
    assert _latest(api) == {old}


def test_each_version_has_its_own_latest(api, version, root, project):
    other = published_version(project)
    a = _register(api, version, root, "s/a.exr")
    b = _register(api, other, root, "s/b.exr")

    assert _latest(api) == {a, b}
    assert _latest(api, version_id=str(other.pk)) == {b}


def test_a_version_with_nothing_registered_has_no_latest(api, version, root):
    assert _latest(api) == set()


def test_the_selector_gives_other_apps_the_same_answer(api, version, root):
    _register(api, version, root, "s/v1.exr")
    new = _register(api, version, root, "s/v2.exr")

    latest = PublishedFileSelector.latest_for_versions([version.pk])

    assert {key: snapshot.file_id for key, snapshot in latest.items()} == {
        (version.pk, "main"): __import__("uuid").UUID(new)
    }


def test_the_latest_filter_still_respects_project_scoping(api, version, root):
    from apps.production.tests.factories import ProjectFactory

    _register(api, version, root, "s/v1.exr")
    stranger_project = ProjectFactory.create(code="STRANGEPJ")
    stranger = client_for(member(stranger_project, P.VIEW))

    assert _latest(stranger) == set()
