"""
Admin hardening (D-15): deliveries, items, the snapshot, QC rows, the history and the counter are
written by the services only, so the admin only reads them. Destinations stay editable and the
admin form reports a clash instead of failing.
"""

from __future__ import annotations

import pytest
from django.contrib import admin
from django.test import RequestFactory
from django.urls import reverse

from apps.deliveries.models import (
    DeliveryCounter,
    DeliveryDestination,
    DeliveryItemFile,
    DeliveryPackage,
    DeliveryQCCheck,
    DeliveryStatusChange,
    DeliveryVersionRef,
)
from apps.deliveries.tests.helpers import make_package, signed_off_package
from apps.identity.tests.factories import UserFactory

pytestmark = pytest.mark.django_db

READ_ONLY = [
    DeliveryPackage,
    DeliveryVersionRef,
    DeliveryItemFile,
    DeliveryQCCheck,
    DeliveryStatusChange,
    DeliveryCounter,
]


@pytest.fixture
def admin_client(client):
    client.force_login(UserFactory.create(is_superuser=True, is_staff=True))
    return client


@pytest.mark.parametrize("model", READ_ONLY, ids=lambda m: m.__name__)
def test_the_admin_cannot_add_change_or_delete(model):
    model_admin = admin.site._registry[model]
    request = RequestFactory().get("/")
    request.user = UserFactory.create(is_superuser=True, is_staff=True)

    assert model_admin.has_add_permission(request) is False
    assert model_admin.has_change_permission(request, None) is False
    assert model_admin.has_delete_permission(request, None) is False


def test_a_delivery_can_be_read_but_a_post_changes_nothing(admin_client):
    package = make_package(code="ADMIN-1", name="Original")
    url = reverse("admin:deliveries_deliverypackage_change", args=[package.pk])

    assert admin_client.get(url).status_code == 200
    posted = admin_client.post(url, {"name": "Edited", "code": "HACKED"})

    assert posted.status_code == 403
    fresh = DeliveryPackage.objects.get(pk=package.pk)
    assert (fresh.name, fresh.code) == ("Original", "ADMIN-1")


def test_a_delivery_cannot_be_added_or_deleted_in_the_admin(admin_client):
    package = make_package(code="ADMIN-2")

    add = admin_client.get(reverse("admin:deliveries_deliverypackage_add"))
    delete = admin_client.post(
        reverse("admin:deliveries_deliverypackage_delete", args=[package.pk]), {"post": "yes"}
    )

    assert add.status_code == 403 and delete.status_code == 403
    assert DeliveryPackage.objects.filter(pk=package.pk).exists()


def test_the_changelist_and_the_history_pages_render(admin_client):
    package = signed_off_package()

    for name in (
        "admin:deliveries_deliverypackage_changelist",
        "admin:deliveries_deliverystatuschange_changelist",
        "admin:deliveries_deliveryqccheck_changelist",
        "admin:deliveries_deliveryitemfile_changelist",
        "admin:deliveries_deliveryversionref_changelist",
    ):
        response = admin_client.get(reverse(name))
        assert response.status_code == 200, name
    page = admin_client.get(reverse("admin:deliveries_deliverypackage_change", args=[package.pk]))
    assert "Signed Off" in page.content.decode()


def test_an_item_cannot_be_changed_in_the_admin(admin_client):
    package = signed_off_package()
    item = DeliveryVersionRef.objects.get(delivery=package)
    url = reverse("admin:deliveries_deliveryversionref_change", args=[item.pk])

    assert admin_client.get(url).status_code == 200
    assert admin_client.post(url, {"version_number": "v999"}).status_code == 403
    assert DeliveryVersionRef.objects.get(pk=item.pk).version_number != "v999"


class TestDestinationAdmin:
    ADD = "admin:deliveries_deliverydestination_add"

    def _data(self, name, **extra):
        return {
            "name": name,
            "destination_type": "AWS S3 Bucket",
            "endpoint": "s3://x",
            "storage_region": "",
            "target_directory": "",
            "is_active": "on",
            **extra,
        }

    def test_a_destination_can_be_added(self, admin_client):
        response = admin_client.post(reverse(self.ADD), self._data("Via admin"))

        assert response.status_code == 302
        assert DeliveryDestination.objects.filter(name="Via admin").exists()

    def test_a_name_that_differs_only_in_case_is_a_form_error_not_a_500(self, admin_client):
        DeliveryDestination.objects.create(
            name="Hub", destination_type="AWS S3 Bucket", endpoint="s3://hub"
        )

        response = admin_client.post(reverse(self.ADD), self._data("HUB"))

        assert response.status_code == 200 and "errorlist" in response.content.decode()
        assert DeliveryDestination.objects.count() == 1

    def test_choosing_a_default_in_the_admin_moves_it_like_the_api_does(self, admin_client):
        old = DeliveryDestination.objects.create(
            name="Hub", destination_type="AWS S3 Bucket", endpoint="s3://hub", is_default=True
        )

        response = admin_client.post(reverse(self.ADD), self._data("Other", is_default="on"))

        assert response.status_code == 302
        defaults = DeliveryDestination.objects.filter(is_default=True)
        assert [d.name for d in defaults] == ["Other"]
        assert DeliveryDestination.objects.get(pk=old.pk).is_default is False

    def test_editing_a_destination_keeps_its_own_name_valid(self, admin_client):
        destination = DeliveryDestination.objects.create(
            name="Hub", destination_type="AWS S3 Bucket", endpoint="s3://hub"
        )
        url = reverse("admin:deliveries_deliverydestination_change", args=[destination.pk])

        response = admin_client.post(url, self._data("hub", endpoint="s3://hub2"))

        assert response.status_code == 302
        assert DeliveryDestination.objects.get(pk=destination.pk).endpoint == "s3://hub2"
