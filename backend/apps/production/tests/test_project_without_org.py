import pytest

from apps.production.models import Project


@pytest.mark.django_db
def test_project_create_requires_no_org():
    project = Project.objects.create(code="NOORG-001", name="No Org Project")
    assert project.pk is not None
    assert not hasattr(project, "organization")
