import factory
from django.utils import timezone
from factory.django import DjangoModelFactory

from apps.identity.tests.factories import UserFactory
from apps.organization.tests.factories import OrganizationFactory
from apps.production.models import (
    Asset,
    EditorialTrack,
    Media,
    Playlist,
    Project,
    Review,
    Sequence,
    Shot,
    Show,
    Task,
    Timelog,
    Version,
    Workflow,
)


class ProjectFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
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


class ShotFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
    class Meta:
        model = Shot
        django_get_or_create = ("code", "project")

    organization = factory.SubFactory(OrganizationFactory)
    project = factory.SubFactory(
        ProjectFactory,
        organization=factory.SelfAttribute("..organization"),
    )
    sequence_code = "SEQ01"
    code = factory.Sequence(lambda n: f"SHOT{n:03d}")
    name = factory.Sequence(lambda n: f"Shot {n}")
    status = "Not Started"
    frame_in = 1001
    frame_out = 1100
    handle_frames = 8
    thumbnail_url = factory.Faker("url")
    pipeline = {"layout": "Not Started"}


class SequenceFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
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


class AssetFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
    class Meta:
        model = Asset
        django_get_or_create = ("code", "project")

    organization = factory.SubFactory(OrganizationFactory)
    project = factory.SubFactory(
        ProjectFactory,
        organization=factory.SelfAttribute("..organization"),
    )
    name = factory.Sequence(lambda n: f"Asset {n}")
    code = factory.Sequence(lambda n: f"AST{n:03d}")
    category = "Prop"
    status = "Not Started"
    version = "v001"
    file_format = "OpenUSD"
    poly_count = 1000
    lod_levels = 1
    software = "Maya"


class TaskFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
    class Meta:
        model = Task
        django_get_or_create = ("code", "project")

    organization = factory.SubFactory(OrganizationFactory)
    project = factory.SubFactory(
        ProjectFactory,
        organization=factory.SelfAttribute("..organization"),
    )
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


class ShowFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
    class Meta:
        model = Show
        django_get_or_create = ("code", "project")

    organization = factory.SubFactory(OrganizationFactory)
    project = factory.SubFactory(
        ProjectFactory,
        organization=factory.SelfAttribute("..organization"),
    )
    code = factory.Sequence(lambda n: f"SHOW{n:03d}")
    name = factory.Sequence(lambda n: f"Show {n}")


class VersionFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
    class Meta:
        model = Version
        django_get_or_create = ("code", "organization")

    organization = factory.SubFactory(OrganizationFactory)
    code = factory.Sequence(lambda n: f"VER{n:03d}")


class MediaFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
    class Meta:
        model = Media
        django_get_or_create = ("code", "organization")

    organization = factory.SubFactory(OrganizationFactory)
    code = factory.Sequence(lambda n: f"MED{n:03d}")


class PlaylistFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
    class Meta:
        model = Playlist

    organization = factory.SubFactory(OrganizationFactory)
    name = factory.Sequence(lambda n: f"Playlist {n}")


class ReviewFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
    class Meta:
        model = Review

    organization = factory.SubFactory(OrganizationFactory)
    title = factory.Sequence(lambda n: f"Review {n}")


class EditorialTrackFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
    class Meta:
        model = EditorialTrack

    organization = factory.SubFactory(OrganizationFactory)
    name = factory.Sequence(lambda n: f"Editorial Track {n}")


class WorkflowFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
    class Meta:
        model = Workflow

    organization = factory.SubFactory(OrganizationFactory)
    name = factory.Sequence(lambda n: f"Workflow {n}")


class TimelogFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
    class Meta:
        model = Timelog

    organization = factory.SubFactory(OrganizationFactory)
    task = factory.SubFactory(
        TaskFactory,
        organization=factory.SelfAttribute("..organization"),
    )
    person = factory.SubFactory(UserFactory)
    date = factory.LazyFunction(lambda: timezone.now().date())
