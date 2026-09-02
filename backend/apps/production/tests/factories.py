import factory
from factory.django import DjangoModelFactory

from apps.identity.tests.factories import UserFactory
from apps.organization.tests.factories import OrganizationFactory
from apps.production.models import Asset, Project, Sequence, Shot, Task


class ProjectFactory(DjangoModelFactory):
    class Meta:
        model = Project
        django_get_or_create = ("code", "organization")

    organization = factory.SubFactory(OrganizationFactory)
    code = factory.Sequence(lambda n: f"PROJ{n:03d}")
    name = factory.Sequence(lambda n: f"Project {n}")
    type = "Feature Film"
    status = "In Progress"
    fps = 24
    resolution = "4096x2160"
    aspect_ratio = "2.39:1"
    color_space = "ACEScg"
    thumbnail_url = factory.Faker("url")
    budget_usd = 1000000
    supervisor = factory.SubFactory(UserFactory)
    coordinator = factory.SubFactory(UserFactory)


class ShotFactory(DjangoModelFactory):
    class Meta:
        model = Shot
        django_get_or_create = ("code", "project")

    organization = factory.SubFactory(OrganizationFactory)
    project = factory.SubFactory(ProjectFactory)
    sequence_code = "SEQ01"
    code = factory.Sequence(lambda n: f"SHOT{n:03d}")
    name = factory.Sequence(lambda n: f"Shot {n}")
    status = "Not Started"
    frame_in = 1001
    frame_out = 1100
    handle_frames = 8
    thumbnail_url = factory.Faker("url")
    pipeline = {"layout": "Not Started"}


class SequenceFactory(DjangoModelFactory):
    class Meta:
        model = Sequence
        django_get_or_create = ("code", "project")

    organization = factory.SubFactory(OrganizationFactory)
    project = factory.SubFactory(
        ProjectFactory,
        organization=factory.SelfAttribute("..organization"),
    )
    code = factory.Sequence(lambda n: f"SEQ{n:03d}")
    name = factory.Sequence(lambda n: f"Sequence {n}")
    status = "Not Started"
    frame_in = 1001
    frame_out = 1100
    department = ""
    tags = factory.LazyFunction(list)


class AssetFactory(DjangoModelFactory):
    class Meta:
        model = Asset
        django_get_or_create = ("code", "project")

    organization = factory.SubFactory(OrganizationFactory)
    project = factory.SubFactory(ProjectFactory)
    name = factory.Sequence(lambda n: f"Asset {n}")
    code = factory.Sequence(lambda n: f"AST{n:03d}")
    category = "Prop"
    status = "Not Started"
    version = "v001"
    file_format = "OpenUSD"
    poly_count = 1000
    lod_levels = 1
    software = "Maya"


class TaskFactory(DjangoModelFactory):
    class Meta:
        model = Task
        django_get_or_create = ("code", "project")

    organization = factory.SubFactory(OrganizationFactory)
    project = factory.SubFactory(ProjectFactory)
    title = factory.Sequence(lambda n: f"Task {n}")
    code = factory.Sequence(lambda n: f"TSK{n:03d}")
    entity_type = "Shot"
    entity_id = factory.Faker("uuid4")
    entity_code = factory.Sequence(lambda n: f"ENT{n:03d}")
    status = "Not Started"
    priority = "Medium"
    workflow = {}
    schedule = {}
    dependencies = {}
    is_archived = False
