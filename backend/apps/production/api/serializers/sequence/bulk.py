from rest_framework import serializers


class SequenceBulkItemSerializer(serializers.Serializer):
    """Input item for bulk-create. ``project_id`` targets the owning project
    (resolved and scoped to the active organization by the service)."""

    project_id = serializers.UUIDField()
    code = serializers.CharField(max_length=50)
    name = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    status = serializers.CharField(required=False, allow_blank=True, default="")
    description = serializers.CharField(required=False, allow_blank=True, default="")
    frame_in = serializers.IntegerField(required=False, default=1001)
    frame_out = serializers.IntegerField(required=False, default=1100)
    department = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    tags = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    metadata = serializers.DictField(required=False, default=dict)


class SequenceBulkCreateSerializer(serializers.Serializer):
    items = SequenceBulkItemSerializer(many=True, required=True)


class SequenceBulkUpdateItemSerializer(serializers.Serializer):
    """Input item for bulk-update: ``id`` targets an existing sequence."""

    id = serializers.UUIDField()
    name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    code = serializers.CharField(max_length=50, required=False)
    status = serializers.CharField(required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    frame_in = serializers.IntegerField(required=False)
    frame_out = serializers.IntegerField(required=False)
    department = serializers.CharField(max_length=100, required=False, allow_blank=True)
    tags = serializers.ListField(child=serializers.CharField(), required=False)
    metadata = serializers.DictField(required=False)
