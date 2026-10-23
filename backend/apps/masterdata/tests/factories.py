"""Factories for masterdata tests. Codes and names are sequence-unique."""

from __future__ import annotations

import factory
from factory.django import DjangoModelFactory

from apps.masterdata.models import (
    Client,
    ClientContact,
    ClientContract,
    MasterAssetType,
    MasterFileType,
    MasterReviewType,
    MasterShotType,
    MasterStatus,
    MasterTaskType,
    Software,
    SoftwareVersion,
    Vendor,
    VendorContact,
    VendorContract,
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


class ClientFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
    class Meta:
        model = Client

    code = factory.Sequence(lambda n: f"CL{n}")
    name = factory.Sequence(lambda n: f"Client {n}")


class VendorFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
    class Meta:
        model = Vendor

    code = factory.Sequence(lambda n: f"VN{n}")
    name = factory.Sequence(lambda n: f"Vendor {n}")


class ClientContactFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
    class Meta:
        model = ClientContact

    client = factory.SubFactory(ClientFactory)
    name = factory.Sequence(lambda n: f"Contact {n}")
    email = factory.Sequence(lambda n: f"contact{n}@example.com")


class VendorContactFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
    class Meta:
        model = VendorContact

    vendor = factory.SubFactory(VendorFactory)
    name = factory.Sequence(lambda n: f"Vendor contact {n}")
    email = factory.Sequence(lambda n: f"vcontact{n}@example.com")


class ClientContractFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
    """A Draft SOW by default; pass ``status="Active", activated_at=...`` for an in-force one."""

    class Meta:
        model = ClientContract

    client = factory.SubFactory(ClientFactory)
    contract_number = factory.Sequence(lambda n: f"CC-{n}")
    title = factory.Sequence(lambda n: f"Client contract {n}")
    type = "SOW"
    status = "Draft"


class VendorContractFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
    class Meta:
        model = VendorContract

    vendor = factory.SubFactory(VendorFactory)
    contract_number = factory.Sequence(lambda n: f"VC-{n}")
    title = factory.Sequence(lambda n: f"Vendor contract {n}")
    type = "SOW"
    status = "Draft"
