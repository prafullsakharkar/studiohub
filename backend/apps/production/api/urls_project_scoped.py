"""
Project-scoped nested routes for the frontend contract.

Mounted at /api/organizations/<org>/projects/<project>/... (no /v1/).
Both slashless and trailing-slash variants are served to match
`projectScopedApi.ts` exactly.
"""

from django.urls import path

from apps.production.api.views.project_scoped import (
    ProjectActivityView,
    ProjectAssetsView,
    ProjectDeliveriesView,
    ProjectEditorialView,
    ProjectFilesView,
    ProjectMembersView,
    ProjectNotesView,
    ProjectPipelineView,
    ProjectResourcesView,
    ProjectReviewsView,
    ProjectScheduleView,
    ProjectSequencesView,
    ProjectShotsView,
    ProjectSummaryView,
    ProjectTasksView,
    ProjectVersionsView,
)

ORG = "<str:organization_id>"
PROJECT = "<str:project_id>"

_ROUTES = [
    ("members", ProjectMembersView),
    ("summary", ProjectSummaryView),
    ("sequences", ProjectSequencesView),
    ("shots", ProjectShotsView),
    ("tasks", ProjectTasksView),
    ("assets", ProjectAssetsView),
    ("versions", ProjectVersionsView),
    ("reviews", ProjectReviewsView),
    ("editorial", ProjectEditorialView),
    ("notes", ProjectNotesView),
    ("deliveries", ProjectDeliveriesView),
    ("schedule", ProjectScheduleView),
    ("resources", ProjectResourcesView),
    ("pipeline", ProjectPipelineView),
    ("files", ProjectFilesView),
    ("activity", ProjectActivityView),
]

app_name = "production-project-scoped"

urlpatterns = []
for _subpath, _view in _ROUTES:
    _base = f"{ORG}/projects/{PROJECT}/{_subpath}"
    urlpatterns += [
        path(f"{_base}", _view.as_view(), name=f"project-{_subpath}"),
        path(f"{_base}/", _view.as_view(), name=f"project-{_subpath}-slash"),
    ]
