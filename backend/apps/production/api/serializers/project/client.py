"""
A project's client on the wire (docs/sync CR-60).

``client_id`` is written as a live client's UUID, or blank for none; anything else is 400 "Unknown client.".
``client_name`` is read-only: the server writes the client's name with the id.
"""

from __future__ import annotations

from typing import Any

from rest_framework import serializers

from apps.production.validators.partners import resolve_project_client


class ProjectClientMixin(serializers.Serializer[Any]):
    client_id = serializers.CharField(required=False, allow_blank=True, max_length=50)
    client_name = serializers.CharField(read_only=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if "client_id" in attrs:
            attrs["client_id"], attrs["client_name"] = resolve_project_client(attrs["client_id"])
        return attrs
