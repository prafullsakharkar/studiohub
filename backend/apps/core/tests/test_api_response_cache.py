"""API response cache keys are platform-global (org-removal B6)."""

import pytest
from django.test import RequestFactory

from apps.core.cache.api_response import APIResponseCache


def _request(path="/api/v1/departments/", org_id=None):
    factory = RequestFactory()
    extra = {}
    if org_id is not None:
        extra["HTTP_X_ORGANIZATION_ID"] = org_id
    return factory.get(path, **extra)


@pytest.mark.django_db
def test_cache_keys_ignore_organization_header():
    """The org header no longer partitions cache keys: keys are platform-global."""
    cache = APIResponseCache()

    key_a = cache.generate_cache_key(_request(org_id="org-a"))
    key_b = cache.generate_cache_key(_request(org_id="org-b"))
    key_none = cache.generate_cache_key(_request())

    assert key_a == key_b
    assert key_a == key_none
    assert key_b == key_none


@pytest.mark.django_db
def test_cache_keys_stable_for_same_request():
    cache = APIResponseCache()

    assert cache.generate_cache_key(
        _request(org_id="org-a")
    ) == cache.generate_cache_key(_request(org_id="org-a"))


@pytest.mark.django_db
def test_cache_keys_vary_by_path_and_query():
    cache = APIResponseCache()

    base = cache.generate_cache_key(_request())
    other = cache.generate_cache_key(_request(path="/api/v1/teams/"))
    searched = cache.generate_cache_key(_request(path="/api/v1/teams/", org_id=None))

    assert base != other
    assert cache.generate_cache_key(
        _request(path="/api/v1/teams/")
    ) == searched
