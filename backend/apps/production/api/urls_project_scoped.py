"""
Project-scoped nested routes for the frontend contract.

Mounted at /api/organizations/projects/<project>/... (no /v1/).
Both slashless and trailing-slash variants are served to match
`projectScopedApi.ts` exactly.
"""

from django.urls import path

from apps.production.api.views.project_notes import (
    ProjectNoteDetailView,
    ProjectNoteRepliesView,
    ProjectNoteStatusView,
    ProjectNotesView,
)
from apps.production.api.views.project_scoped import (
    ProjectActivityView,
    ProjectAssetsView,
    ProjectDashboardView,
    ProjectDeliveriesView,
    ProjectEditorialView,
    ProjectFilesView,
    ProjectMemberDetailView,
    ProjectMembersView,
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

PROJECT = "<str:project_id>"

_ROUTES = [
    ("members", ProjectMembersView),
    ("summary", ProjectSummaryView),
    ("dashboard", ProjectDashboardView),
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
    _base = f"projects/{PROJECT}/{_subpath}"
    urlpatterns += [
        path(f"{_base}", _view.as_view(), name=f"project-{_subpath}"),
        path(f"{_base}/", _view.as_view(), name=f"project-{_subpath}-slash"),
    ]

# CR-37: a member by id (the membership `id` the member rows carry).
for _suffix, _name in (("", "project-member-detail"), ("/", "project-member-detail-slash")):
    urlpatterns.append(
        path(f"projects/{PROJECT}/members/<uuid:member_id>{_suffix}", ProjectMemberDetailView.as_view(), name=_name)
    )

# RP-2 (docs/review-pipeline C-RP-10 to C-RP-13): one note, its replies and its status.
for _suffix, _view, _name in (
    ("", ProjectNoteDetailView, "project-note-detail"),
    ("/replies", ProjectNoteRepliesView, "project-note-replies"),
    ("/status", ProjectNoteStatusView, "project-note-status"),
):
    urlpatterns += [
        path(f"projects/{PROJECT}/notes/<str:note_id>{_suffix}", _view.as_view(), name=_name),
        path(f"projects/{PROJECT}/notes/<str:note_id>{_suffix}/", _view.as_view(), name=f"{_name}-slash"),
    ]
