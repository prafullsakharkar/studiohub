"""
Tests for organization signals.

Verifies the actual ``post_save`` signal wiring on ``UserSession``.
"""

from __future__ import annotations

import pytest
from django.db.models.signals import post_save
from django.test import TestCase

from apps.organization.models.user_session import UserSession
from apps.organization.tests.factories import UserSessionFactory


class OrganizationSignalIntegrationTests(TestCase):
    """Integration tests for organization signals."""

    def test_user_session_creation_triggers_signal(self) -> None:
        """Test that user session creation triggers post_save signal."""
        signal_received = False

        def handler(sender, instance, **kwargs):
            nonlocal signal_received
            signal_received = True

        post_save.connect(handler, sender=UserSession)

        try:
            session = UserSessionFactory.create()
            assert signal_received, "Signal should be received on creation"
            assert session.pk is not None
        finally:
            post_save.disconnect(handler, sender=UserSession)

    def test_user_session_update_triggers_signal(self) -> None:
        """Test that user session update triggers post_save signal."""
        session = UserSessionFactory.create()
        signal_received = False

        def handler(sender, instance, **kwargs):
            nonlocal signal_received
            signal_received = True

        post_save.connect(handler, sender=UserSession)

        try:
            session.status = "logged_out"
            session.save()
            assert signal_received, "Signal should be received on update"
        finally:
            post_save.disconnect(handler, sender=UserSession)

    def test_signal_receives_created_flag_on_create(self) -> None:
        """Test the signal receives created=True for new sessions."""
        created_flags = []

        def handler(sender, instance, created, **kwargs):
            created_flags.append(created)

        post_save.connect(handler, sender=UserSession)

        try:
            UserSessionFactory.create()
            assert created_flags == [True]
        finally:
            post_save.disconnect(handler, sender=UserSession)

    def test_signal_receives_created_flag_on_update(self) -> None:
        """Test the signal receives created=False for updates."""
        session = UserSessionFactory.create()
        created_flags = []

        def handler(sender, instance, created, **kwargs):
            created_flags.append(created)

        post_save.connect(handler, sender=UserSession)

        try:
            session.status = "expired"
            session.save()
            assert created_flags == [False]
        finally:
            post_save.disconnect(handler, sender=UserSession)

    def test_session_has_post_save_listeners(self) -> None:
        """Test UserSession has post_save signal listeners."""
        assert post_save.has_listeners(UserSession)
