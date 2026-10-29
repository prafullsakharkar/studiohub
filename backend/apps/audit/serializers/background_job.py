"""
Background Job serializer.
"""
from rest_framework import serializers

from apps.audit.models.background_job import BackgroundJob


class BackgroundJobSerializer(serializers.ModelSerializer[BackgroundJob]):
    """
    Serializer for BackgroundJob.
    """
    
    
    class Meta:
        model = BackgroundJob
        fields = (
            "id",
            "uuid",
            "job_type",
            "status",
            "progress",
            "description",
            "job_id",
            "queue_name",
            "worker_id",
            "started_at",
            "completed_at",
            "result_data",
            "error_message",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "uuid",
            "created_at",
            "updated_at",
        )
