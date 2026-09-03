import uuid

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from apps.core.models.attachment import Attachment
from apps.core.services.soft_delete import SoftDeleteService


@override_settings(MEDIA_ROOT="/tmp/test_media_core")
class SoftDeleteDBTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(email="tester@example.com", password="pass")

    def _create_attachment(self, name: str = "file.txt", content: bytes = b"hello") -> Attachment:
        storage_key = f"test-{uuid.uuid4().hex}"
        uploaded = SimpleUploadedFile(name, content, content_type="text/plain")
        attachment = Attachment.objects.create(
            file=uploaded,
            name=name,
            description="",
            file_type="document",
            mime_type="text/plain",
            file_size=len(content),
            storage_key=storage_key,
            is_public=False,
        )
        return attachment

    def test_soft_delete_and_restore_flow(self):
        att = self._create_attachment()

        # initially visible via default manager
        self.assertTrue(Attachment.objects.filter(pk=att.pk).exists())
        self.assertTrue(Attachment.all_objects.filter(pk=att.pk).exists())

        # soft-delete via service
        SoftDeleteService.delete(att, user=self.user)

        # refresh from db to see updated fields
        att.refresh_from_db()
        self.assertTrue(att.is_deleted)
        self.assertIsNotNone(att.deleted_at)
        self.assertEqual(att.deleted_by, self.user)

        # default manager excludes deleted
        self.assertFalse(Attachment.objects.filter(pk=att.pk).exists())

        # all_objects includes deleted
        self.assertTrue(Attachment.all_objects.filter(pk=att.pk).exists())

        # deleted() queryset returns the soft-deleted rows
        self.assertTrue(Attachment.all_objects.deleted().filter(pk=att.pk).exists())

        # restore
        SoftDeleteService.restore(att)
        att.refresh_from_db()
        self.assertFalse(att.is_deleted)
        self.assertIsNone(att.deleted_at)
        # deleted_by may be cleared by restore implementation
        if hasattr(att, "deleted_by"):
            self.assertIsNone(att.deleted_by)

        # back visible via default manager
        self.assertTrue(Attachment.objects.filter(pk=att.pk).exists())

    def test_hard_delete_removes_record(self):
        att = self._create_attachment(name="hard.txt")
        pk = att.pk

        # hard delete
        SoftDeleteService.hard_delete(att)

        # record no longer present in all_objects
        self.assertFalse(Attachment.all_objects.filter(pk=pk).exists())

    def test_soft_delete_preserves_other_records(self):
        a1 = self._create_attachment(name="a1.txt")
        a2 = self._create_attachment(name="a2.txt")

        SoftDeleteService.delete(a1, user=self.user)

        # a2 still visible via default manager
        self.assertTrue(Attachment.objects.filter(pk=a2.pk).exists())

        # a1 not visible via default manager
        self.assertFalse(Attachment.objects.filter(pk=a1.pk).exists())
