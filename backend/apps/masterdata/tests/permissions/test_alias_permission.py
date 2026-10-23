"""The legacy configure grant is an alias for the manage codes only (D9)."""

from __future__ import annotations

import pytest
from rest_framework.test import APIRequestFactory

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.masterdata.constants.permissions import (
    MasterdataPermissions,
    PlatformMasterDataPermissions,
)
from apps.masterdata.permissions import AliasAwareHasPermission

pytestmark = pytest.mark.django_db


class _View:
    action = "test"

    def __init__(self, required):
        self._required = required

    def get_permission_required(self):
        return self._required


def _request(user):
    request = APIRequestFactory().post("/x")
    request.user = user
    return request


def _allowed(user, required) -> bool:
    return AliasAwareHasPermission().has_permission(_request(user), _View(required))


def test_new_code_is_enough():
    user = UserFactory.create()
    grant_permissions(user, MasterdataPermissions.CATALOG_MANAGE)
    assert _allowed(user, (MasterdataPermissions.CATALOG_MANAGE,))


def test_legacy_code_satisfies_the_manage_codes():
    user = UserFactory.create()
    grant_permissions(user, PlatformMasterDataPermissions.CONFIGURE)
    assert _allowed(user, (MasterdataPermissions.CATALOG_MANAGE,))
    assert _allowed(user, (MasterdataPermissions.DIRECTORY_MANAGE,))


def test_legacy_code_never_satisfies_hard_delete():
    user = UserFactory.create()
    grant_permissions(user, PlatformMasterDataPermissions.CONFIGURE)
    assert not _allowed(user, (MasterdataPermissions.HARD_DELETE,))
    assert not _allowed(
        user, (MasterdataPermissions.CATALOG_MANAGE, MasterdataPermissions.HARD_DELETE)
    )


def test_hard_delete_alone_does_not_satisfy_manage():
    user = UserFactory.create()
    grant_permissions(user, MasterdataPermissions.HARD_DELETE)
    assert not _allowed(
        user, (MasterdataPermissions.CATALOG_MANAGE, MasterdataPermissions.HARD_DELETE)
    )


def test_no_grant_is_denied():
    assert not _allowed(UserFactory.create(), (MasterdataPermissions.CATALOG_MANAGE,))


def test_an_action_without_a_map_entry_is_denied():
    user = UserFactory.create()
    grant_permissions(user, PlatformMasterDataPermissions.CONFIGURE)
    assert not _allowed(user, None)


def test_open_actions_stay_open():
    assert _allowed(UserFactory.create(), ())
