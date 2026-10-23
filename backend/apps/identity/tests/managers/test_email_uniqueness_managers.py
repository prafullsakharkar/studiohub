from __future__ import annotations

import pytest
from django.db import IntegrityError, transaction

from apps.identity.models import User
from apps.identity.services.user import UserService
from apps.identity.tests.factories import UserFactory
from apps.identity.validators.user import UserValidator


@pytest.mark.django_db
class TestEmailNormalization:
    def test_manager_normalizes_email_to_lower_case(self):
        user = User.objects.create_user(
            email="MiXeD.Case@Example.COM",
            password="password123",
        )

        assert user.email == "mixed.case@example.com"

    def test_service_normalizes_email_to_lower_case(self):
        user = UserService.create(
            email="  Service.Mixed@Example.COM  ",
        )

        assert user.email == "service.mixed@example.com"

    def test_service_update_normalizes_email_to_lower_case(self):
        user = UserFactory.create(email="before@example.com")

        user = UserService.update(
            instance=user,
            email="After.Mixed@Example.COM",
        )

        assert user.email == "after.mixed@example.com"


@pytest.mark.django_db
class TestCaseInsensitiveUniqueness:
    def test_validator_rejects_case_variant_duplicate(self):
        UserFactory.create(email="taken@example.com")

        with pytest.raises(ValueError):
            UserValidator.validate_email_unique("TAKEN@example.com")

    def test_service_rejects_case_variant_duplicate(self):
        UserFactory.create(email="service-taken@example.com")

        with pytest.raises(ValueError):
            UserService.create(email="SERVICE-TAKEN@example.com")

    def test_database_constraint_rejects_case_variant_duplicate(self):
        User.objects.create(email="Db.Taken@Example.com")

        with pytest.raises(IntegrityError), transaction.atomic():
            User.objects.create(email="db.taken@example.com")

    def test_soft_deleted_email_cannot_be_reused(self):
        user = UserFactory.create(email="reserved@example.com")
        UserService.delete(instance=user)

        with pytest.raises(ValueError):
            UserService.create(email="RESERVED@example.com")
