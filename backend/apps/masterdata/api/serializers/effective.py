"""
Effective (resolved) master-data serializers.

The resolution service builds plain dicts with exactly these keys; these
serializers validate the boundary shape.
"""

from __future__ import annotations

from rest_framework import serializers

from apps.masterdata.api.serializers.catalog import (
    MasterAssetTypeSerializer,
    MasterFileTypeSerializer,
    MasterReviewTypeSerializer,
    MasterShotTypeSerializer,
    MasterStatusSerializer,
    MasterTaskTypeSerializer,
    SoftwareSerializer,
    SoftwareVersionSerializer,
)
from apps.masterdata.api.serializers.config import (
    OrganizationAssetTypeConfigSerializer,
    OrganizationReviewTypeConfigSerializer,
    OrganizationShotTypeConfigSerializer,
    OrganizationSoftwareConfigSerializer,
    OrganizationStatusConfigSerializer,
    OrganizationTaskTypeConfigSerializer,
)


class EffectiveSoftwareSerializer(SoftwareSerializer):
    origin = serializers.CharField()
    is_custom = serializers.BooleanField()
    is_enabled = serializers.BooleanField()
    is_overridden = serializers.BooleanField()
    display_name = serializers.CharField()
    effective_category = serializers.CharField()
    versions = SoftwareVersionSerializer(many=True)
    default_version = SoftwareVersionSerializer(allow_null=True)
    config = OrganizationSoftwareConfigSerializer(allow_null=True)
    organization_config = OrganizationSoftwareConfigSerializer(allow_null=True)

    class Meta(SoftwareSerializer.Meta):
        fields = SoftwareSerializer.Meta.fields + (
            "origin",
            "is_custom",
            "is_enabled",
            "is_overridden",
            "display_name",
            "effective_category",
            "versions",
            "default_version",
            "config",
            "organization_config",
        )


class EffectiveStatusSerializer(MasterStatusSerializer):
    origin = serializers.CharField()
    is_custom = serializers.BooleanField()
    is_enabled = serializers.BooleanField()
    is_overridden = serializers.BooleanField()
    display_name = serializers.CharField()
    effective_color = serializers.CharField()
    effective_order = serializers.IntegerField()
    config = OrganizationStatusConfigSerializer(allow_null=True)
    organization_config = OrganizationStatusConfigSerializer(allow_null=True)

    class Meta(MasterStatusSerializer.Meta):
        fields = MasterStatusSerializer.Meta.fields + (
            "origin",
            "is_custom",
            "is_enabled",
            "is_overridden",
            "display_name",
            "effective_color",
            "effective_order",
            "config",
            "organization_config",
        )


class EffectiveTaskTypeSerializer(MasterTaskTypeSerializer):
    origin = serializers.CharField()
    is_custom = serializers.BooleanField()
    is_enabled = serializers.BooleanField()
    is_overridden = serializers.BooleanField()
    display_name = serializers.CharField()
    effective_color = serializers.CharField()
    config = OrganizationTaskTypeConfigSerializer(allow_null=True)
    organization_config = OrganizationTaskTypeConfigSerializer(allow_null=True)

    class Meta(MasterTaskTypeSerializer.Meta):
        fields = MasterTaskTypeSerializer.Meta.fields + (
            "origin",
            "is_custom",
            "is_enabled",
            "is_overridden",
            "display_name",
            "effective_color",
            "config",
            "organization_config",
        )


class EffectiveAssetTypeSerializer(MasterAssetTypeSerializer):
    origin = serializers.CharField()
    is_custom = serializers.BooleanField()
    is_enabled = serializers.BooleanField()
    is_overridden = serializers.BooleanField()
    display_name = serializers.CharField()
    config = OrganizationAssetTypeConfigSerializer(allow_null=True)

    class Meta(MasterAssetTypeSerializer.Meta):
        fields = MasterAssetTypeSerializer.Meta.fields + (
            "origin",
            "is_custom",
            "is_enabled",
            "is_overridden",
            "display_name",
            "config",
        )


class EffectiveShotTypeSerializer(MasterShotTypeSerializer):
    origin = serializers.CharField()
    is_custom = serializers.BooleanField()
    is_enabled = serializers.BooleanField()
    is_overridden = serializers.BooleanField()
    display_name = serializers.CharField()
    config = OrganizationShotTypeConfigSerializer(allow_null=True)

    class Meta(MasterShotTypeSerializer.Meta):
        fields = MasterShotTypeSerializer.Meta.fields + (
            "origin",
            "is_custom",
            "is_enabled",
            "is_overridden",
            "display_name",
            "config",
        )


class EffectiveReviewTypeSerializer(MasterReviewTypeSerializer):
    origin = serializers.CharField()
    is_custom = serializers.BooleanField()
    is_enabled = serializers.BooleanField()
    is_overridden = serializers.BooleanField()
    display_name = serializers.CharField()
    config = OrganizationReviewTypeConfigSerializer(allow_null=True)

    class Meta(MasterReviewTypeSerializer.Meta):
        fields = MasterReviewTypeSerializer.Meta.fields + (
            "origin",
            "is_custom",
            "is_enabled",
            "is_overridden",
            "display_name",
            "config",
        )


class EffectiveFileTypeSerializer(MasterFileTypeSerializer):
    origin = serializers.CharField()
    is_custom = serializers.BooleanField()
    is_enabled = serializers.BooleanField()
    is_overridden = serializers.BooleanField()
    display_name = serializers.CharField()
    config = serializers.DictField(allow_null=True)

    class Meta(MasterFileTypeSerializer.Meta):
        fields = MasterFileTypeSerializer.Meta.fields + (
            "origin",
            "is_custom",
            "is_enabled",
            "is_overridden",
            "display_name",
            "config",
        )


class BundleStatsSerializer(serializers.Serializer):
    total_software = serializers.IntegerField()
    enabled_software = serializers.IntegerField()
    custom_software = serializers.IntegerField()
    total_statuses = serializers.IntegerField()
    enabled_statuses = serializers.IntegerField()
    custom_statuses = serializers.IntegerField()
    total_task_types = serializers.IntegerField()
    enabled_task_types = serializers.IntegerField()
    custom_task_types = serializers.IntegerField()
    total_overrides_applied = serializers.IntegerField()


class ResolvedBundleSerializer(serializers.Serializer):
    organization_id = serializers.UUIDField()
    resolved_at = serializers.DateTimeField()
    software = EffectiveSoftwareSerializer(many=True)
    statuses = EffectiveStatusSerializer(many=True)
    task_types = EffectiveTaskTypeSerializer(many=True)
    asset_types = EffectiveAssetTypeSerializer(many=True)
    shot_types = EffectiveShotTypeSerializer(many=True)
    review_types = EffectiveReviewTypeSerializer(many=True)
    file_types = EffectiveFileTypeSerializer(many=True)
    stats = BundleStatsSerializer()


class PlatformOverviewSerializer(serializers.Serializer):
    global_software_count = serializers.IntegerField()
    global_version_count = serializers.IntegerField()
    global_status_count = serializers.IntegerField()
    global_task_type_count = serializers.IntegerField()
    global_asset_type_count = serializers.IntegerField()
    global_shot_type_count = serializers.IntegerField()
    global_review_type_count = serializers.IntegerField()
    global_file_type_count = serializers.IntegerField()
    active_organizations_count = serializers.IntegerField()
    total_custom_records_across_orgs = serializers.IntegerField()
    system_health = serializers.CharField()
    last_definition_update = serializers.DateTimeField(allow_null=True)
