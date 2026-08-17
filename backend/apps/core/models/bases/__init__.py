"""
Core model base classes.

This package provides reusable, domain-agnostic base models that can be
combined to create domain-specific models. The design follows the principle
of composition over inheritance - use only the capabilities you need.

## Generic Capabilities (Core)

These are domain-agnostic building blocks:

- `UUIDModel` - UUID primary key
- `TimeStampedModel` - created_at, updated_at
- `SoftDeleteModel` - soft delete support
- `AuditModel` - created_by, updated_by, deleted_by
- `OrderableModel` - ordering support
- `PublishableModel` - publish/unpublish support
- `MetadataModel` - JSON metadata storage
- `ColorModel` - color field
- `LifecycleModel` - lifecycle status (active/inactive/archived/draft)
- `BrandingModel` - branding assets
- `DeviceInformationModel` - device/client info
- `GeoLocationModel` - geographical coordinates
- `NetworkInformationModel` - network info (IP, ISP, ASN)

## Entity Models (Core)

Pre-composed models for common patterns:

- `EntityModel` - UUID + Timestamp + Audit + Metadata + SoftDelete
- `NamedEntityModel` - EntityModel + name + description + slug

## Domain-Specific Models (MOVED)

Domain-specific models have been moved to their respective applications:

- `OrganizationScopedModel` → organization.OrganizationScopedModel
- `ProjectScopedModel` → production.ProjectScopedModel
- `SequenceScopedModel` → production.SequenceScopedModel
- `ShotScopedModel` → production.ShotScopedModel
- `TaskScopedModel` → production.TaskScopedModel
- `ReviewScopedModel` → review.ReviewScopedModel
- `UserScopedModel` → identity.UserScopedModel
- `OrganizationOwnedModel` → organization.OrganizationOwnedModel
- `ProjectOwnedModel` → production.ProjectOwnedModel
- `UserOwnedModel` → identity.UserOwnedModel
- `OrganizationEntityModel` → organization.OrganizationEntityModel
- `ProjectEntityModel` → production.ProjectEntityModel
- `UserEntityModel` → identity.UserEntityModel

## Usage

```python
from apps.core.models.bases import (
    UUIDModel,
    TimeStampedModel,
    SoftDeleteModel,
    AuditModel,
    MetadataModel,
)


class MyModel(
    UUIDModel,
    TimeStampedModel,
    SoftDeleteModel,
    AuditModel,
    MetadataModel,
):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    class Meta:
        db_table = "my_app_my_model"
```
"""

from .audit import AuditModel
from .branding import BrandingModel
from .color import ColorModel
from .device import DeviceInformationModel
from .entity import EntityModel
from .lifecycle import LifecycleModel
from .location import GeoLocationModel
from .metadata import MetadataModel
from .named import NamedEntityModel
from .network import NetworkInformationModel
from .orderable import OrderableModel
from .organization import OrganizationEntityModel
from .ownership import OrganizationOwnedModel, ProjectOwnedModel, UserOwnedModel
from .project import ProjectEntityModel
from .publishable import PublishableModel
from .scopes import (
    OrganizationScopedModel,
    ProjectScopedModel,
    ReviewScopedModel,
    SequenceScopedModel,
    ShotScopedModel,
    TaskScopedModel,
    UserScopedModel,
)
from .soft_delete import SoftDeleteModel
from .timestamp import TimeStampedModel
from .user import UserEntityModel
from .uuid import UUIDModel

__all__ = [
    # Generic capabilities
    "AuditModel",
    "ColorModel",
    "MetadataModel",
    "OrderableModel",
    "PublishableModel",
    "SoftDeleteModel",
    "TimeStampedModel",
    "UUIDModel",
    # Entity models
    "EntityModel",
    "NamedEntityModel",
    # Domain-specific (deprecated - moved to domain apps)
    "OrganizationOwnedModel",
    "ProjectOwnedModel",
    "UserOwnedModel",
    "OrganizationScopedModel",
    "ProjectScopedModel",
    "ReviewScopedModel",
    "SequenceScopedModel",
    "ShotScopedModel",
    "TaskScopedModel",
    "UserScopedModel",
    "OrganizationEntityModel",
    "ProjectEntityModel",
    "UserEntityModel",
    # Additional generic models
    "BrandingModel",
    "LifecycleModel",
    "DeviceInformationModel",
    "GeoLocationModel",
    "NetworkInformationModel",
]
