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
    Software,
    SoftwareVersion,
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


class SoftwareFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
    class Meta:
        model = Software

    code = factory.Sequence(lambda n: f"sw{n}")
    name = factory.Sequence(lambda n: f"Software {n}")


class SoftwareVersionFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
    class Meta:
        model = SoftwareVersion

    software = factory.SubFactory(SoftwareFactory)
    version = factory.Sequence(lambda n: f"{2000 + n}")
    code = factory.Sequence(lambda n: f"ver-{n}")
    name = factory.Sequence(lambda n: f"Version {n}")
