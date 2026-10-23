"""
OAuth is out of scope (decision A7, WP 7.7/7.8): models, admin and choices are
gone, and the drop migration refuses to discard rows.
"""

from __future__ import annotations

from importlib import import_module
from types import SimpleNamespace

import pytest
from django.apps import apps as django_apps
from django.contrib import admin

migration = import_module("apps.identity.migrations.0021_drop_oauth")


@pytest.mark.parametrize("name", ["OAuthAccount", "OAuthProvider"])
def test_the_models_no_longer_exist(name):
    with pytest.raises(LookupError):
        django_apps.get_model("identity", name)


def test_no_oauth_admin_or_choices_remain():
    assert not [m for m in admin.site._registry if "oauth" in m.__name__.lower()]

    from apps.identity import choices

    assert not hasattr(choices, "OAuthProviderName")


def _apps_with_rows(**rows):
    class _Manager:
        def __init__(self, has_rows):
            self._has_rows = has_rows

        def exists(self):
            return self._has_rows

    def get_model(_app, name):
        return SimpleNamespace(objects=_Manager(rows.get(name, False)))

    return SimpleNamespace(get_model=get_model)


@pytest.mark.parametrize("name", ["OAuthAccount", "OAuthProvider"])
def test_the_drop_refuses_when_a_table_has_rows(name):
    with pytest.raises(RuntimeError, match=name):
        migration.refuse_if_oauth_rows_exist(_apps_with_rows(**{name: True}), None)


def test_the_drop_proceeds_when_both_tables_are_empty():
    migration.refuse_if_oauth_rows_exist(_apps_with_rows(), None)
