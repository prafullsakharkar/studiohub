"""
OAuth is out of scope (decision A7, WP 7.7/7.8): models, admin and choices are gone.
"""

from __future__ import annotations

import pytest
from django.apps import apps as django_apps
from django.contrib import admin


@pytest.mark.parametrize("name", ["OAuthAccount", "OAuthProvider"])
def test_the_models_no_longer_exist(name):
    with pytest.raises(LookupError):
        django_apps.get_model("identity", name)


def test_no_oauth_admin_or_choices_remain():
    assert not [m for m in admin.site._registry if "oauth" in m.__name__.lower()]

    from apps.identity import choices

    assert not hasattr(choices, "OAuthProviderName")
