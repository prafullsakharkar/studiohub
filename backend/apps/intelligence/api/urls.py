from django.urls import path

from .viewsets.ai import (
    AIChatView,
    AIPermissionContextView,
    AIProjectSummaryView,
    AIRisksResolveView,
    AIRisksView,
    AIShotSummaryView,
    AITaskRecommendationsApplyView,
    AITaskRecommendationsView,
)
from .viewsets.analytics import IntelligenceAnalyticsDashboardView
from .viewsets.knowledge import (
    IntelligenceKnowledgeDetailView,
    IntelligenceKnowledgeLikeView,
    IntelligenceKnowledgeLinkEntityView,
    IntelligenceKnowledgeListView,
)
from .viewsets.search import (
    IntelligenceSearchRecentView,
    IntelligenceSearchSavedDetailView,
    IntelligenceSearchSavedView,
    IntelligenceSearchView,
)

app_name = "intelligence"

urlpatterns = [
    path("search/", IntelligenceSearchView.as_view(), name="intelligence-search"),
    path("search/saved/", IntelligenceSearchSavedView.as_view(), name="intelligence-search-saved"),
    path("search/saved/<str:pk>/", IntelligenceSearchSavedDetailView.as_view(), name="intelligence-search-saved-detail"),
    path("search/recent/", IntelligenceSearchRecentView.as_view(), name="intelligence-search-recent"),
    path("knowledge/", IntelligenceKnowledgeListView.as_view(), name="intelligence-knowledge-list"),
    path("knowledge/<str:pk>/", IntelligenceKnowledgeDetailView.as_view(), name="intelligence-knowledge-detail"),
    path("knowledge/<str:pk>/like/", IntelligenceKnowledgeLikeView.as_view(), name="intelligence-knowledge-like"),
    path("knowledge/<str:pk>/link-entity/", IntelligenceKnowledgeLinkEntityView.as_view(), name="intelligence-knowledge-link-entity"),
    path("knowledge/<str:pk>/link-entity/<str:link_id>/", IntelligenceKnowledgeLinkEntityView.as_view(), name="intelligence-knowledge-unlink-entity"),
    path("ai/chat/", AIChatView.as_view(), name="intelligence-ai-chat"),
    path("ai/risks/", AIRisksView.as_view(), name="intelligence-ai-risks"),
    path("ai/risks/resolve/", AIRisksResolveView.as_view(), name="intelligence-ai-risks-resolve"),
    path("ai/task-recommendations/", AITaskRecommendationsView.as_view(), name="intelligence-ai-task-recommendations"),
    path("ai/task-recommendations/apply/", AITaskRecommendationsApplyView.as_view(), name="intelligence-ai-task-recommendations-apply"),
    path("ai/project-summary/<str:project_code>/", AIProjectSummaryView.as_view(), name="intelligence-ai-project-summary"),
    path("ai/shot-summary/<str:shot_code>/", AIShotSummaryView.as_view(), name="intelligence-ai-shot-summary"),
    path("ai/permission-context/", AIPermissionContextView.as_view(), name="intelligence-ai-permission-context"),
    path("analytics/<str:domain>/", IntelligenceAnalyticsDashboardView.as_view(), name="intelligence-analytics-dashboard"),
]
