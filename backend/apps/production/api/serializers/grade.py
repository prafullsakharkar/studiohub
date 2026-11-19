"""``POST projects/{id}/grades/import/`` (review-pipeline RP-20, C-RP-54)."""

from __future__ import annotations

from typing import Any

from rest_framework import serializers

from apps.production.api.serializers.shot.base import ShotGradeSerializer


class GradeImportRequestSerializer(serializers.Serializer[Any]):
    file = serializers.FileField()
    #: true (the default) answers what would change and writes nothing
    dry_run = serializers.BooleanField(default=True)


class GradeImportShotSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    code = serializers.CharField()


class GradeImportMatchedSerializer(serializers.Serializer[Any]):
    id = serializers.CharField(
        help_text="The correction's id in the file; for an EDL or ALE, `event <n>: <name>` or `row <n>: <name>`."
    )
    shot = GradeImportShotSerializer()
    old = ShotGradeSerializer(allow_null=True)
    new = ShotGradeSerializer()


class GradeImportUnchangedSerializer(serializers.Serializer[Any]):
    id = serializers.CharField()
    shot = GradeImportShotSerializer()


class GradeImportInvalidSerializer(serializers.Serializer[Any]):
    id = serializers.CharField(allow_blank=True)
    field = serializers.CharField()
    message = serializers.CharField()


class GradeImportSerializer(serializers.Serializer[Any]):
    dry_run = serializers.BooleanField()
    file_name = serializers.CharField()
    corrections = serializers.IntegerField()
    matched = GradeImportMatchedSerializer(many=True)
    unchanged = GradeImportUnchangedSerializer(many=True)
    unmatched = serializers.ListField(child=serializers.CharField())
    invalid = GradeImportInvalidSerializer(many=True)
    applied = serializers.IntegerField()
    #: EDL events and ALE rows without a grade (RP-22, C-RP-55); 0 for CDL files
    ungraded = serializers.IntegerField()
