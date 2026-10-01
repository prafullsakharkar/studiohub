"""Shared clone-master action mixin for org-scoped viewsets.

Adds POST <resource>/clone-master/ that provisions missing platform masters
into the active organization via ``clone_master_records``.
"""

from __future__ import annotations

from typing import Any

from rest_framework.decorators import action
from rest_framework.response import Response

from apps.organization.services.clone_master import clone_master_records


class CloneMasterMixin:
    """Plug into org-scoped viewsets to expose the ``clone-master`` action.

    Subclasses declare:
    - ``clone_source_model``: platform catalog model (is_deleted=False rows)
    - ``clone_target_model``: organization model to insert into
    - ``clone_label``: human label used in the response message
    - ``clone_build_kwargs(master) -> dict``: field dict (without organization)
    """

    clone_source_model: Any = None
    clone_target_model: Any = None
    clone_label = "Master Records"
    clone_build_kwargs: Any = None

    def _clone_models(self):
        if self.clone_source_model is None or self.clone_target_model is None:
            raise NotImplementedError("clone_source_model/clone_target_model must be defined.")
        return self.clone_source_model, self.clone_target_model

    def _clone_build(self, master):
        if not callable(self.clone_build_kwargs):
            raise NotImplementedError("clone_build_kwargs must be defined.")
        return self.clone_build_kwargs(master)

    @action(detail=False, methods=["post"], url_path="clone-master")
    def clone_master(self, request, *args, **kwargs):
        organization = getattr(request, "organization", None)
        if organization is None:
            return Response(
                {"detail": "An active organization is required."},
                status=400,
            )

        source_model, target_model = self._clone_models()
        masters = source_model.objects.filter(is_deleted=False)
        if hasattr(source_model, "is_active"):
            masters = masters.filter(is_active=True)

        result = clone_master_records(
            masters=masters,
            target_model=target_model,
            organization=organization,
            build_kwargs=self._clone_build,
        )
        if result.created_count == 0:
            message = f"All {self.clone_label} are already enabled for this organization."
        else:
            message = f"{self.clone_label} enabled successfully."
        return Response(result.as_response(message), status=200)
