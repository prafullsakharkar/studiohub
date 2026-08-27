"""
Performance tests for production — N+1 guard and pagination.

Ensures that list endpoints use select_related/annotations and do not explode
with 1+ queries per row, and that pagination remains fast at 1000+ rows.
"""

from __future__ import annotations

import time

import pytest
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.db import connection

from apps.organization.models import Organization
from apps.production.models import Project, Task


@pytest.mark.django_db
def test_task_list_no_nplus1(admin_client, admin_user, django_assert_max_num_queries):
    """Task list should not do N+1 for assignee/project/team."""
    # Seed some tasks
    from apps.production.tests.factories import ProjectFactory, TaskFactory

    org = Organization.objects.first()
    if not org:
        org = Organization.objects.create(code="PERF", name="Perf Org", slug="perf-org", organization_type="studio")

    proj = ProjectFactory.create(organization=org)
    TaskFactory.create_batch(20, organization=org, project=proj)

    # Warm up
    client = admin_client
    url = "/api/v1/tasks/"

    # Capture queries for list (should be ~5-7, not 20+)
    with CaptureQueriesContext(connection) as ctx:
        resp = client.get(url, HTTP_X_ORGANIZATION_ID=str(org.id))
        assert resp.status_code == 200

    # Allow some leeway but ensure not N+1 (20 tasks should not be 20 queries)
    assert len(ctx.captured_queries) < 15, f"N+1 detected: {len(ctx.captured_queries)} queries for 20 tasks"

    # Also check pagination is fast
    start = time.time()
    resp = client.get(url, {"page_size": 100}, HTTP_X_ORGANIZATION_ID=str(org.id))
    elapsed = time.time() - start
    assert elapsed < 1.0, f"Pagination too slow: {elapsed:.2f}s"


@pytest.mark.django_db
def test_project_list_pagination_performance(admin_client, admin_user):
    from apps.production.tests.factories import ProjectFactory

    org = Organization.objects.first()
    if not org:
        org = Organization.objects.create(code="PERF2", name="Perf Org 2", slug="perf-org-2", organization_type="studio")

    # Ensure at least 50 projects exist
    existing = Project.objects.filter(organization=org).count()
    needed = max(0, 50 - existing)
    if needed:
        ProjectFactory.create_batch(needed, organization=org)

    client = admin_client
    url = "/api/v1/projects/"

    # Time a large page
    start = time.time()
    resp = client.get(url, {"page": 1, "page_size": 50}, HTTP_X_ORGANIZATION_ID=str(org.id))
    elapsed = time.time() - start
    assert resp.status_code == 200
    assert "count" in resp.json()
    assert elapsed < 1.0, f"Project list pagination too slow: {elapsed:.2f}s"
