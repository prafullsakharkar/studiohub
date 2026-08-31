"""
Delivery serializers.
"""
from rest_framework import serializers

from apps.deliveries.models import DeliveryPackage, DeliveryVersionRef


class DeliveryVersionRefSerializer(serializers.ModelSerializer):
    """Serializer for delivery version references."""
    
    version_id = serializers.UUIDField(source="version.id", read_only=True)
    version_number = serializers.CharField(read_only=True)
    entity_type = serializers.CharField(read_only=True)
    entity_code = serializers.CharField(read_only=True)
    entity_name = serializers.CharField(read_only=True)
    
    class Meta:
        model = DeliveryVersionRef
        fields = (
            "id",
            "version_id",
            "version_number",
            "entity_type",
            "entity_code",
            "entity_name",
            "file_size_bytes",
            "frame_count",
            "file_path",
            "checksum_md5",
            "checksum_sha256",
            "is_validated",
            "validation_notes",
            "created_at",
        )
        read_only_fields = (
            "id",
            "version_id",
            "version_number",
            "entity_type",
            "entity_code",
            "entity_name",
            "file_size_bytes",
            "frame_count",
            "file_path",
            "checksum_md5",
            "checksum_sha256",
            "is_validated",
            "created_at",
        )


class DeliveryListSerializer(serializers.ModelSerializer):
    """Serializer for delivery list view."""
    
    client_name = serializers.CharField(source="client.name", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    version_count = serializers.IntegerField(read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = DeliveryPackage
        fields = (
            "id",
            "name",
            "code",
            "status",
            "client_status",
            "delivery_method",
            "version_count",
            "total_size_bytes",
            "total_frames",
            "client_name",
            "project_name",
            "expires_at",
            "is_expired",
            "is_archived",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "code",
            "status",
            "client_status",
            "version_count",
            "total_size_bytes",
            "total_frames",
            "is_expired",
            "created_at",
            "updated_at",
        )


class DeliveryDetailSerializer(serializers.ModelSerializer):
    """Serializer for delivery detail view."""
    
    client = serializers.UUIDField(source="client.id", read_only=True)
    client_name = serializers.CharField(source="client.name", read_only=True)
    project = serializers.UUIDField(source="project.id", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    versions = DeliveryVersionRefSerializer(many=True, read_only=True)
    
    class Meta:
        model = DeliveryPackage
        fields = (
            "id",
            "name",
            "code",
            "status",
            "client_status",
            "delivery_method",
            "delivery_destination",
            "passcode",
            "expires_at",
            "total_size_bytes",
            "total_frames",
            "notes",
            "client_notes",
            "manifest_data",
            "checksums",
            "is_archived",
            "client",
            "client_name",
            "project",
            "project_name",
            "versions",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "code",
            "status",
            "client_status",
            "total_size_bytes",
            "total_frames",
            "manifest_data",
            "checksums",
            "created_at",
            "updated_at",
        )


class DeliveryCreateSerializer(serializers.Serializer):
    """Serializer for creating a delivery."""
    
    name = serializers.CharField(required=True, max_length=255)
    code = serializers.CharField(required=True, max_length=50)
    project_id = serializers.UUIDField(required=False, allow_null=True)
    client_id = serializers.UUIDField(required=False, allow_null=True)
    delivery_method = serializers.ChoiceField(
        choices=["Aspera", "S3", "FTP", "Web Download"],
        default="S3",
    )
    delivery_destination = serializers.CharField(required=False, allow_blank=True)
    passcode = serializers.CharField(required=False, allow_blank=True, max_length=64)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    client_notes = serializers.CharField(required=False, allow_blank=True)
    
    def validate_code(self, value):
        """Validate delivery code uniqueness."""
        from apps.deliveries.models import DeliveryPackage
        
        if DeliveryPackage.objects.filter(code=value).exists():
            raise serializers.ValidationError("A delivery with this code already exists.")
        return value

    def create(self, validated_data):
        """Create a delivery package."""
        from apps.deliveries.models import DeliveryPackage

        organization = validated_data.pop("organization")
        created_by = validated_data.pop("created_by", None)
        return DeliveryPackage.objects.create(
            organization=organization,
            created_by=created_by,
            **validated_data,
        )


class DeliveryUpdateSerializer(serializers.Serializer):
    """Serializer for updating a delivery."""
    
    name = serializers.CharField(required=False, max_length=255)
    delivery_method = serializers.ChoiceField(
        choices=["Aspera", "S3", "FTP", "Web Download"],
        required=False,
    )
    delivery_destination = serializers.CharField(required=False, allow_blank=True)
    passcode = serializers.CharField(required=False, allow_blank=True, max_length=64)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    client_notes = serializers.CharField(required=False, allow_blank=True)


class DeliveryAddVersionSerializer(serializers.Serializer):
    """Serializer for adding a version to a delivery."""
    
    version_id = serializers.UUIDField(required=True)
    version_number = serializers.CharField(required=True, max_length=50)
    entity_type = serializers.CharField(required=True, max_length=50)
    entity_code = serializers.CharField(required=True, max_length=255)
    entity_name = serializers.CharField(required=True, max_length=255)
    file_size_bytes = serializers.IntegerField(required=False, default=0)
    frame_count = serializers.IntegerField(required=False, default=0)
    file_path = serializers.CharField(required=True, max_length=500)
    checksum_md5 = serializers.CharField(required=False, allow_blank=True, max_length=32)
    checksum_sha256 = serializers.CharField(required=False, allow_blank=True, max_length=64)


class DeliveryValidateSerializer(serializers.Serializer):
    """Serializer for validating a delivery."""
    
    def validate(self, data):
        """Validate the delivery."""
        return data


class DeliveryPrepareSerializer(serializers.Serializer):
    """Serializer for preparing a delivery."""
    
    def validate(self, data):
        """Validate the preparation."""
        return data


class DeliverySubmitSerializer(serializers.Serializer):
    """Serializer for submitting a delivery."""
    
    def validate(self, data):
        """Validate the submission."""
        return data


class DeliveryApproveSerializer(serializers.Serializer):
    """Serializer for approving a delivery."""
    
    client_notes = serializers.CharField(required=False, allow_blank=True)


class DeliveryRejectSerializer(serializers.Serializer):
    """Serializer for rejecting a delivery."""
    
    rejection_reason = serializers.CharField(required=True, allow_blank=False)
