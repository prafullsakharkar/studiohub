"""Factories for masterdata tests. Codes and names are sequence-unique."""

from __future__ import annotations

import factory
from factory.django import DjangoModelFactory

from apps.masterdata.models import (
    MasterAssetType,
    MasterFileType,
    MasterReviewType,
    MasterShotType,
    MasterStatus,
    MasterTaskType,
)


class _LookupFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
    class Meta:
        abstract = True

    code = factory.Sequence(lambda n: f"code-{n}")
    name = factory.Sequence(lambda n: f"Name {n}")


class MasterStatusFactory(_LookupFactory):
    class Meta:
        model = MasterStatus

    entity_type = "Task"


class MasterTaskTypeFactory(_LookupFactory):
    class Meta:
        model = MasterTaskType


class MasterAssetTypeFactory(_LookupFactory):
    class Meta:
        model = MasterAssetType


class MasterShotTypeFactory(_LookupFactory):
    class Meta:
        model = MasterShotType


class MasterReviewTypeFactory(_LookupFactory):
    class Meta:
        model = MasterReviewType


class MasterFileTypeFactory(_LookupFactory):
    class Meta:
        model = MasterFileType

    extension = factory.Sequence(lambda n: f"ext{n}")
