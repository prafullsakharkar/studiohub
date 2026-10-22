"""
API key and personal access token lifecycle (API-CRED-01..05).

Owners manage their own credentials; holders of ``identity.credential.manage``
can also list and revoke everyone's. These routes accept a session JWT only:
a credential can never mint, rotate or revoke credentials, otherwise a stolen
key could outlive its own revocation.
"""

from __future__ import annotations

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.identity.api.serializers.credential import (
    CredentialCreateSerializer,
    CredentialSerializer,
)
from apps.identity.authentication.session_bound_jwt import SessionBoundJWTAuthentication
from apps.identity.services.credential import (
    API_KEY,
    PERSONAL_ACCESS_TOKEN,
    CredentialKind,
    CredentialService,
)


class CredentialViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,  # pyright: ignore[reportMissingTypeArgument]
):
    kind: CredentialKind

    authentication_classes = (SessionBoundJWTAuthentication,)
    permission_classes = (IsAuthenticated,)
    serializer_class = CredentialSerializer
    http_method_names = ["get", "post", "delete", "head", "options"]
    ordering = ("-created_at",)

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "kind": self.kind}

    def get_queryset(self):
        qs = CredentialService.queryset(
            self.kind,
            self.request.user,
            # Lists show only your own unless you ask for everything; a
            # single credential is addressable by anyone allowed to manage it.
            include_all=self.action != "list" or self.request.query_params.get("all") == "true",
        )

        if self.request.query_params.get("include_revoked") != "true":
            qs = qs.filter(revoked_at__isnull=True)

        return qs.order_by("-created_at")

    def _present(self, credential, *, secret=None, http_status=status.HTTP_200_OK):
        data = dict(self.get_serializer(credential).data)

        if secret is not None:
            data["secret"] = secret

        return Response(data, status=http_status)

    def create(self, request, *args, **kwargs):
        serializer = CredentialCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            credential, token = CredentialService.create(
                kind=self.kind,
                owner=request.user,
                **serializer.validated_data,
            )
        except DjangoValidationError as exc:
            raise ValidationError({"detail": exc.messages}) from None

        return self._present(credential, secret=token, http_status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        credential = self.get_object()

        CredentialService.revoke(
            kind=self.kind,
            credential=credential,
            actor=request.user,
        )

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def rotate(self, request, *args, **kwargs):
        credential = self.get_object()

        try:
            new, token = CredentialService.rotate(
                kind=self.kind,
                credential=credential,
                actor=request.user,
            )
        except DjangoValidationError as exc:
            raise ValidationError({"detail": exc.messages}) from None

        return self._present(new, secret=token)


class ApiKeyViewSet(CredentialViewSet):
    kind = API_KEY


class PersonalAccessTokenViewSet(CredentialViewSet):
    kind = PERSONAL_ACCESS_TOKEN
