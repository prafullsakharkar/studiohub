from django.test import SimpleTestCase
from django.db import models

from apps.core.models.bases.uuid import UUIDModel
from apps.core.models.bases.timestamp import TimeStampedModel
from apps.core.models.bases.soft_delete import SoftDeleteModel
from apps.core.models.bases.metadata import MetadataModel
from apps.core.models.bases.ownership import OrganizationOwnedModel, ProjectOwnedModel
from apps.core.models.bases.project import ProjectEntityModel


class TestModelFoundation(SimpleTestCase):
    def test_uuid_model_has_uuid_primary_key(self):
        # Inspect the model meta for the 'id' field
        field = UUIDModel._meta.get_field('id')
        self.assertTrue(field.primary_key)
        self.assertIsInstance(field, models.UUIDField)

    def test_timestamp_model_fields(self):
        created = TimeStampedModel._meta.get_field('created_at')
        updated = TimeStampedModel._meta.get_field('updated_at')

        self.assertIsInstance(created, models.DateTimeField)
        self.assertTrue(getattr(created, 'auto_now_add', False))

        self.assertIsInstance(updated, models.DateTimeField)
        self.assertTrue(getattr(updated, 'auto_now', False))

    def test_soft_delete_model_fields_and_managers(self):
        is_deleted_field = SoftDeleteModel._meta.get_field('is_deleted')
        deleted_at_field = SoftDeleteModel._meta.get_field('deleted_at')

        self.assertIsInstance(is_deleted_field, models.BooleanField)
        self.assertIsInstance(deleted_at_field, models.DateTimeField)

        # Manager attributes should exist on the class
        self.assertTrue(hasattr(SoftDeleteModel, 'objects'))
        self.assertTrue(hasattr(SoftDeleteModel, 'all_objects'))

    def test_metadata_model_has_json_metadata(self):
        metadata_field = MetadataModel._meta.get_field('metadata')
        self.assertIsInstance(metadata_field, models.JSONField)

    def test_ownership_models_are_abstract(self):
        self.assertTrue(OrganizationOwnedModel._meta.abstract)
        self.assertTrue(ProjectOwnedModel._meta.abstract)

    def test_project_entity_model_is_abstract(self):
        self.assertTrue(ProjectEntityModel._meta.abstract)
