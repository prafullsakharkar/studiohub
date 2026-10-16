"""
Base models for Production bounded context.
"""

from apps.core.models.bases import EntityModel


class ProductionEntityModel(EntityModel):
    """
    Base for production entities scoped to a Project.

    There is no organization scope: ``Project`` is the sole tenant
    boundary and project scoping is declared per model (``project`` FK).
    This base only pins the shared ``EntityModel`` behavior (UUID pk,
    soft-delete, audit timestamps).
    """

    class Meta:
        abstract = True
