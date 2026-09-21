from typing import Any

from django.utils.text import slugify
from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.models import Review


class ReviewCreateSerializer(BaseWriteSerializer[Any]):
    id = serializers.UUIDField(read_only=True)
    uuid = serializers.UUIDField(read_only=True)
    class Meta:
        model = Review
        fields = ("id","uuid","title","code","description","project","entity_type","entity_id","entity_code","status","thumbnail_url","video_url")
        read_only_fields = ("id","uuid")
        extra_kwargs = {
            "code": {"required": False, "allow_blank": True},
        }

    def validate(self, attrs):
        # The frontend review form omits ``code``: auto-generate it from
        # the title (same pattern as organization roles) so creates do
        # not fail validation. Explicit codes are preserved as-is.
        attrs = super().validate(attrs)
        code = (attrs.get("code") or "").strip()
        if not code:
            title = attrs.get("title", "")
            code = slugify(title)[:50] or "review"
            attrs["code"] = code
        return attrs
