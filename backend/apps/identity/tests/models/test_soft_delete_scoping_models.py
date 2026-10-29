from __future__ import annotations

import pytest
from rest_framework.exceptions import AuthenticationFailed

from apps.identity.models import Profile, User
from apps.identity.selectors.authentication import AuthenticationSelector
from apps.identity.services.profile import ProfileService
from apps.identity.services.user import UserService
from apps.identity.tests.factories import ProfileFactory, UserFactory
from apps.identity.validators.authentication import AuthenticationValidator


@pytest.mark.django_db
class TestUserSoftDeleteScoping:
    def test_default_manager_hides_soft_deleted_users(self):
        user = UserFactory.create()
        UserService.delete(instance=user)

        assert not User.objects.filter(pk=user.pk).exists()
        assert User.all_objects.filter(pk=user.pk).exists()
        assert User.objects.deleted().filter(pk=user.pk).exists()
        assert User.objects.with_deleted().filter(pk=user.pk).exists()

    def test_authentication_selector_cannot_resolve_soft_deleted_user(self):
        user = UserFactory.create(email="gone@example.com")
        UserService.delete(instance=user)

        assert AuthenticationSelector.get_user(username=user.email) is None
        assert AuthenticationSelector.get_user_by_id(pk=user.pk) is None
        assert AuthenticationSelector.get_user_by_uuid(uuid=user.uuid) is None

    def test_validator_rejects_soft_deleted_principal(self):
        user = UserFactory.create()
        UserService.delete(instance=user)

        with pytest.raises(AuthenticationFailed):
            AuthenticationValidator.validate_user_not_deleted(user)

    def test_restore_makes_user_reachable_again(self):
        user = UserFactory.create()
        UserService.delete(instance=user)

        UserService.restore(instance=user)

        assert User.objects.filter(pk=user.pk).exists()
        assert AuthenticationSelector.get_user_by_id(pk=user.pk) == user


@pytest.mark.django_db
class TestProfileSoftDeleteScoping:
    def test_default_manager_hides_soft_deleted_profiles(self):
        profile = ProfileFactory.create()
        ProfileService.delete(instance=profile)

        assert not Profile.objects.filter(pk=profile.pk).exists()
        assert Profile.all_objects.filter(pk=profile.pk).exists()
        assert Profile.objects.deleted().filter(pk=profile.pk).exists()
