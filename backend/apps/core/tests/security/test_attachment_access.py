"""
Attachment access control (TPN review TM-001, TM-005): ownership scoping, upload validation,
and file delivery only through a short-lived signed link.
"""

from __future__ import annotations

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.core.models.attachment import Attachment, attachment_upload_path
from apps.core.services import attachment_links
from apps.core.tests.factories import AttachmentFactory
from apps.identity.tests.factories import UserFactory

PDF = b"%PDF-1.4\n% test file\n"


@pytest.fixture(autouse=True)
def _media_root(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    settings.MEDIA_ACCEL_PREFIX = ""


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _upload(client, name="plate.pdf", content=PDF, **extra):
    return client.post(
        reverse("api:v1:core:attachment-list"),
        {"file": SimpleUploadedFile(name, content), "name": name, **extra},
        format="multipart",
    )


def _download(attachment, user, **params):
    token = params.pop("token", attachment_links.make_token(attachment, user))
    url = reverse("api:v1:core:attachment-download", kwargs={"uuid": attachment.pk})
    return APIClient().get(url, {"token": token} if token is not None else {})


@pytest.mark.django_db
class TestOwnershipScoping:
    def test_a_user_cannot_see_or_change_another_users_attachment(self):
        owner, other = UserFactory(), UserFactory()
        attachment = AttachmentFactory(created_by=owner)
        detail = reverse("api:v1:core:attachment-detail", kwargs={"uuid": attachment.pk})
        client = _client(other)

        assert client.get(detail).status_code == 404
        assert client.patch(detail, {"name": "x"}).status_code == 404
        assert client.delete(detail).status_code == 404
        assert client.get(reverse("api:v1:core:attachment-list")).json()["count"] == 0

        attachment.refresh_from_db()
        assert attachment.is_deleted is False

    def test_the_owner_sees_their_own_and_a_superuser_sees_all(self):
        owner, admin = UserFactory(), UserFactory(is_superuser=True, is_staff=True)
        AttachmentFactory.create_batch(2, created_by=owner)
        AttachmentFactory.create_batch(3, created_by=UserFactory())
        url = reverse("api:v1:core:attachment-list")

        assert _client(owner).get(url).json()["count"] == 2
        assert _client(admin).get(url).json()["count"] == 5

    def test_an_ownerless_attachment_is_invisible_to_ordinary_users(self):
        AttachmentFactory(created_by=None)

        assert (
            _client(UserFactory()).get(reverse("api:v1:core:attachment-list")).json()["count"] == 0
        )

    def test_an_expired_attachment_is_hidden_from_its_owner(self):
        owner = UserFactory()
        AttachmentFactory(created_by=owner, expires_at=timezone.now() - timezone.timedelta(hours=1))

        assert _client(owner).get(reverse("api:v1:core:attachment-list")).json()["count"] == 0

    def test_the_compat_route_is_scoped_the_same_way(self):
        AttachmentFactory(created_by=UserFactory())

        assert _client(UserFactory()).get("/api/v1/attachments/").json() == []

    def test_anonymous_callers_are_refused(self):
        assert APIClient().get(reverse("api:v1:core:attachment-list")).status_code == 401


@pytest.mark.django_db
class TestUploadValidation:
    def test_an_allowed_file_is_stored_owned_and_measured_by_the_server(self):
        user = UserFactory()

        response = _upload(_client(user), file_size=1)

        assert response.status_code == 201
        attachment = Attachment.objects.get(created_by=user)
        assert attachment.created_by_id == user.pk
        assert attachment.file_size == len(PDF)
        assert attachment.mime_type == "application/pdf"

    def test_the_response_carries_a_download_link_not_the_stored_path(self):
        body = _upload(_client(UserFactory())).json()

        assert "/media/" not in body["file"]
        assert body["file"] == body["download_url"]
        assert "/download/?token=" in body["file"]

    @pytest.mark.parametrize(
        "name",
        ["page.html", "image.svg", "tool.exe", "run.sh", "script.js", "noextension", "data.xml"],
    )
    def test_unlisted_extensions_are_refused(self, name):
        response = _upload(_client(UserFactory()), name=name)

        assert response.status_code == 400
        assert Attachment.objects.count() == 0

    def test_web_content_hidden_behind_an_allowed_extension_is_refused(self):
        response = _upload(
            _client(UserFactory()), name="notes.txt", content=b"  <!DOCTYPE html><script>1</script>"
        )

        assert response.status_code == 400

    def test_an_empty_file_is_refused(self):
        assert _upload(_client(UserFactory()), content=b"").status_code == 400

    def test_an_oversize_file_is_refused(self, settings):
        settings.ATTACHMENT_MAX_BYTES = 8

        assert _upload(_client(UserFactory())).status_code == 400

    @pytest.mark.parametrize(
        ("filename", "expected"),
        [
            ("a.PDF", ".pdf"),
            ("a.p/../h", ".dat"),
            ("a.<b>", ".dat"),
            ("noext", ".dat"),
            ("a.toolongext1", ".dat"),
        ],
    )
    def test_the_stored_extension_is_sanitized(self, filename, expected):
        assert attachment_upload_path(Attachment(), filename).endswith(expected)


@pytest.mark.django_db
class TestDownload:
    def _stored(self, user):
        assert _upload(_client(user)).status_code == 201
        return Attachment.objects.filter(created_by=user).latest("created_at")

    def test_a_valid_link_returns_the_bytes_as_an_inert_download(self):
        user = UserFactory()
        attachment = self._stored(user)

        response = _download(attachment, user)

        assert response.status_code == 200
        assert b"".join(response.streaming_content) == PDF
        assert response["X-Content-Type-Options"] == "nosniff"
        assert "sandbox" in response["Content-Security-Policy"]
        assert response["Content-Disposition"].startswith("attachment;")
        assert "no-store" in response["Cache-Control"]

    def test_the_link_from_the_api_works_without_credentials(self):
        user = UserFactory()
        link = _upload(_client(user)).json()["download_url"]

        assert APIClient().get(link).status_code == 200

    def test_a_missing_or_garbled_token_is_a_404(self):
        user = UserFactory()
        attachment = self._stored(user)

        assert _download(attachment, user, token=None).status_code == 404
        assert _download(attachment, user, token="garbage").status_code == 404

    def test_a_token_for_another_attachment_is_a_404(self):
        user = UserFactory()
        first, second = self._stored(user), self._stored(user)

        assert (
            _download(second, user, token=attachment_links.make_token(first, user)).status_code
            == 404
        )

    def test_a_token_minted_for_a_user_who_may_not_see_the_file_is_a_404(self):
        owner, other = UserFactory(), UserFactory()
        attachment = self._stored(owner)

        assert _download(attachment, other).status_code == 404

    def test_an_expired_link_is_a_404(self, settings):
        user = UserFactory()
        attachment = self._stored(user)
        settings.ATTACHMENT_LINK_TTL_SECONDS = -1

        assert _download(attachment, user).status_code == 404

    def test_access_is_rechecked_when_the_link_is_used(self):
        user = UserFactory()
        attachment = self._stored(user)
        token = attachment_links.make_token(attachment, user)

        user.is_active = False
        user.save(update_fields=["is_active"])
        assert _download(attachment, user, token=token).status_code == 404

        user.is_active = True
        user.save(update_fields=["is_active"])
        attachment.delete()
        assert _download(attachment, user, token=token).status_code == 404

    def test_an_expired_attachment_cannot_be_downloaded(self):
        user = UserFactory()
        attachment = self._stored(user)
        attachment.expires_at = timezone.now() - timezone.timedelta(minutes=1)
        attachment.save(update_fields=["expires_at"])

        assert _download(attachment, user).status_code == 404

    def test_the_proxy_hands_over_the_file_when_configured(self, settings):
        settings.MEDIA_ACCEL_PREFIX = "/_protected_media"
        user = UserFactory()
        attachment = self._stored(user)

        response = _download(attachment, user)

        assert response.status_code == 200
        assert response["X-Accel-Redirect"] == f"/_protected_media/{attachment.file.name}"
        assert response.content == b""
        assert response["X-Content-Type-Options"] == "nosniff"
