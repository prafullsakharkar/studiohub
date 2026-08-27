from rest_framework import serializers
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema

class DummySerializer(serializers.Serializer):
    pass
from drf_spectacular.types import OpenApiTypes

MOCK_RISKS = [
    {
        "id": "risk-001",
        "severity": "critical",
        "category": "schedule",
        "title": "Sequence 010 Comp Slip",
        "description": "4.5 days forecasted delay due to FX pyro simulation queue backlog.",
        "project_code": "NK99",
        "impacted_entity_type": "shot",
        "impacted_entity_id": "shot-001",
        "impacted_entity_name": "NK_010_010",
        "detected_at": "2026-08-20T00:00:00Z",
        "suggested_action": "Rebalance render queue priority",
        "confidence_score": 0.92,
        "auto_mitigation_available": True,
    }
]

MOCK_CHAT = [
    {"id": "msg-001", "sender": "assistant", "content": "StudioHub Intelligence ready.", "timestamp": "2026-08-20T00:00:00Z"}
]

class AIChatView(GenericAPIView):
    serializer_class = DummySerializer
    permission_classes = (IsAuthenticated,)

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response(MOCK_CHAT)

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        user_query = request.data.get("content") or request.data.get("query") or ""
        # Echo + stub
        response = {
            "id": f"msg-{len(MOCK_CHAT)+1}",
            "sender": "assistant",
            "content": f"Processed: {user_query}\n\nThis is a stub AI response — wire to production LLM in next iteration.",
            "timestamp": "2026-08-20T00:00:00Z",
            "capability_used": "production_assistant",
        }
        MOCK_CHAT.append({"id": f"msg-{len(MOCK_CHAT)+1}", "sender": "user", "content": user_query, "timestamp": "2026-08-20T00:00:00Z"})
        MOCK_CHAT.append(response)
        return Response(response)

class AIRisksView(GenericAPIView):
    serializer_class = DummySerializer
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response(MOCK_RISKS)

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        # Resolve risk
        risk_id = request.data.get("risk_id") or request.data.get("id")
        return Response({"success": True, "message": f"Risk {risk_id} mitigated (stub)."})

class AITaskRecommendationsView(GenericAPIView):
    serializer_class = DummySerializer
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response([])

class AIProjectSummaryView(GenericAPIView):
    serializer_class = DummySerializer
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request, project_code=None):
        return Response({
            "project_code": project_code or "NK99",
            "project_name": "Project Shadow",
            "generated_at": "2026-08-20T00:00:00Z",
            "health_score": 72,
            "status": "at_risk",
            "headline": "At risk due to comp slip",
            "executive_brief": "Stub summary.",
            "key_metrics": {"shots_completed": 50, "shots_total": 100, "completion_percentage": 50, "days_to_final_delivery": 10, "budget_burn_rate_pct": 60, "open_critical_notes": 2},
            "department_breakdown": [],
            "critical_risks": [],
            "recommended_actions": [],
        })

class AIShotSummaryView(GenericAPIView):
    serializer_class = DummySerializer
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request, shot_code=None):
        return Response({
            "shot_code": shot_code or "NK_010_010",
            "project_code": "NK99",
            "generated_at": "2026-08-20T00:00:00Z",
            "status": "In Progress",
            "frame_range": "1001-1100",
            "supervisor_intent": "Stub intent",
            "pipeline_stage": "comp",
            "active_tasks_count": 2,
            "versions_history_count": 3,
            "latest_review_feedback": "Stub feedback",
            "blocker_analysis": "No blockers",
            "turnaround_forecast_days": 3,
        })


class AIRisksResolveView(GenericAPIView):
    serializer_class = DummySerializer
    permission_classes = (IsAuthenticated,)

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        risk_id = request.data.get("risk_id") or request.data.get("id")
        return Response({"success": True, "message": f"Risk {risk_id} resolved (stub)."})


class AITaskRecommendationsApplyView(GenericAPIView):
    serializer_class = DummySerializer
    permission_classes = (IsAuthenticated,)

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        return Response({"success": True, "message": "Task recommendation applied (stub)."})


class AIPermissionContextView(GenericAPIView):
    serializer_class = DummySerializer
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        user = request.user
        org = getattr(request, "organization", None)
        return Response({
            "active_organization_id": str(org.id) if org else "",
            "active_organization_name": getattr(org, "name", "") if org else "",
            "active_project_code": "NK99",
            "user_role": "VFX Supervisor" if user.is_staff else "Artist",
            "restricted_entities_count": 0,
        })


# Extend AIChatView to handle DELETE (clear chat) and GET history
# Monkey-patch to add delete
def _ai_chat_delete(self, request):
    global MOCK_CHAT
    MOCK_CHAT = [{"id": "msg-001", "sender": "assistant", "content": "StudioHub Intelligence ready.", "timestamp": "2026-08-20T00:00:00Z"}]
    return Response(status=204)

AIChatView.delete = _ai_chat_delete
