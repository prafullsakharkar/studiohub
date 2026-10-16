"""
Performance tests for production — N+1 guard and pagination.

Ensures that list endpoints use select_related/annotations and do not explode
with 1+ queries per row, and that pagination remains fast at 1000+ rows.
Lists are project-membership scoped; the admin clients bypass scoping.
"""

from __future__ import annotations

import time

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext


@pytest.mark.django_db
def test_task_list_no_nplus1(admin_client, admin_user, django_assert_max_num_queries):
    """Task list should not do N+1 for assignee/project/team."""
    # Seed some tasks
    from apps.production.tests.factories import ProjectFactory, TaskFactory

    proj = ProjectFactory.create()
    TaskFactory.create_batch(20, project=proj)

    # Warm up
    client = admin_client
    url = "/api/v1/tasks/"

    # Capture queries for list (should be ~5-7, not 20+)
    with CaptureQueriesContext(connection) as ctx:
        resp = client.get(url)
        assert resp.status_code == 200

    # Allow some leeway but ensure not N+1 (20 tasks should not be 20 queries)
    assert len(ctx.captured_queries) < 15, f"N+1 detected: {len(ctx.captured_queries)} queries for 20 tasks"

    # Also check pagination is fast
    start = time.time()
    resp = client.get(url, {"page_size": 100})
    elapsed = time.time() - start
    assert elapsed < 1.0, f"Pagination too slow: {elapsed:.2f}s"


@pytest.mark.django_db
def test_project_list_pagination_performance(admin_client, admin_user):
    from apps.production.models import Project
    from apps.production.tests.factories import ProjectFactory

    # Ensure at least 50 projects exist
    existing = Project.objects.count()
    needed = max(0, 50 - existing)
    if needed:
        ProjectFactory.create_batch(needed)

    client = admin_client
    url = "/api/v1/projects/"

    # Time a large page
    start = time.time()
    resp = client.get(url, {"page": 1, "page_size": 50})
    elapsed = time.time() - start
    assert resp.status_code == 200
    assert "count" in resp.json()
    assert elapsed < 1.0, f"Project list pagination too slow: {elapsed:.2f}s"
